-- Secure internal/courtesy access, independent from Stripe subscriptions.
ALTER TABLE public.account_billing
  ADD COLUMN IF NOT EXISTS access_override_plan TEXT,
  ADD COLUMN IF NOT EXISTS access_override_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS access_override_reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.account_billing'::regclass
      AND conname = 'account_billing_access_override_plan_check'
  ) THEN
    ALTER TABLE public.account_billing
      ADD CONSTRAINT account_billing_access_override_plan_check
      CHECK (access_override_plan IS NULL OR access_override_plan IN ('basic', 'pro', 'business'));
  END IF;
END $$;

COMMENT ON COLUMN public.account_billing.access_override_plan IS
  'Administrative internal-access plan. This does not represent a Stripe subscription.';
COMMENT ON COLUMN public.account_billing.access_override_expires_at IS
  'Optional exclusive expiry for internal access. NULL means no expiry.';
COMMENT ON COLUMN public.account_billing.access_override_reason IS
  'Administrative audit context for internal access. Never accepted from browser input.';

-- Keep browser clients read-only. Only service_role or direct administrative SQL
-- can grant, change, or revoke internal access.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.account_billing FROM anon, authenticated;
GRANT SELECT ON public.account_billing TO authenticated;
GRANT ALL ON public.account_billing TO service_role;

-- Database enforcement uses the same precedence as the application DAL:
-- active internal override first, then Stripe, otherwise stable Basic/free.
CREATE OR REPLACE FUNCTION public.effective_billing_plan(target_account_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN b.access_override_plan IS NOT NULL
      AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at > NOW())
      THEN CASE b.access_override_plan WHEN 'basic' THEN 'free' ELSE b.access_override_plan END
    WHEN b.subscription_status IN ('active', 'trialing') THEN b.plan_key
    WHEN b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW() THEN b.plan_key
    ELSE 'free'
  END
  FROM public.account_billing b
  WHERE b.account_id = target_account_id
$$;

CREATE OR REPLACE FUNCTION public.billing_account_has_access(target_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (
      b.access_override_plan IS NOT NULL
      AND (b.access_override_expires_at IS NULL OR b.access_override_expires_at > NOW())
    ) OR
    b.subscription_status IN ('active', 'trialing') OR
    (b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW()),
    FALSE
  )
  FROM public.account_billing b
  WHERE b.account_id = target_account_id
$$;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_account_has_access(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_account_has_access(UUID) TO service_role;
