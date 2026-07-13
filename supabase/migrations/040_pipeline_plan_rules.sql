-- Pipeline commercial rules: Basic keeps one editable pipeline; Pro and
-- Business have no pipeline-count ceiling. Existing excess data is preserved.
UPDATE billing_plans
SET limits = jsonb_set(limits, '{pipelines}', 'null'::jsonb), updated_at = NOW()
WHERE key IN ('pro', 'business');

UPDATE billing_plans
SET name_pt_br = 'Basic', limits = jsonb_set(limits, '{pipelines}', '1'::jsonb), updated_at = NOW()
WHERE key = 'free';

ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_won BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pipeline_stages ADD COLUMN IF NOT EXISTS is_lost BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pipeline_stages DROP CONSTRAINT IF EXISTS pipeline_stage_single_outcome;
ALTER TABLE pipeline_stages ADD CONSTRAINT pipeline_stage_single_outcome CHECK (NOT (is_won AND is_lost));

UPDATE pipeline_stages SET is_won=TRUE WHERE lower(name) IN ('won','fechado','ganho') AND NOT is_lost;
UPDATE pipeline_stages SET is_lost=TRUE WHERE lower(name) IN ('lost','perdido','perda') AND NOT is_won;
CREATE UNIQUE INDEX IF NOT EXISTS one_won_stage_per_pipeline ON pipeline_stages(pipeline_id) WHERE is_won;
CREATE UNIQUE INDEX IF NOT EXISTS one_lost_stage_per_pipeline ON pipeline_stages(pipeline_id) WHERE is_lost;

CREATE OR REPLACE FUNCTION protect_last_basic_pipeline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE maximum BIGINT; remaining BIGINT;
BEGIN
  maximum := billing_limit_value(OLD.account_id, 'pipelines');
  IF maximum = 1 THEN
    SELECT count(*) INTO remaining FROM pipelines WHERE account_id=OLD.account_id AND id<>OLD.id;
    IF remaining = 0 THEN
      RAISE EXCEPTION 'pipeline_minimum_required' USING ERRCODE='P0001';
    END IF;
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS protect_last_basic_pipeline_delete ON pipelines;
CREATE TRIGGER protect_last_basic_pipeline_delete BEFORE DELETE ON pipelines
FOR EACH ROW EXECUTE FUNCTION protect_last_basic_pipeline();
