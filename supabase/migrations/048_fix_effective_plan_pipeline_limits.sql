-- Align database enforcement with the application resolver and the official
-- Basic / Pro / Business pipeline matrix. This preserves all billing guards,
-- RLS policies, subscriptions, overrides, grants, and existing pipelines.
BEGIN;

UPDATE public.billing_plans
SET limits = jsonb_set(
      jsonb_set(
        jsonb_set(limits, '{members}', '1'::jsonb),
        '{contacts}', '200'::jsonb),
      '{pipelines}', '1'::jsonb),
    updated_at = NOW()
WHERE key = 'free';

UPDATE public.billing_plans
SET limits = jsonb_set(
      jsonb_set(
        jsonb_set(limits, '{members}', '3'::jsonb),
        '{contacts}', '5000'::jsonb),
      '{pipelines}', '5'::jsonb),
    updated_at = NOW()
WHERE key = 'pro';

UPDATE public.billing_plans
SET limits = jsonb_set(limits, '{pipelines}', 'null'::jsonb), updated_at = NOW()
WHERE key = 'business';

-- Priority shared with src/lib/billing/access.ts: active internal grant,
-- active legacy internal override, Stripe access, active pilot, Basic/free.
CREATE OR REPLACE FUNCTION public.effective_billing_plan(target_account_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE lower(g.plan_key) WHEN 'basic' THEN 'free' ELSE lower(g.plan_key) END
       FROM public.account_access_grants AS g
      WHERE g.account_id = target_account_id AND g.grant_type = 'internal'
        AND g.status = 'active' AND g.starts_at <= NOW()
        AND (g.expires_at IS NULL OR g.expires_at > NOW())
      ORDER BY g.starts_at DESC LIMIT 1),
    (SELECT CASE lower(b.access_override_plan) WHEN 'basic' THEN 'free' ELSE lower(b.access_override_plan) END
       FROM public.account_billing AS b
      WHERE b.account_id = target_account_id AND b.access_override_plan IS NOT NULL
        AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at > NOW())),
    (SELECT CASE
        WHEN b.subscription_status IN ('active', 'trialing') THEN lower(b.plan_key)
        WHEN b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW() THEN lower(b.plan_key)
        ELSE NULL END
       FROM public.account_billing AS b WHERE b.account_id = target_account_id),
    (SELECT CASE lower(g.plan_key) WHEN 'basic' THEN 'free' ELSE lower(g.plan_key) END
       FROM public.account_access_grants AS g
      WHERE g.account_id = target_account_id AND g.grant_type = 'pilot'
        AND g.status = 'active' AND g.starts_at <= NOW() AND g.expires_at > NOW()
      ORDER BY g.starts_at DESC LIMIT 1),
    'free'
  )
$$;

CREATE OR REPLACE FUNCTION public.billing_account_has_access(target_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.account_access_grants AS g
    WHERE g.account_id = target_account_id AND g.status = 'active'
      AND g.starts_at <= NOW() AND (g.expires_at IS NULL OR g.expires_at > NOW())
  ) OR EXISTS (
    SELECT 1 FROM public.account_billing AS b
    WHERE b.account_id = target_account_id AND (
      (b.access_override_plan IS NOT NULL
        AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at > NOW()))
      OR b.subscription_status IN ('active', 'trialing')
      OR (b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW())
    )
  )
$$;

-- Reinstall dependent readers so a stale remote definition cannot keep
-- resolving the Basic row after effective_billing_plan is corrected.
CREATE OR REPLACE FUNCTION public.billing_limit_value(target_account_id UUID, limit_key TEXT)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' AND NOT public.billing_account_has_access(target_account_id) THEN 0
    WHEN p.limits -> limit_key = 'null'::jsonb THEN NULL
    ELSE (p.limits ->> limit_key)::BIGINT END
  FROM public.billing_plans AS p
  WHERE p.key = COALESCE(public.effective_billing_plan(target_account_id), 'free')
$$;

CREATE OR REPLACE FUNCTION public.billing_feature_enabled(target_account_id UUID, feature_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' AND NOT public.billing_account_has_access(target_account_id) THEN FALSE
    ELSE COALESCE((p.features ->> feature_key)::BOOLEAN, FALSE) END
  FROM public.billing_plans AS p
  WHERE p.key = COALESCE(public.effective_billing_plan(target_account_id), 'free')
$$;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_account_has_access(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_limit_value(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_feature_enabled(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_account_has_access(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_limit_value(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_feature_enabled(UUID, TEXT) TO service_role;

-- Keep the INSERT-only protection. Pipeline updates do not use this trigger.
DROP TRIGGER IF EXISTS billing_pipelines_insert ON public.pipelines;
CREATE TRIGGER billing_pipelines_insert BEFORE INSERT ON public.pipelines
FOR EACH ROW EXECUTE FUNCTION public.enforce_billing_insert('pipelines', 'pipelines');

-- PostgREST normally refreshes automatically after DDL, but an explicit
-- notification avoids serving the replaced function signatures from a stale
-- schema cache immediately after deployment.
NOTIFY pgrst, 'reload schema';

COMMIT;
