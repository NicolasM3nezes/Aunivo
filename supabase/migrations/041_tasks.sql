-- Tasks, per-user notification preferences and task alerts.
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((status = 'completed' AND completed_at IS NOT NULL) OR status <> 'completed')
);

CREATE INDEX IF NOT EXISTS idx_tasks_account_due ON tasks(account_id, due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due ON tasks(assigned_to, due_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_contact ON tasks(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_deal ON tasks(deal_id) WHERE deal_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_task_relations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE user_id=NEW.created_by AND account_id=NEW.account_id) THEN
    RAISE EXCEPTION 'task_created_by_account_mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (SELECT 1 FROM profiles WHERE user_id=NEW.assigned_to AND account_id=NEW.account_id) THEN
    RAISE EXCEPTION 'task_assignee_account_mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM contacts WHERE id=NEW.contact_id AND account_id=NEW.account_id) THEN
    RAISE EXCEPTION 'task_contact_account_mismatch' USING ERRCODE='23514';
  END IF;
  IF NEW.deal_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM deals WHERE id=NEW.deal_id AND account_id=NEW.account_id) THEN
    RAISE EXCEPTION 'task_deal_account_mismatch' USING ERRCODE='23514';
  END IF;
  NEW.updated_at := NOW();
  IF NEW.status='completed' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN NEW.completed_at:=COALESCE(NEW.completed_at,NOW()); END IF;
  IF NEW.status<>'completed' THEN NEW.completed_at:=NULL; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS validate_task_relations_trigger ON tasks;
CREATE TRIGGER validate_task_relations_trigger BEFORE INSERT OR UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_relations();

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tasks_select ON tasks;
DROP POLICY IF EXISTS tasks_insert ON tasks;
DROP POLICY IF EXISTS tasks_update ON tasks;
DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_select ON tasks FOR SELECT USING (is_account_member(account_id,'viewer'));
CREATE POLICY tasks_insert ON tasks FOR INSERT WITH CHECK (is_account_member(account_id,'agent') AND created_by=auth.uid());
CREATE POLICY tasks_update ON tasks FOR UPDATE USING (is_account_member(account_id,'agent')) WITH CHECK (is_account_member(account_id,'agent'));
CREATE POLICY tasks_delete ON tasks FOR DELETE USING (is_account_member(account_id,'agent'));

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  task_assigned BOOLEAN NOT NULL DEFAULT TRUE,
  task_due_today BOOLEAN NOT NULL DEFAULT TRUE,
  task_overdue BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notification_preferences_select ON notification_preferences;
DROP POLICY IF EXISTS notification_preferences_insert ON notification_preferences;
DROP POLICY IF EXISTS notification_preferences_update ON notification_preferences;
CREATE POLICY notification_preferences_select ON notification_preferences FOR SELECT USING (user_id=auth.uid());
CREATE POLICY notification_preferences_insert ON notification_preferences FOR INSERT WITH CHECK (user_id=auth.uid());
CREATE POLICY notification_preferences_update ON notification_preferences FOR UPDATE USING (user_id=auth.uid()) WITH CHECK (user_id=auth.uid());

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_task_dedupe ON notifications(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL;
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK(type IN (
 'conversation_assigned','billing_subscription_activated','billing_payment_confirmed','billing_payment_failed',
 'billing_payment_action_required','billing_cancel_scheduled','billing_canceled','billing_trial_ending','billing_grace_ending',
 'billing_limit_warning','billing_limit_reached','task_assigned','task_due_today','task_overdue'
));

CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE enabled BOOLEAN;
BEGIN
  IF NEW.assigned_to IS NULL OR NEW.assigned_to=auth.uid() OR (TG_OP='UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to) THEN RETURN NEW; END IF;
  SELECT COALESCE(task_assigned,TRUE) INTO enabled FROM notification_preferences WHERE user_id=NEW.assigned_to;
  IF COALESCE(enabled,TRUE) THEN
    INSERT INTO notifications(account_id,user_id,type,task_id,actor_user_id,title,body,dedupe_key)
    VALUES(NEW.account_id,NEW.assigned_to,'task_assigned',NEW.id,auth.uid(),'Nova tarefa atribuída',NEW.title,'task:'||NEW.id||':assigned:'||NEW.assigned_to)
    ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Task assignment notification failed: %',SQLERRM; RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS on_task_assigned ON tasks;
CREATE TRIGGER on_task_assigned AFTER INSERT OR UPDATE OF assigned_to ON tasks FOR EACH ROW EXECUTE FUNCTION public.notify_task_assigned();

CREATE OR REPLACE FUNCTION public.sync_my_task_notifications()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE inserted_count INTEGER:=0; tz TEXT; pref notification_preferences%ROWTYPE; row tasks%ROWTYPE; kind TEXT; local_day DATE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE='42501'; END IF;
  SELECT COALESCE(a.timezone,'America/Sao_Paulo') INTO tz FROM profiles p JOIN accounts a ON a.id=p.account_id WHERE p.user_id=auth.uid();
  SELECT * INTO pref FROM notification_preferences WHERE user_id=auth.uid();
  local_day := (NOW() AT TIME ZONE COALESCE(tz,'America/Sao_Paulo'))::DATE;
  FOR row IN SELECT t.* FROM tasks t WHERE t.status='pending' AND COALESCE(t.assigned_to,t.created_by)=auth.uid() AND t.due_at IS NOT NULL LOOP
    kind:=NULL;
    IF (row.due_at AT TIME ZONE tz)::DATE < local_day AND COALESCE(pref.task_overdue,TRUE) THEN kind:='task_overdue';
    ELSIF (row.due_at AT TIME ZONE tz)::DATE = local_day AND COALESCE(pref.task_due_today,TRUE) THEN kind:='task_due_today'; END IF;
    IF kind IS NOT NULL THEN
      INSERT INTO notifications(account_id,user_id,type,task_id,title,body,dedupe_key)
      VALUES(row.account_id,auth.uid(),kind,row.id,CASE WHEN kind='task_overdue' THEN 'Tarefa atrasada' ELSE 'Tarefa para hoje' END,row.title,'task:'||row.id||':'||kind||':'||local_day)
      ON CONFLICT(user_id,dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
      IF FOUND THEN inserted_count:=inserted_count+1; END IF;
    END IF;
  END LOOP;
  RETURN inserted_count;
END $$;
REVOKE ALL ON FUNCTION public.sync_my_task_notifications() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.sync_my_task_notifications() TO authenticated;
