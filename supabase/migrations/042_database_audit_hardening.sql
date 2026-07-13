-- Security and consistency follow-ups found by the database audit.
-- Additive/idempotent: no table, column or business row is removed.

-- Internal SECURITY DEFINER helpers must not be callable directly by clients.
-- Their owning triggers/functions continue to execute normally; operational
-- server paths retain explicit service_role access where useful.
REVOKE ALL ON FUNCTION public._bcast_bump(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_broadcast_counts(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recompute_broadcast_counts(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.record_webhook_failure(UUID, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_webhook_failure(UUID, INTEGER) TO service_role;

REVOKE ALL ON FUNCTION public.effective_billing_plan(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_limit_value(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.billing_feature_enabled(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.effective_billing_plan(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_limit_value(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_feature_enabled(UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.touch_presence(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_presence(TEXT) TO authenticated;

-- Preserve the task's tenancy/audit identity during updates. Relationship
-- checks continue to guarantee that assignee/contact/deal belong to the same
-- account as the task.
CREATE OR REPLACE FUNCTION public.validate_task_relations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
      RAISE EXCEPTION 'task_account_is_immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'task_created_by_is_immutable' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = NEW.created_by AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'task_created_by_account_mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = NEW.assigned_to AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'task_assignee_account_mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.contact_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.contacts
    WHERE id = NEW.contact_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'task_contact_account_mismatch' USING ERRCODE = '23514';
  END IF;
  IF NEW.deal_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.deals
    WHERE id = NEW.deal_id AND account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'task_deal_account_mismatch' USING ERRCODE = '23514';
  END IF;

  NEW.updated_at := NOW();
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := COALESCE(NEW.completed_at, NOW());
  END IF;
  IF NEW.status <> 'completed' THEN NEW.completed_at := NULL; END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.validate_task_relations() FROM PUBLIC, anon, authenticated;

-- A reassignment away and back to the same teammate is a new event. Include
-- the row's updated_at in the key while retaining database deduplication for
-- accidental duplicate execution of the same event.
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  enabled BOOLEAN;
  event_key TEXT;
BEGIN
  IF NEW.assigned_to IS NULL
     OR NEW.assigned_to = auth.uid()
     OR (TG_OP = 'UPDATE' AND NEW.assigned_to IS NOT DISTINCT FROM OLD.assigned_to) THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(task_assigned, TRUE) INTO enabled
  FROM public.notification_preferences
  WHERE user_id = NEW.assigned_to;

  IF COALESCE(enabled, TRUE) THEN
    event_key := 'task:' || NEW.id || ':assigned:' || NEW.assigned_to || ':' || NEW.updated_at;
    INSERT INTO public.notifications (
      account_id, user_id, type, task_id, actor_user_id, title, body, dedupe_key
    ) VALUES (
      NEW.account_id, NEW.assigned_to, 'task_assigned', NEW.id, auth.uid(),
      'Nova tarefa atribuída', NEW.title, event_key
    )
    ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Task assignment notification failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_task_assigned() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER notification_preferences_updated_at
BEFORE UPDATE ON public.notification_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Existing users receive explicit defaults. ON CONFLICT preserves every
-- preference already chosen by a user.
INSERT INTO public.notification_preferences (user_id)
SELECT user_id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Keep signup atomic while also seeding notification preferences. Replacing
-- the function preserves the existing trigger binding; the trigger is then
-- re-created defensively for installations where it was removed manually.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_full_name TEXT := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_account_id UUID;
BEGIN
  SELECT account_id INTO v_account_id
  FROM public.profiles WHERE user_id = NEW.id;
  IF v_account_id IS NOT NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_account_id
  FROM public.accounts
  WHERE owner_user_id = NEW.id
  ORDER BY created_at
  LIMIT 1;

  IF v_account_id IS NULL THEN
    INSERT INTO public.accounts (name, owner_user_id, default_currency, timezone)
    VALUES (
      COALESCE(NULLIF(v_full_name, ''), NEW.email, 'Minha empresa'),
      NEW.id, 'BRL', 'America/Sao_Paulo'
    )
    RETURNING id INTO v_account_id;
  END IF;

  INSERT INTO public.profiles (user_id, full_name, email, account_id, account_role)
  VALUES (NEW.id, v_full_name, NEW.email, v_account_id, 'owner')
  ON CONFLICT (user_id) DO UPDATE SET
    account_id = COALESCE(public.profiles.account_id, EXCLUDED.account_id),
    account_role = COALESCE(public.profiles.account_role, 'owner');

  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM public.ensure_v1_account_defaults(v_account_id);
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
