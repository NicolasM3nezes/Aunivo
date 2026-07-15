BEGIN;

-- Historical UI sentinels are presentation state, never business data.
UPDATE public.contacts
SET lead_source = NULL
WHERE lead_source IS NOT NULL
  AND lower(btrim(lead_source)) IN ('', '__none__', 'none', 'null', 'undefined');

-- Migration 038 gives every new personal account one untouched default
-- pipeline. The old redemption function treated that system-created row as
-- user data, preventing a fresh signup from accepting any invitation. Keep
-- the atomic move, but distinguish the exact default from real configuration.
CREATE OR REPLACE FUNCTION public.redeem_invitation(p_token_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_inv public.account_invitations%ROWTYPE;
  v_old_account_id UUID;
  v_old_account_owner UUID;
  v_default_pipeline_id UUID;
  v_has_data BOOLEAN;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_inv
  FROM public.account_invitations
  WHERE token_hash = p_token_hash
  FOR UPDATE;

  IF NOT FOUND OR v_inv.accepted_at IS NOT NULL OR v_inv.expires_at <= NOW() THEN
    RAISE EXCEPTION 'Invitation is not valid' USING ERRCODE = '22023';
  END IF;

  SELECT p.account_id, a.owner_user_id
  INTO v_old_account_id, v_old_account_owner
  FROM public.profiles AS p
  JOIN public.accounts AS a ON a.id = p.account_id
  WHERE p.user_id = v_caller_id;

  IF v_old_account_id IS NULL THEN
    RAISE EXCEPTION 'Caller has no profile' USING ERRCODE = '42501';
  END IF;
  IF v_old_account_id = v_inv.account_id THEN
    RAISE EXCEPTION 'Already a member' USING ERRCODE = '23505';
  END IF;
  IF v_old_account_owner <> v_caller_id THEN
    RAISE EXCEPTION 'Current account is shared' USING ERRCODE = '23505';
  END IF;

  SELECT id INTO v_default_pipeline_id
  FROM public.pipelines
  WHERE account_id = v_old_account_id
  ORDER BY created_at, id
  LIMIT 1;

  SELECT
    (SELECT count(*) <> 1 FROM public.profiles WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.contacts WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.conversations WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.deals WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.tasks WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.broadcasts WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.automations WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.flows WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.message_templates WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.tags WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.custom_fields WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.contact_notes WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.whatsapp_config WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.account_invitations WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.billing_usage_monthly WHERE account_id = v_old_account_id AND quantity > 0)
    OR EXISTS (SELECT 1 FROM public.billing_blocked_inbound WHERE account_id = v_old_account_id)
    OR EXISTS (SELECT 1 FROM public.account_access_grants WHERE account_id = v_old_account_id AND status = 'active')
    OR EXISTS (
      SELECT 1 FROM public.account_billing
      WHERE account_id = v_old_account_id
        AND (plan_key <> 'free' OR subscription_status <> 'free'
          OR provider_customer_id IS NOT NULL OR provider_subscription_id IS NOT NULL
          OR access_override_plan IS NOT NULL)
    )
    OR (SELECT count(*) > 1 FROM public.pipelines WHERE account_id = v_old_account_id)
    OR EXISTS (
      SELECT 1 FROM public.pipelines
      WHERE account_id = v_old_account_id
        AND (id <> v_default_pipeline_id OR name <> 'Funil principal' OR user_id <> v_caller_id)
    )
    OR (
      v_default_pipeline_id IS NOT NULL AND (
        (SELECT count(*) FROM public.pipeline_stages WHERE pipeline_id = v_default_pipeline_id) <> 6
        OR EXISTS (
          SELECT 1 FROM public.pipeline_stages
          WHERE pipeline_id = v_default_pipeline_id
            AND (position, name, is_won, is_lost) NOT IN (
              (0, 'Novo contato', FALSE, FALSE),
              (1, 'Em atendimento', FALSE, FALSE),
              (2, 'Orçamento enviado', FALSE, FALSE),
              (3, 'Negociação', FALSE, FALSE),
              (4, 'Fechado', TRUE, FALSE),
              (5, 'Perdido', FALSE, TRUE)
            )
        )
      )
    )
  INTO v_has_data;

  IF v_has_data THEN
    RAISE EXCEPTION 'Current account contains data' USING ERRCODE = '23505';
  END IF;

  UPDATE public.profiles
  SET account_id = v_inv.account_id, account_role = v_inv.role
  WHERE user_id = v_caller_id;

  UPDATE public.account_invitations
  SET accepted_at = NOW(), accepted_by_user_id = v_caller_id
  WHERE id = v_inv.id;

  DELETE FROM public.accounts WHERE id = v_old_account_id;
  RETURN v_inv.account_id;
END;
$$;

ALTER FUNCTION public.redeem_invitation(TEXT) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.redeem_invitation(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_invitation(TEXT) TO authenticated;

COMMIT;
