import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { BILLING_PLANS } from './catalog'
import { getEffectiveAccountAccess, resolveEffectiveAccountAccess } from './access'
import type { AccessGrantRow, AccountEntitlements, BillingFeature, BillingLimit, BillingRow, PlanKey } from './types'
import { FEATURES } from '@/config/features'

export class BillingAccessError extends Error {
  constructor(public readonly code: 'feature_unavailable' | 'limit_reached', public readonly detail: Record<string, unknown>) {
    super(code === 'limit_reached' ? 'Your plan limit has been reached' : 'This feature is not available on your plan')
    this.name = 'BillingAccessError'
  }
}

export function hasActiveAccessOverride(row: Pick<BillingRow, 'access_override_plan' | 'access_override_expires_at'> | null, now = new Date()): boolean {
  return Boolean(row?.access_override_plan && (!row.access_override_expires_at || new Date(row.access_override_expires_at) > now))
}

export function effectivePlanFor(row: BillingRow | null, now = new Date(), grants: AccessGrantRow[] = []): { plan: PlanKey; access: AccountEntitlements['access']; source: AccountEntitlements['source'] } {
  const effective = resolveEffectiveAccountAccess(row, grants, now)
  return { plan: effective.isActive ? effective.plan : 'free', access: effective.access, source: effective.source }
}

type SupabaseErrorLike = { code?: string; message?: string }

export function isMissingBillingSchemaError(error: SupabaseErrorLike): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('account_billing') && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table'))
}

function basicEntitlements(accountId: string): AccountEntitlements {
  const definition = BILLING_PLANS.free
  const effectiveAccess = resolveEffectiveAccountAccess(null, [])
  return { accountId, configuredPlan: 'free', effectivePlan: 'free', status: 'free', access: 'restricted', source: 'none', effectiveAccess, gracePeriodEndsAt: null, limits: definition.limits, features: { ...definition.features, automations: FEATURES.automations && definition.features.automations } }
}

function resolvedPlanDefinition(row: { limits?: unknown; features?: unknown } | null, fallback: typeof BILLING_PLANS[PlanKey]) {
  const rawLimits = row?.limits && typeof row.limits === 'object' ? row.limits as Record<string, unknown> : {}
  const rawFeatures = row?.features && typeof row.features === 'object' ? row.features as Record<string, unknown> : {}
  const limits = { ...fallback.limits }
  const features = { ...fallback.features }
  for (const key of Object.keys(limits) as BillingLimit[]) {
    const value = rawLimits[key]
    if (value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)) limits[key] = value
  }
  for (const key of Object.keys(features) as BillingFeature[]) {
    const value = rawFeatures[key]
    if (typeof value === 'boolean') features[key] = value
  }
  return { limits, features }
}

export async function getAccountEntitlements(accountId: string, db: SupabaseClient = supabaseAdmin()): Promise<AccountEntitlements> {
  let effectiveAccess
  try {
    effectiveAccess = await getEffectiveAccountAccess(accountId, db)
  } catch (error) {
    // Fail closed for installations that have not applied billing yet:
    // Basic grants no paid feature and retains every Basic limit.
    if (isMissingBillingSchemaError(error as SupabaseErrorLike)) {
      console.warn('[billing] account_billing unavailable; applying Basic entitlements')
      return basicEntitlements(accountId)
    }
    throw error
  }
  const plan = effectiveAccess.isActive ? effectiveAccess.plan : 'free'
  const fallbackDefinition = BILLING_PLANS[plan]
  const { data: planRow, error: planError } = await db.from('billing_plans').select('limits,features').eq('key', plan).maybeSingle()
  if (planError || !planRow) {
    console.error('[billing:entitlements]', { message: planError?.message ?? 'Effective billing plan is missing from billing_plans', code: planError?.code, details: planError?.details, hint: planError?.hint, accountId, effectivePlan: plan })
    throw new Error(`Could not load effective plan definition: ${planError?.message ?? plan}`)
  }
  const definition = resolvedPlanDefinition(planRow, fallbackDefinition)
  return { accountId, configuredPlan: plan, effectivePlan: plan, status: effectiveAccess.source === 'stripe' || effectiveAccess.source === 'trial' ? effectiveAccess.status as AccountEntitlements['status'] : 'free', access: effectiveAccess.access, source: effectiveAccess.source, effectiveAccess, gracePeriodEndsAt: effectiveAccess.access === 'grace' ? effectiveAccess.expiresAt : null, limits: definition.limits, features: { ...definition.features, automations: FEATURES.automations && definition.features.automations } }
}

export async function assertFeature(accountId: string, feature: BillingFeature, db?: SupabaseClient) {
  const entitlements = await getAccountEntitlements(accountId, db)
  if (!entitlements.features[feature]) throw new BillingAccessError('feature_unavailable', { feature, plan: entitlements.effectivePlan })
  return entitlements
}

export async function assertWithinLimit(accountId: string, limit: BillingLimit, currentUsage: number, increment = 1, db?: SupabaseClient) {
  const entitlements = await getAccountEntitlements(accountId, db)
  const maximum = entitlements.limits[limit]
  if (maximum !== null && currentUsage + increment > maximum) {
    console.error('[billing:limit]', { feature: limit, effectivePlan: entitlements.effectivePlan, limit: maximum, usage: currentUsage, requested: increment, accountId })
    throw new BillingAccessError('limit_reached', { limit, maximum, currentUsage, requested: increment, plan: entitlements.effectivePlan })
  }
  return entitlements
}

export async function incrementMonthlyUsage(accountId: string, metric: 'broadcast_recipients' | 'ai_replies', amount: number, idempotencyKey?: string) {
  const { error } = await supabaseAdmin().rpc('increment_billing_usage', { target_account_id: accountId, usage_metric: metric, usage_amount: amount, idempotency_key: idempotencyKey ?? null })
  if (error) throw new Error(`Could not record billing usage: ${error.message}`)
}

export async function getMonthlyUsage(accountId: string, metric: 'broadcast_recipients' | 'ai_replies', db: SupabaseClient = supabaseAdmin()) {
  const start = new Date(); start.setUTCDate(1); start.setUTCHours(0, 0, 0, 0)
  const { data, error } = await db.from('billing_usage_monthly').select('quantity').eq('account_id', accountId).eq('period_start', start.toISOString().slice(0, 10)).eq('metric', metric).maybeSingle()
  if (error) throw new Error(`Could not load billing usage: ${error.message}`)
  return Number(data?.quantity ?? 0)
}
