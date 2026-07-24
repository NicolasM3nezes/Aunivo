-- Email-confirmed, idempotent activation for the self-service 14-day trial.
-- Pending Auth users have no application account, membership, billing or grant.

ALTER TABLE public.trial_signups DROP CONSTRAINT IF EXISTS trial_signups_status_check;
ALTER TABLE public.trial_signups ADD CONSTRAINT trial_signups_status_check CHECK (status IN (
  'lead_captured','company_profile_completed','email_confirmation_pending',
  'account_created','trial_active','trial_expired','converted','abandoned',
  'invalid','blocked'
));

ALTER TABLE public.trial_signup_events DROP CONSTRAINT IF EXISTS trial_signup_events_event_type_check;
ALTER TABLE public.trial_signup_events ADD CONSTRAINT trial_signup_events_event_type_check CHECK (event_type IN (
  'trial_form_viewed','trial_step_1_completed','trial_step_2_completed',
  'email_confirmation_requested','email_confirmed','activation_started',
  'trial_account_created','trial_started','trial_expired','subscription_started'
));

-- Acquisition signups are deliberately left pending. Normal signups and member
-- invitations keep the existing bootstrap behavior.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_account_id UUID;
BEGIN
  IF COALESCE((NEW.raw_user_meta_data->>'acquisition_pending')::BOOLEAN, FALSE) THEN
    RETURN NEW;
  END IF;

  SELECT account_id INTO v_account_id FROM public.profiles WHERE user_id = NEW.id;
  IF v_account_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id FROM public.accounts
  WHERE owner_user_id = NEW.id ORDER BY created_at LIMIT 1;
  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (name, owner_user_id, default_currency, timezone)
    VALUES (COALESCE(NULLIF(v_full_name, ''), NEW.email, 'Minha empresa'), NEW.id, 'BRL', 'America/Sao_Paulo')
    RETURNING id INTO v_account_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner')
  ON CONFLICT (user_id) DO UPDATE SET
    account_id = COALESCE(public.profiles.account_id, EXCLUDED.account_id),
    account_role = COALESCE(public.profiles.account_role, 'owner');
  INSERT INTO public.notification_preferences (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  PERFORM public.ensure_v1_account_defaults(v_account_id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.activate_confirmed_self_service_trial(
  target_signup_id UUID,
  target_user_id UUID
) RETURNS TABLE(account_id UUID, trial_started_at TIMESTAMPTZ, trial_ends_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  signup public.trial_signups%ROWTYPE;
  auth_user auth.users%ROWTYPE;
  billing public.account_billing%ROWTYPE;
  resolved_account_id UUID;
  started TIMESTAMPTZ;
  ending TIMESTAMPTZ;
BEGIN
  IF auth.role() <> 'service_role' THEN RAISE EXCEPTION 'service_role_required'; END IF;

  SELECT * INTO signup FROM public.trial_signups WHERE id = target_signup_id FOR UPDATE;
  IF signup.id IS NULL THEN RAISE EXCEPTION 'trial_signup_not_found'; END IF;
  IF signup.auth_user_id IS DISTINCT FROM target_user_id THEN RAISE EXCEPTION 'trial_user_mismatch'; END IF;

  SELECT * INTO auth_user FROM auth.users WHERE id = target_user_id;
  IF auth_user.id IS NULL OR auth_user.email_confirmed_at IS NULL THEN RAISE EXCEPTION 'email_not_confirmed'; END IF;
  IF lower(auth_user.email) IS DISTINCT FROM signup.normalized_email THEN RAISE EXCEPTION 'trial_email_mismatch'; END IF;

  IF signup.status IN ('trial_active','trial_expired','converted') THEN
    RETURN QUERY SELECT signup.account_id, signup.trial_started_at, signup.trial_ends_at;
    RETURN;
  END IF;
  IF signup.status <> 'email_confirmation_pending' THEN RAISE EXCEPTION 'trial_signup_not_pending'; END IF;

  INSERT INTO public.trial_signup_events(trial_signup_id, event_type)
  VALUES (signup.id, 'email_confirmed'), (signup.id, 'activation_started')
  ON CONFLICT (trial_signup_id, event_type) DO NOTHING;

  SELECT p.account_id INTO resolved_account_id FROM public.profiles p WHERE p.user_id = target_user_id;
  IF resolved_account_id IS NULL THEN
    SELECT a.id INTO resolved_account_id FROM public.accounts a WHERE a.owner_user_id = target_user_id;
  END IF;
  IF resolved_account_id IS NULL THEN
    INSERT INTO public.accounts(name, owner_user_id, default_currency, timezone)
    VALUES (COALESCE(NULLIF(signup.company_name, ''), signup.full_name, auth_user.email), target_user_id, 'BRL', 'America/Sao_Paulo')
    RETURNING id INTO resolved_account_id;
  END IF;

  INSERT INTO public.profiles(user_id, full_name, email, account_id, account_role)
  VALUES(target_user_id, signup.full_name, auth_user.email, resolved_account_id, 'owner')
  ON CONFLICT(user_id) DO UPDATE SET
    full_name = COALESCE(NULLIF(public.profiles.full_name, ''), EXCLUDED.full_name),
    email = EXCLUDED.email,
    account_id = COALESCE(public.profiles.account_id, EXCLUDED.account_id),
    account_role = COALESCE(public.profiles.account_role, 'owner');
  INSERT INTO public.notification_preferences(user_id) VALUES(target_user_id)
  ON CONFLICT(user_id) DO NOTHING;
  PERFORM public.ensure_v1_account_defaults(resolved_account_id);

  SELECT * INTO billing FROM public.account_billing WHERE account_billing.account_id = resolved_account_id FOR UPDATE;
  IF billing.account_id IS NULL THEN RAISE EXCEPTION 'trial_billing_missing'; END IF;
  IF billing.trial_used_at IS NOT NULL THEN RAISE EXCEPTION 'trial_already_used'; END IF;
  IF billing.provider_subscription_id IS NOT NULL
     OR billing.subscription_status IN ('active','trialing','past_due','unpaid','incomplete','paused')
  THEN RAISE EXCEPTION 'subscription_already_exists'; END IF;
  IF EXISTS (SELECT 1 FROM public.account_access_grants WHERE account_access_grants.account_id = resolved_account_id)
  THEN RAISE EXCEPTION 'account_grant_already_exists'; END IF;

  started := clock_timestamp();
  ending := started + INTERVAL '14 days';
  INSERT INTO public.account_access_grants(account_id, grant_type, plan_key, status, starts_at, expires_at, reason)
  VALUES(resolved_account_id, 'trial', 'pro', 'active', started, ending, 'Teste Pro de autosserviço por 14 dias');
  UPDATE public.account_billing SET trial_used_at = started WHERE account_billing.account_id = resolved_account_id;
  UPDATE public.trial_signups SET
    account_id = resolved_account_id,
    current_step = 3,
    status = 'trial_active',
    account_created_at = COALESCE(account_created_at, started),
    trial_started_at = started,
    trial_ends_at = ending
  WHERE id = signup.id;
  INSERT INTO public.trial_signup_events(trial_signup_id, event_type)
  VALUES (signup.id, 'trial_account_created'), (signup.id, 'trial_started')
  ON CONFLICT (trial_signup_id, event_type) DO NOTHING;

  RETURN QUERY SELECT resolved_account_id, started, ending;
END;
$$;

REVOKE ALL ON FUNCTION public.activate_confirmed_self_service_trial(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.activate_confirmed_self_service_trial(UUID, UUID) TO service_role;

-- Every tenant RLS policy already calls is_account_member(). Requiring a
-- confirmed identity and live billing/grant here makes the browser database
-- boundary fail closed for pending and expired users without rewriting dozens
-- of table-specific policies.
CREATE OR REPLACE FUNCTION public.is_account_member(
  target_account_id UUID,
  min_role public.account_role_enum DEFAULT 'viewer'
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id = auth.uid()
      AND u.email_confirmed_at IS NOT NULL
      AND p.account_id = target_account_id
      AND public.billing_account_has_access(target_account_id)
      AND CASE p.account_role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 WHEN 'viewer' THEN 1 END
        >= CASE min_role WHEN 'owner' THEN 4 WHEN 'admin' THEN 3 WHEN 'agent' THEN 2 WHEN 'viewer' THEN 1 END
  )
$$;

ALTER FUNCTION public.is_account_member(UUID, public.account_role_enum) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_account_member(UUID, public.account_role_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_member(UUID, public.account_role_enum) TO authenticated, service_role;

-- Keep only the minimum account shell readable for billing recovery after
-- expiry. Domain rows remain protected by is_account_member().
DROP POLICY IF EXISTS accounts_select ON public.accounts;
CREATE POLICY accounts_select ON public.accounts FOR SELECT
USING (
  owner_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.account_id = accounts.id)
);
