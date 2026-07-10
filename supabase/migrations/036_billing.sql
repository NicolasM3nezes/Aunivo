-- Aunivo account-level billing, Stripe synchronization and monthly usage.
CREATE TABLE IF NOT EXISTS billing_plans (
  key TEXT PRIMARY KEY CHECK (key IN ('free','pro','business')),
  name_pt_br TEXT NOT NULL, name_en TEXT NOT NULL,
  description_pt_br TEXT, description_en TEXT,
  sort_order INTEGER NOT NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE,
  limits JSONB NOT NULL, features JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO billing_plans (key,name_pt_br,name_en,description_pt_br,description_en,sort_order,limits,features) VALUES
('free','Grátis','Free','Para começar a organizar suas vendas.','Start organizing your sales.',1,
 '{"members":1,"contacts":200,"pipelines":1,"automations":1,"broadcast_recipients_monthly":0,"ai_replies_monthly":25}',
 '{"contacts":true,"shared_inbox":false,"whatsapp":true,"pipelines":true,"dashboard":true,"custom_fields":false,"broadcasts":false,"automations":true,"flows":false,"ai_drafts":true,"ai_auto_reply":false,"knowledge_base":false,"reports":false,"public_api":false,"external_webhooks":false,"mcp":false,"advanced_permissions":false}'),
('pro','Pro','Pro','Automação e IA para equipes em crescimento.','Automation and AI for growing teams.',2,
 '{"members":3,"contacts":5000,"pipelines":5,"automations":25,"broadcast_recipients_monthly":5000,"ai_replies_monthly":2000}',
 '{"contacts":true,"shared_inbox":true,"whatsapp":true,"pipelines":true,"dashboard":true,"custom_fields":true,"broadcasts":true,"automations":true,"flows":true,"ai_drafts":true,"ai_auto_reply":true,"knowledge_base":true,"reports":true,"public_api":false,"external_webhooks":false,"mcp":false,"advanced_permissions":false}'),
('business','Business','Business','Escala, integrações e limites ampliados.','Scale, integrations and expanded limits.',3,
 '{"members":10,"contacts":50000,"pipelines":null,"automations":null,"broadcast_recipients_monthly":50000,"ai_replies_monthly":20000}',
 '{"contacts":true,"shared_inbox":true,"whatsapp":true,"pipelines":true,"dashboard":true,"custom_fields":true,"broadcasts":true,"automations":true,"flows":true,"ai_drafts":true,"ai_auto_reply":true,"knowledge_base":true,"reports":true,"public_api":true,"external_webhooks":true,"mcp":true,"advanced_permissions":true}')
ON CONFLICT (key) DO UPDATE SET limits=EXCLUDED.limits,features=EXCLUDED.features,updated_at=NOW();

CREATE TABLE IF NOT EXISTS account_billing (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe' CHECK (provider IN ('stripe')),
  provider_customer_id TEXT UNIQUE, provider_subscription_id TEXT UNIQUE, provider_price_id TEXT,
  plan_key TEXT NOT NULL DEFAULT 'free' REFERENCES billing_plans(key),
  billing_interval TEXT CHECK (billing_interval IS NULL OR billing_interval IN ('monthly','yearly')),
  subscription_status TEXT NOT NULL DEFAULT 'free' CHECK (subscription_status IN ('free','trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused')),
  current_period_start TIMESTAMPTZ, current_period_end TIMESTAMPTZ,
  trial_start TIMESTAMPTZ, trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE, canceled_at TIMESTAMPTZ,
  grace_period_ends_at TIMESTAMPTZ, last_invoice_status TEXT,
  last_provider_event_created_at TIMESTAMPTZ, last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_account_billing_status ON account_billing(subscription_status);

CREATE TABLE IF NOT EXISTS billing_webhook_events (
  provider_event_id TEXT PRIMARY KEY, event_type TEXT NOT NULL, object_id TEXT, livemode BOOLEAN NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'processing' CHECK (processing_status IN ('processing','processed','failed')),
  attempts INTEGER NOT NULL DEFAULT 0, error_message TEXT, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), processed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS billing_usage_monthly (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL DEFAULT date_trunc('month', CURRENT_DATE)::date,
  metric TEXT NOT NULL CHECK (metric IN ('broadcast_recipients','ai_replies')),
  quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(account_id,period_start,metric)
);
CREATE TABLE IF NOT EXISTS billing_usage_idempotency (
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(account_id,idempotency_key)
);
CREATE TABLE IF NOT EXISTS billing_blocked_inbound (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  provider_message_id TEXT NOT NULL UNIQUE, sender_phone TEXT NOT NULL, contact_name TEXT,
  message_type TEXT NOT NULL, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), reason TEXT NOT NULL DEFAULT 'contacts_limit',
  recovered_at TIMESTAMPTZ
);

INSERT INTO account_billing(account_id) SELECT id FROM accounts ON CONFLICT(account_id) DO NOTHING;
CREATE OR REPLACE FUNCTION create_free_billing_for_account() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN INSERT INTO account_billing(account_id) VALUES(NEW.id) ON CONFLICT(account_id) DO NOTHING; RETURN NEW; END $$;
DROP TRIGGER IF EXISTS on_account_create_billing ON accounts;
CREATE TRIGGER on_account_create_billing AFTER INSERT ON accounts FOR EACH ROW EXECUTE FUNCTION create_free_billing_for_account();

CREATE OR REPLACE FUNCTION increment_billing_usage(target_account_id UUID, usage_metric TEXT, usage_amount BIGINT, idempotency_key TEXT DEFAULT NULL)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result BIGINT;
BEGIN
  IF usage_amount < 0 OR usage_metric NOT IN ('broadcast_recipients','ai_replies') THEN RAISE EXCEPTION 'invalid billing usage'; END IF;
  IF idempotency_key IS NOT NULL THEN
    INSERT INTO billing_usage_idempotency(account_id,idempotency_key) VALUES(target_account_id,idempotency_key) ON CONFLICT DO NOTHING;
    IF NOT FOUND THEN SELECT quantity INTO result FROM billing_usage_monthly WHERE account_id=target_account_id AND period_start=date_trunc('month',CURRENT_DATE)::date AND metric=usage_metric; RETURN COALESCE(result,0); END IF;
  END IF;
  INSERT INTO billing_usage_monthly(account_id,period_start,metric,quantity) VALUES(target_account_id,date_trunc('month',CURRENT_DATE)::date,usage_metric,usage_amount)
  ON CONFLICT(account_id,period_start,metric) DO UPDATE SET quantity=billing_usage_monthly.quantity+EXCLUDED.quantity,updated_at=NOW()
  RETURNING quantity INTO result; RETURN result;
END $$;

ALTER TABLE billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_billing ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_blocked_inbound ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS billing_plans_read ON billing_plans;
CREATE POLICY billing_plans_read ON billing_plans FOR SELECT TO authenticated USING(is_active);
DROP POLICY IF EXISTS account_billing_owner_read ON account_billing;
CREATE POLICY account_billing_owner_read ON account_billing FOR SELECT TO authenticated USING(is_account_member(account_id,'owner'));
DROP POLICY IF EXISTS billing_usage_member_read ON billing_usage_monthly;
CREATE POLICY billing_usage_member_read ON billing_usage_monthly FOR SELECT TO authenticated USING(is_account_member(account_id,'viewer'));
REVOKE ALL ON account_billing,billing_webhook_events,billing_usage_monthly,billing_usage_idempotency FROM anon,authenticated;
GRANT SELECT ON billing_plans TO authenticated;
GRANT SELECT ON account_billing TO authenticated;
GRANT SELECT ON billing_usage_monthly TO authenticated;
GRANT ALL ON billing_plans,account_billing,billing_webhook_events,billing_usage_monthly,billing_usage_idempotency TO service_role;
REVOKE ALL ON billing_blocked_inbound FROM anon,authenticated;
GRANT ALL ON billing_blocked_inbound TO service_role;
REVOKE ALL ON FUNCTION increment_billing_usage(UUID,TEXT,BIGINT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION increment_billing_usage(UUID,TEXT,BIGINT,TEXT) TO service_role;

-- Billing notification types; retries are deduplicated by provider event id in the webhook table.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK(type IN (
 'conversation_assigned','billing_subscription_activated','billing_payment_confirmed','billing_payment_failed',
 'billing_payment_action_required','billing_cancel_scheduled','billing_canceled','billing_trial_ending','billing_grace_ending','billing_limit_warning','billing_limit_reached'
));

-- Database boundary: direct browser writes and service-role workers are held to
-- the same account limits. Existing rows remain readable/editable after downgrade.
CREATE OR REPLACE FUNCTION effective_billing_plan(target_account_id UUID) RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE
  WHEN b.subscription_status IN ('active','trialing') THEN b.plan_key
  WHEN b.subscription_status='past_due' AND b.grace_period_ends_at>NOW() THEN b.plan_key
  ELSE 'free' END
 FROM account_billing b WHERE b.account_id=target_account_id
$$;
CREATE OR REPLACE FUNCTION billing_limit_value(target_account_id UUID, limit_key TEXT) RETURNS BIGINT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN p.limits->limit_key='null'::jsonb THEN NULL ELSE (p.limits->>limit_key)::BIGINT END
 FROM billing_plans p WHERE p.key=COALESCE(effective_billing_plan(target_account_id),'free')
$$;
CREATE OR REPLACE FUNCTION billing_feature_enabled(target_account_id UUID, feature_key TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT COALESCE((p.features->>feature_key)::BOOLEAN,FALSE) FROM billing_plans p WHERE p.key=COALESCE(effective_billing_plan(target_account_id),'free')
$$;
CREATE OR REPLACE FUNCTION enforce_billing_insert() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE maximum BIGINT; used BIGINT; feature_key TEXT; limit_key TEXT;
BEGIN
 feature_key:=TG_ARGV[0]; limit_key:=TG_ARGV[1];
 IF feature_key<>'' AND NOT billing_feature_enabled(NEW.account_id,feature_key) THEN RAISE EXCEPTION 'billing_feature_unavailable:%',feature_key USING ERRCODE='P0001'; END IF;
 IF limit_key<>'' THEN
  maximum:=billing_limit_value(NEW.account_id,limit_key);
  IF maximum IS NOT NULL THEN EXECUTE format('SELECT count(*) FROM %I WHERE account_id=$1',TG_TABLE_NAME) INTO used USING NEW.account_id;
   IF used>=maximum THEN RAISE EXCEPTION 'billing_limit_reached:%:%',limit_key,maximum USING ERRCODE='P0001'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION enforce_member_billing() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE maximum BIGINT; used BIGINT;
BEGIN
 IF NEW.account_id IS NULL OR (TG_OP='UPDATE' AND NEW.account_id IS NOT DISTINCT FROM OLD.account_id) THEN RETURN NEW; END IF;
 maximum:=billing_limit_value(NEW.account_id,'members');
 SELECT count(*) INTO used FROM profiles WHERE account_id=NEW.account_id;
 IF maximum IS NOT NULL AND used>=maximum THEN RAISE EXCEPTION 'billing_limit_reached:members:%',maximum USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION enforce_invitation_billing() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE maximum BIGINT; used BIGINT;
BEGIN
 maximum:=billing_limit_value(NEW.account_id,'members');
 SELECT (SELECT count(*) FROM profiles WHERE account_id=NEW.account_id)+(SELECT count(*) FROM account_invitations WHERE account_id=NEW.account_id AND accepted_at IS NULL AND expires_at>NOW()) INTO used;
 IF maximum IS NOT NULL AND used>=maximum THEN RAISE EXCEPTION 'billing_limit_reached:members:%',maximum USING ERRCODE='P0001'; END IF;
 RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS billing_contacts_insert ON contacts; CREATE TRIGGER billing_contacts_insert BEFORE INSERT ON contacts FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('contacts','contacts');
DROP TRIGGER IF EXISTS billing_pipelines_insert ON pipelines; CREATE TRIGGER billing_pipelines_insert BEFORE INSERT ON pipelines FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('pipelines','pipelines');
DROP TRIGGER IF EXISTS billing_automations_insert ON automations; CREATE TRIGGER billing_automations_insert BEFORE INSERT ON automations FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('automations','automations');
DROP TRIGGER IF EXISTS billing_broadcasts_insert ON broadcasts; CREATE TRIGGER billing_broadcasts_insert BEFORE INSERT ON broadcasts FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('broadcasts','');
DROP TRIGGER IF EXISTS billing_flows_insert ON flows; CREATE TRIGGER billing_flows_insert BEFORE INSERT ON flows FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('flows','');
DROP TRIGGER IF EXISTS billing_api_keys_insert ON api_keys; CREATE TRIGGER billing_api_keys_insert BEFORE INSERT ON api_keys FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('public_api','');
DROP TRIGGER IF EXISTS billing_webhook_endpoints_insert ON webhook_endpoints; CREATE TRIGGER billing_webhook_endpoints_insert BEFORE INSERT ON webhook_endpoints FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('external_webhooks','');
DROP TRIGGER IF EXISTS billing_knowledge_insert ON ai_knowledge_documents; CREATE TRIGGER billing_knowledge_insert BEFORE INSERT ON ai_knowledge_documents FOR EACH ROW EXECUTE FUNCTION enforce_billing_insert('knowledge_base','');
DROP TRIGGER IF EXISTS billing_profiles_membership ON profiles; CREATE TRIGGER billing_profiles_membership BEFORE INSERT OR UPDATE OF account_id ON profiles FOR EACH ROW EXECUTE FUNCTION enforce_member_billing();
DROP TRIGGER IF EXISTS billing_invitations_insert ON account_invitations; CREATE TRIGGER billing_invitations_insert BEFORE INSERT ON account_invitations FOR EACH ROW EXECUTE FUNCTION enforce_invitation_billing();
