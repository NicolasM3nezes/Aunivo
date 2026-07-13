-- Complete the paid Basic / Pro subscription lifecycle without changing the
-- stable internal plan keys (Basic continues to be stored as "free").
ALTER TABLE public.account_billing
  ADD COLUMN IF NOT EXISTS trial_used_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_invoice_paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_payment_failed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.account_billing.trial_used_at IS
  'Permanent account-level marker for the single Pro trial. Never clear this on cancellation.';

DROP POLICY IF EXISTS account_billing_owner_read ON public.account_billing;
DROP POLICY IF EXISTS account_billing_member_read ON public.account_billing;
CREATE POLICY account_billing_member_read ON public.account_billing
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id, 'viewer'));

-- Browser clients cannot bypass the application gate by writing directly to
-- Supabase. Internal bootstrap/service-role work remains possible so account
-- creation can still install its initial defaults before checkout.
CREATE OR REPLACE FUNCTION public.billing_account_has_access(target_account_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    b.subscription_status IN ('active', 'trialing') OR
    (b.subscription_status = 'past_due' AND b.grace_period_ends_at > NOW()),
    FALSE
  )
  FROM public.account_billing b
  WHERE b.account_id = target_account_id
$$;

CREATE OR REPLACE FUNCTION public.billing_limit_value(target_account_id UUID, limit_key TEXT)
RETURNS BIGINT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' AND NOT public.billing_account_has_access(target_account_id) THEN 0
    WHEN p.limits->limit_key = 'null'::jsonb THEN NULL
    ELSE (p.limits->>limit_key)::BIGINT
  END
  FROM public.billing_plans p
  WHERE p.key = COALESCE(public.effective_billing_plan(target_account_id), 'free')
$$;

CREATE OR REPLACE FUNCTION public.billing_feature_enabled(target_account_id UUID, feature_key TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.role() = 'authenticated' AND NOT public.billing_account_has_access(target_account_id) THEN FALSE
    ELSE COALESCE((p.features->>feature_key)::BOOLEAN, FALSE)
  END
  FROM public.billing_plans p
  WHERE p.key = COALESCE(public.effective_billing_plan(target_account_id), 'free')
$$;

REVOKE ALL ON FUNCTION public.billing_account_has_access(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_account_has_access(UUID) TO service_role;
