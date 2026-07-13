-- READ-ONLY preflight for migrations 035 through 042.
-- Safe to run in the Supabase SQL Editor before any migration push.

-- 1. Migration history recorded by the CLI.
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
WHERE version >= '035'
ORDER BY version;

-- 2. Expected public objects and whether RLS is enabled.
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
FROM pg_catalog.pg_class c
JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND c.relname = ANY (ARRAY[
    'quick_replies', 'billing_plans', 'account_billing',
    'billing_webhook_events', 'billing_usage_monthly',
    'billing_usage_idempotency', 'billing_blocked_inbound',
    'tasks', 'notification_preferences', 'notifications'
  ])
ORDER BY c.relname;

-- 3. Policies currently installed on the audited tables.
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY[
    'profiles', 'accounts', 'contacts', 'pipelines', 'pipeline_stages',
    'deals', 'tasks', 'notifications', 'notification_preferences',
    'automations', 'conversations', 'messages', 'account_billing'
  ])
ORDER BY tablename, policyname;

-- 4. Columns expected by the code after 035-042.
SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'messages' AND column_name = 'interactive_payload') OR
    (table_name = 'accounts' AND column_name IN ('default_currency', 'timezone')) OR
    (table_name = 'contacts' AND column_name IN (
      'estimated_value', 'last_contact_at', 'next_follow_up_at', 'lead_source', 'is_active'
    )) OR
    (table_name = 'pipeline_stages' AND column_name IN ('is_won', 'is_lost')) OR
    (table_name = 'notifications' AND column_name IN ('task_id', 'dedupe_key')) OR
    table_name IN ('tasks', 'notification_preferences')
  )
ORDER BY table_name, ordinal_position;

-- 5. Preflight for migration 040. Any returned row can make its partial
-- unique indexes fail and must be reviewed without deleting data blindly.
-- This form works both before and after is_won/is_lost are added.
SELECT pipeline_id,
       CASE
         WHEN lower(name) IN ('won', 'fechado', 'ganho') THEN 'won'
         ELSE 'lost'
       END AS outcome,
       count(*) AS matching_stages,
       array_agg(id ORDER BY position, id) AS stage_ids
FROM public.pipeline_stages
WHERE lower(name) IN ('won', 'fechado', 'ganho', 'lost', 'perdido', 'perda')
GROUP BY pipeline_id, outcome
HAVING count(*) > 1;

-- 6. Signup/bootstrap integrity. Every query should return zero rows.
SELECT u.id, u.email FROM auth.users u
LEFT JOIN public.profiles p ON p.user_id = u.id
WHERE p.user_id IS NULL;

SELECT p.user_id, p.account_id FROM public.profiles p
LEFT JOIN public.accounts a ON a.id = p.account_id
WHERE p.account_id IS NULL OR a.id IS NULL;

SELECT a.id AS account_id FROM public.accounts a
LEFT JOIN public.account_billing b ON b.account_id = a.id
WHERE b.account_id IS NULL;

SELECT a.id AS account_id FROM public.accounts a
LEFT JOIN public.pipelines p ON p.account_id = a.id
WHERE p.id IS NULL;

SELECT p.user_id FROM public.profiles p
LEFT JOIN public.notification_preferences np ON np.user_id = p.user_id
WHERE np.user_id IS NULL;

-- 7. Task tenancy invariants. Every query should return zero rows.
SELECT t.id, 'creator' AS invalid_relation FROM public.tasks t
LEFT JOIN public.profiles p ON p.user_id = t.created_by AND p.account_id = t.account_id
WHERE p.user_id IS NULL
UNION ALL
SELECT t.id, 'assignee' FROM public.tasks t
LEFT JOIN public.profiles p ON p.user_id = t.assigned_to AND p.account_id = t.account_id
WHERE t.assigned_to IS NOT NULL AND p.user_id IS NULL
UNION ALL
SELECT t.id, 'contact' FROM public.tasks t
LEFT JOIN public.contacts c ON c.id = t.contact_id AND c.account_id = t.account_id
WHERE t.contact_id IS NOT NULL AND c.id IS NULL
UNION ALL
SELECT t.id, 'deal' FROM public.tasks t
LEFT JOIN public.deals d ON d.id = t.deal_id AND d.account_id = t.account_id
WHERE t.deal_id IS NOT NULL AND d.id IS NULL;

-- 8. Notification idempotency and recipient/account consistency.
SELECT user_id, dedupe_key, count(*)
FROM public.notifications
WHERE dedupe_key IS NOT NULL
GROUP BY user_id, dedupe_key
HAVING count(*) > 1;

SELECT n.id, n.user_id, n.account_id
FROM public.notifications n
LEFT JOIN public.profiles p ON p.user_id = n.user_id AND p.account_id = n.account_id
WHERE p.user_id IS NULL;

-- 9. Effective plan rows after 037/040. Review; this query changes nothing.
SELECT key, name_pt_br, limits, features
FROM public.billing_plans
ORDER BY sort_order;

-- 10. SECURITY DEFINER functions and their ACLs after hardening.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       pg_catalog.pg_get_function_identity_arguments(p.oid) AS arguments,
       p.prosecdef AS security_definer,
       p.proconfig AS settings,
       p.proacl AS acl
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY p.proname, arguments;
