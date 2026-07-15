-- Self-service acquisition funnel and cardless 14-day Pro trial.
-- Additive only: existing accounts, Stripe subscriptions and grants are untouched.

CREATE TABLE IF NOT EXISTS public.trial_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token_hash TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 120),
  email TEXT NOT NULL CHECK (char_length(email) <= 254),
  normalized_email TEXT NOT NULL CHECK (normalized_email = lower(normalized_email)),
  phone TEXT NOT NULL CHECK (char_length(phone) <= 30),
  normalized_phone TEXT NOT NULL CHECK (normalized_phone ~ '^55[1-9][0-9]{9,10}$'),
  company_name TEXT CHECK (char_length(company_name) <= 160),
  business_segment TEXT CHECK (char_length(business_segment) <= 120),
  team_size TEXT CHECK (char_length(team_size) <= 60),
  primary_goal TEXT CHECK (char_length(primary_goal) <= 120),
  current_step SMALLINT NOT NULL DEFAULT 1 CHECK (current_step BETWEEN 1 AND 3),
  status TEXT NOT NULL DEFAULT 'lead_captured' CHECK (status IN (
    'lead_captured','company_profile_completed','account_created','trial_active',
    'trial_expired','converted','abandoned','invalid','blocked'
  )),
  marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent_at TIMESTAMPTZ,
  marketing_consent_version TEXT,
  marketing_revoked_at TIMESTAMPTZ,
  terms_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  privacy_policy_version TEXT,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  landing_path TEXT CHECK (char_length(landing_path) <= 500),
  referrer TEXT CHECK (char_length(referrer) <= 1000),
  first_visited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  utm_source TEXT CHECK (char_length(utm_source) <= 200),
  utm_medium TEXT CHECK (char_length(utm_medium) <= 200),
  utm_campaign TEXT CHECK (char_length(utm_campaign) <= 200),
  utm_content TEXT CHECK (char_length(utm_content) <= 200),
  utm_term TEXT CHECK (char_length(utm_term) <= 200),
  gclid TEXT CHECK (char_length(gclid) <= 300),
  fbclid TEXT CHECK (char_length(fbclid) <= 300),
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  account_created_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS trial_signups_normalized_email_unique
  ON public.trial_signups(normalized_email);
CREATE INDEX IF NOT EXISTS trial_signups_status_created_idx
  ON public.trial_signups(status, created_at DESC);
CREATE INDEX IF NOT EXISTS trial_signups_campaign_idx
  ON public.trial_signups(utm_source, utm_campaign);
CREATE UNIQUE INDEX IF NOT EXISTS trial_signups_auth_user_unique
  ON public.trial_signups(auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS trial_signups_account_unique
  ON public.trial_signups(account_id) WHERE account_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.trial_signups;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.trial_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.trial_signup_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trial_signup_id UUID NOT NULL REFERENCES public.trial_signups(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'trial_form_viewed','trial_step_1_completed','trial_step_2_completed',
    'trial_account_created','trial_started','trial_expired','subscription_started'
  )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trial_signup_events_signup_time_idx
  ON public.trial_signup_events(trial_signup_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS trial_signup_events_milestone_unique
  ON public.trial_signup_events(trial_signup_id, event_type);

ALTER TABLE public.trial_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_signup_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trial_signups, public.trial_signup_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.trial_signups, public.trial_signup_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.trial_signup_events_id_seq TO service_role;

ALTER TABLE public.account_access_grants DROP CONSTRAINT IF EXISTS account_access_grants_type_check;
ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_type_check
  CHECK (grant_type IN ('pilot', 'internal', 'trial'));
ALTER TABLE public.account_access_grants DROP CONSTRAINT IF EXISTS account_access_grants_pilot_expiry_check;
ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_temporary_expiry_check
  CHECK (grant_type NOT IN ('pilot', 'trial') OR expires_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.activate_self_service_trial(
  target_signup_id UUID,
  target_user_id UUID,
  target_account_id UUID
) RETURNS TABLE(trial_started_at TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  signup public.trial_signups%ROWTYPE;
  billing public.account_billing%ROWTYPE;
  started TIMESTAMPTZ := NOW();
  ending TIMESTAMPTZ := NOW() + INTERVAL '14 days';
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;

  SELECT * INTO signup FROM public.trial_signups WHERE id = target_signup_id FOR UPDATE;
  IF signup.id IS NULL THEN RAISE EXCEPTION 'trial_signup_not_found'; END IF;
  IF signup.auth_user_id IS NOT NULL AND signup.auth_user_id <> target_user_id THEN RAISE EXCEPTION 'trial_user_mismatch'; END IF;
  IF signup.account_id IS NOT NULL AND signup.account_id <> target_account_id THEN RAISE EXCEPTION 'trial_account_mismatch'; END IF;
  IF signup.status = 'trial_active' THEN
    RETURN QUERY SELECT signup.trial_started_at, signup.trial_ends_at;
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = target_user_id AND p.account_id = target_account_id
      AND lower(p.email) = signup.normalized_email AND p.account_role = 'owner'
  ) THEN RAISE EXCEPTION 'trial_membership_mismatch'; END IF;

  SELECT * INTO billing FROM public.account_billing WHERE account_id = target_account_id FOR UPDATE;
  IF billing.account_id IS NULL THEN RAISE EXCEPTION 'trial_billing_missing'; END IF;
  IF billing.trial_used_at IS NOT NULL THEN RAISE EXCEPTION 'trial_already_used'; END IF;
  IF billing.provider_subscription_id IS NOT NULL OR billing.subscription_status IN ('active','trialing','past_due','unpaid','incomplete','paused') THEN
    RAISE EXCEPTION 'subscription_already_exists';
  END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants WHERE account_id = target_account_id) THEN
    RAISE EXCEPTION 'account_grant_already_exists';
  END IF;

  INSERT INTO public.account_access_grants(account_id, grant_type, plan_key, status, starts_at, expires_at, reason)
  VALUES(target_account_id, 'trial', 'pro', 'active', started, ending, 'Teste Pro de autosserviço por 14 dias');

  UPDATE public.account_billing SET trial_used_at = started WHERE account_id = target_account_id;
  UPDATE public.accounts SET name = COALESCE(NULLIF(signup.company_name, ''), name) WHERE id = target_account_id;
  UPDATE public.trial_signups SET
    auth_user_id = target_user_id, account_id = target_account_id,
    current_step = 3, status = 'trial_active', account_created_at = COALESCE(account_created_at, started),
    trial_started_at = started, trial_ends_at = ending
  WHERE id = target_signup_id;
  INSERT INTO public.trial_signup_events(trial_signup_id, event_type) VALUES
    (target_signup_id, 'trial_account_created'), (target_signup_id, 'trial_started');

  RETURN QUERY SELECT started, ending;
END; $$;

REVOKE ALL ON FUNCTION public.activate_self_service_trial(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_self_service_trial(UUID, UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.effective_billing_plan(target_account_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE g.plan_key WHEN 'basic' THEN 'free' ELSE g.plan_key END FROM public.account_access_grants g
      WHERE g.account_id=target_account_id AND g.grant_type='internal' AND g.status='active' AND g.starts_at<=NOW() AND (g.expires_at IS NULL OR g.expires_at>NOW()) ORDER BY g.starts_at DESC LIMIT 1),
    (SELECT CASE g.plan_key WHEN 'basic' THEN 'free' ELSE g.plan_key END FROM public.account_access_grants g
      WHERE g.account_id=target_account_id AND g.grant_type='pilot' AND g.status='active' AND g.starts_at<=NOW() AND g.expires_at>NOW() ORDER BY g.starts_at DESC LIMIT 1),
    (SELECT CASE WHEN b.subscription_status IN ('active','trialing') OR (b.subscription_status='past_due' AND b.grace_period_ends_at>NOW()) THEN b.plan_key END FROM public.account_billing b WHERE b.account_id=target_account_id),
    (SELECT CASE g.plan_key WHEN 'basic' THEN 'free' ELSE g.plan_key END FROM public.account_access_grants g
      WHERE g.account_id=target_account_id AND g.grant_type='trial' AND g.status='active' AND g.starts_at<=NOW() AND g.expires_at>NOW() ORDER BY g.starts_at DESC LIMIT 1),
    'free'
  )
$$;

CREATE OR REPLACE FUNCTION public.billing_account_has_access(target_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(EXISTS (
    SELECT 1 FROM public.account_access_grants g WHERE g.account_id=target_account_id AND g.status='active'
      AND g.starts_at<=NOW() AND (g.expires_at IS NULL OR g.expires_at>NOW())
  ) OR EXISTS (
    SELECT 1 FROM public.account_billing b WHERE b.account_id=target_account_id AND (
      (b.access_override_plan IS NOT NULL AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at>NOW())) OR
      b.subscription_status IN ('active','trialing') OR (b.subscription_status='past_due' AND b.grace_period_ends_at>NOW())
    )
  ), FALSE)
$$;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_account_has_access(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_account_has_access(UUID) TO service_role;
