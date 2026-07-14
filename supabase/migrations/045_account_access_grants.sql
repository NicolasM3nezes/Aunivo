-- Time-bound pilot access and auditable internal access grants.
-- Grants are independent from Stripe and are writable only by service_role or
-- direct administrative SQL. No grant is created by this migration.
CREATE TABLE IF NOT EXISTS public.account_access_grants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  grant_type TEXT NOT NULL,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.account_access_grants'::regclass AND conname = 'account_access_grants_type_check') THEN
    ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_type_check CHECK (grant_type IN ('pilot', 'internal'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.account_access_grants'::regclass AND conname = 'account_access_grants_plan_check') THEN
    ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_plan_check CHECK (plan_key IN ('basic', 'pro', 'business'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.account_access_grants'::regclass AND conname = 'account_access_grants_status_check') THEN
    ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_status_check CHECK (status IN ('active', 'revoked', 'expired', 'converted'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.account_access_grants'::regclass AND conname = 'account_access_grants_pilot_expiry_check') THEN
    ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_pilot_expiry_check CHECK (grant_type <> 'pilot' OR expires_at IS NOT NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.account_access_grants'::regclass AND conname = 'account_access_grants_expiry_order_check') THEN
    ALTER TABLE public.account_access_grants ADD CONSTRAINT account_access_grants_expiry_order_check CHECK (expires_at IS NULL OR expires_at > starts_at);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_account_access_grants_account ON public.account_access_grants(account_id);
CREATE INDEX IF NOT EXISTS idx_account_access_grants_status ON public.account_access_grants(status);
CREATE INDEX IF NOT EXISTS idx_account_access_grants_expires ON public.account_access_grants(expires_at) WHERE expires_at IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_access_grants_one_active
  ON public.account_access_grants(account_id) WHERE status = 'active';

DROP TRIGGER IF EXISTS set_updated_at ON public.account_access_grants;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.account_access_grants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.account_access_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS account_access_grants_read ON public.account_access_grants;
DROP POLICY IF EXISTS account_access_grants_write ON public.account_access_grants;
REVOKE ALL ON public.account_access_grants FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.account_access_grants TO service_role;

-- Stable internal plan key mapping: database plan "free" is displayed as Basic.
CREATE OR REPLACE FUNCTION public.effective_billing_plan(target_account_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT CASE g.plan_key WHEN 'basic' THEN 'free' ELSE g.plan_key END
       FROM public.account_access_grants g
      WHERE g.account_id = target_account_id AND g.grant_type = 'internal'
        AND g.status = 'active' AND g.starts_at <= NOW()
        AND (g.expires_at IS NULL OR g.expires_at > NOW())
      ORDER BY g.starts_at DESC LIMIT 1),
    (SELECT CASE b.access_override_plan WHEN 'basic' THEN 'free' ELSE b.access_override_plan END
       FROM public.account_billing b
      WHERE b.account_id = target_account_id AND b.access_override_plan IS NOT NULL
        AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at > NOW())),
    (SELECT CASE
        WHEN b.subscription_status IN ('active', 'trialing') THEN b.plan_key
        WHEN b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW() THEN b.plan_key
        ELSE NULL END
       FROM public.account_billing b WHERE b.account_id = target_account_id),
    (SELECT CASE g.plan_key WHEN 'basic' THEN 'free' ELSE g.plan_key END
       FROM public.account_access_grants g
      WHERE g.account_id = target_account_id AND g.grant_type = 'pilot'
        AND g.status = 'active' AND g.starts_at <= NOW()
        AND g.expires_at > NOW()
      ORDER BY g.starts_at DESC LIMIT 1),
    'free'
  )
$$;

CREATE OR REPLACE FUNCTION public.billing_account_has_access(target_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    EXISTS (
      SELECT 1 FROM public.account_access_grants g
      WHERE g.account_id = target_account_id AND g.status = 'active'
        AND g.starts_at <= NOW() AND (g.expires_at IS NULL OR g.expires_at > NOW())
    ) OR EXISTS (
      SELECT 1 FROM public.account_billing b
      WHERE b.account_id = target_account_id AND (
        (b.access_override_plan IS NOT NULL AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at > NOW())) OR
        b.subscription_status IN ('active', 'trialing') OR
        (b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW())
      )
    ), FALSE
  )
$$;

-- Sanitized membership-scoped gate for proxy.ts. It reveals one boolean and
-- never exposes grant rows, reasons, creators, account ids, plans, or dates.
CREATE OR REPLACE FUNCTION public.current_account_has_billing_access(target_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_account_member(target_account_id, 'viewer')
    AND public.billing_account_has_access(target_account_id)
$$;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_account_has_access(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_account_has_billing_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_account_has_access(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.current_account_has_billing_access(UUID) TO authenticated, service_role;
