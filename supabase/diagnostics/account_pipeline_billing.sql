-- Read-only account entitlement diagnostic.
-- Replace the UUID before using the Supabase SQL editor.
WITH input AS (
  SELECT '00000000-0000-0000-0000-000000000000'::uuid AS account_id
),
active_grants AS (
  SELECT g.* FROM public.account_access_grants AS g
  JOIN input AS i ON i.account_id = g.account_id
  WHERE g.status = 'active' AND g.starts_at <= NOW()
    AND (g.expires_at IS NULL OR g.expires_at > NOW())
),
chosen_grant AS (
  SELECT g.* FROM active_grants AS g
  ORDER BY CASE g.grant_type WHEN 'internal' THEN 1 WHEN 'pilot' THEN 4 ELSE 5 END,
           g.starts_at DESC LIMIT 1
),
snapshot AS (
  SELECT i.account_id, b.plan_key AS billing_plan, b.subscription_status AS billing_status,
    b.provider_customer_id, b.provider_subscription_id,
    b.trial_start, b.trial_end, b.grace_period_ends_at,
    b.access_override_plan, b.access_override_expires_at,
    g.grant_type, g.plan_key AS grant_plan, g.starts_at AS grant_starts_at,
    g.expires_at AS grant_expires_at,
    public.effective_billing_plan(i.account_id) AS effective_plan,
    public.billing_limit_value(i.account_id, 'contacts') AS contacts_limit,
    (SELECT count(*) FROM public.contacts AS c WHERE c.account_id = i.account_id) AS contacts_used,
    public.billing_limit_value(i.account_id, 'pipelines') AS pipeline_limit,
    (SELECT count(*) FROM public.pipelines AS p WHERE p.account_id = i.account_id) AS pipelines_used,
    public.billing_limit_value(i.account_id, 'members') AS members_limit,
    (SELECT count(*) FROM public.profiles AS p WHERE p.account_id = i.account_id) AS members_used,
    (SELECT count(*) FROM public.account_invitations AS ai
      WHERE ai.account_id = i.account_id AND ai.accepted_at IS NULL AND ai.expires_at > NOW()) AS pending_invitations,
    jsonb_build_object(
      'reports', public.billing_feature_enabled(i.account_id, 'reports'),
      'custom_fields', public.billing_feature_enabled(i.account_id, 'custom_fields'),
      'flows', public.billing_feature_enabled(i.account_id, 'flows'),
      'knowledge_base', public.billing_feature_enabled(i.account_id, 'knowledge_base')
    ) AS premium_features
  FROM input AS i
  LEFT JOIN public.account_billing AS b ON b.account_id = i.account_id
  LEFT JOIN chosen_grant AS g ON TRUE
)
SELECT s.*,
  CASE
    WHEN EXISTS (SELECT 1 FROM active_grants g WHERE g.grant_type = 'internal') THEN 'active_internal_grant'
    WHEN s.access_override_plan IS NOT NULL
      AND (s.access_override_expires_at IS NULL OR s.access_override_expires_at > NOW()) THEN 'active_legacy_internal_override'
    WHEN s.billing_status IN ('active', 'trialing') THEN 'stripe_subscription'
    WHEN s.billing_status = 'past_due' AND s.grace_period_ends_at > NOW() THEN 'stripe_grace_period'
    WHEN EXISTS (SELECT 1 FROM active_grants g WHERE g.grant_type = 'pilot') THEN 'active_pilot_grant'
    ELSE 'basic_fallback' END AS plan_reason,
  CASE WHEN s.contacts_limit IS NULL THEN NULL ELSE GREATEST(s.contacts_limit - s.contacts_used, 0) END AS contacts_remaining,
  CASE WHEN s.pipeline_limit IS NULL THEN NULL ELSE GREATEST(s.pipeline_limit - s.pipelines_used, 0) END AS pipelines_remaining,
  CASE WHEN s.members_limit IS NULL THEN NULL ELSE GREATEST(s.members_limit - s.members_used - s.pending_invitations, 0) END AS member_slots_remaining,
  s.contacts_limit IS NULL OR s.contacts_used < s.contacts_limit AS can_create_contact,
  s.pipeline_limit IS NULL OR s.pipelines_used < s.pipeline_limit AS can_create_pipeline,
  s.members_limit IS NULL OR s.members_used + s.pending_invitations < s.members_limit AS can_invite_member,
  s.grant_type = 'pilot' AS is_pilot,
  s.grant_type = 'internal' OR s.access_override_plan IS NOT NULL AS is_internal,
  s.grant_plan IS NOT NULL
    AND (CASE lower(s.grant_plan) WHEN 'basic' THEN 'free' ELSE lower(s.grant_plan) END) IS DISTINCT FROM lower(COALESCE(s.billing_plan, 'free')) AS billing_grant_divergence
FROM snapshot AS s;
