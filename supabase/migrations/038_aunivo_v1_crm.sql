-- Additive, idempotent defaults required by Aunivo V1.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS estimated_value NUMERIC(12,2) CHECK (estimated_value IS NULL OR estimated_value >= 0);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_contact_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
CREATE INDEX IF NOT EXISTS idx_contacts_account_follow_up ON contacts(account_id, next_follow_up_at) WHERE is_active;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo';

INSERT INTO account_billing(account_id) SELECT id FROM accounts ON CONFLICT(account_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.ensure_v1_account_defaults(target_account_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE owner_id UUID; v_pipeline_id UUID;
BEGIN
  SELECT owner_user_id INTO owner_id FROM accounts WHERE id=target_account_id;
  IF owner_id IS NULL THEN RETURN; END IF;
  INSERT INTO account_billing(account_id) VALUES(target_account_id) ON CONFLICT(account_id) DO NOTHING;
  SELECT id INTO v_pipeline_id FROM pipelines WHERE account_id=target_account_id ORDER BY created_at,id LIMIT 1;
  IF v_pipeline_id IS NULL THEN
    INSERT INTO pipelines(user_id,account_id,name) VALUES(owner_id,target_account_id,'Funil principal') RETURNING id INTO v_pipeline_id;
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pipeline_stages WHERE pipeline_id=v_pipeline_id) THEN
    INSERT INTO pipeline_stages(pipeline_id,name,position,color) VALUES
      (v_pipeline_id,'Novo contato',0,'#3b82f6'),(v_pipeline_id,'Em atendimento',1,'#06b6d4'),
      (v_pipeline_id,'Orçamento enviado',2,'#8b5cf6'),(v_pipeline_id,'Negociação',3,'#f59e0b'),
      (v_pipeline_id,'Fechado',4,'#22c55e'),(v_pipeline_id,'Perdido',5,'#ef4444');
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.ensure_v1_account_defaults(UUID) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_v1_account_defaults(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.create_v1_defaults_for_account() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
  PERFORM public.ensure_v1_account_defaults(NEW.id); RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_account_create_v1_defaults ON accounts;
CREATE TRIGGER on_account_create_v1_defaults AFTER INSERT ON accounts FOR EACH ROW EXECUTE FUNCTION public.create_v1_defaults_for_account();
DO $$ DECLARE row RECORD; BEGIN FOR row IN SELECT id FROM accounts LOOP PERFORM public.ensure_v1_account_defaults(row.id); END LOOP; END $$;
