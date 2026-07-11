-- Align persisted enforcement with the official Basic/Pro/Business matrix.
-- Plan keys remain free/pro/business; only the free display label changes.
UPDATE billing_plans SET
  name_pt_br = 'Basic', name_en = 'Basic',
  limits = '{"members":1,"contacts":200,"pipelines":1,"automations":1,"flows":0,"ai_agents":0,"broadcast_recipients_monthly":0,"ai_replies_monthly":25}'::jsonb,
  updated_at = NOW()
WHERE key = 'free';

UPDATE billing_plans SET
  limits = '{"members":3,"contacts":5000,"pipelines":5,"automations":25,"flows":10,"ai_agents":3,"broadcast_recipients_monthly":5000,"ai_replies_monthly":2000}'::jsonb,
  updated_at = NOW()
WHERE key = 'pro';

UPDATE billing_plans SET
  limits = '{"members":null,"contacts":null,"pipelines":null,"automations":null,"flows":null,"ai_agents":null,"broadcast_recipients_monthly":null,"ai_replies_monthly":null}'::jsonb,
  updated_at = NOW()
WHERE key = 'business';

-- Draft automations do not consume the active-automation allowance.
DROP TRIGGER IF EXISTS billing_automations_insert ON automations;

CREATE OR REPLACE FUNCTION enforce_active_automation_billing() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE maximum BIGINT; used BIGINT;
BEGIN
  IF NOT NEW.is_active THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.is_active THEN RETURN NEW; END IF;
  IF NOT billing_feature_enabled(NEW.account_id, 'automations') THEN
    RAISE EXCEPTION 'billing_feature_unavailable:automations' USING ERRCODE='P0001';
  END IF;
  maximum := billing_limit_value(NEW.account_id, 'automations');
  IF maximum IS NOT NULL THEN
    SELECT count(*) INTO used FROM automations WHERE account_id=NEW.account_id AND is_active;
    IF used >= maximum THEN
      RAISE EXCEPTION 'billing_limit_reached:automations:%',maximum USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS billing_automations_active ON automations;
CREATE TRIGGER billing_automations_active
BEFORE INSERT OR UPDATE OF is_active ON automations
FOR EACH ROW EXECUTE FUNCTION enforce_active_automation_billing();

-- Flows are both feature-gated and quantity-limited.
DROP TRIGGER IF EXISTS billing_flows_insert ON flows;
CREATE TRIGGER billing_flows_insert BEFORE INSERT ON flows FOR EACH ROW
EXECUTE FUNCTION enforce_billing_insert('flows','flows');
