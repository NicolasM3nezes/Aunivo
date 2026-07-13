import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { BILLING_PLANS } from './catalog'
import type { AccountEntitlements, BillingFeature, BillingLimit, BillingRow, PlanKey } from './types'

export class BillingAccessError extends Error {
  constructor(public readonly code: 'feature_unavailable' | 'limit_reached', public readonly detail: Record<string, unknown>) {
    super(code === 'limit_reached' ? 'Your plan limit has been reached' : 'This feature is not available on your plan')
    this.name = 'BillingAccessError'
  }
}

export function effectivePlanFor(row: BillingRow | null, now = new Date()): { plan: PlanKey; access: AccountEntitlements['access'] } {
  if (!row) return { plan: 'free', access: 'restricted' }
  if (row.subscription_status === 'active' || row.subscription_status === 'trialing') return { plan: row.plan_key, access: 'full' }
  if (row.subscription_status === 'past_due' && row.grace_period_ends_at && new Date(row.grace_period_ends_at) > now) return { plan: row.plan_key, access: 'grace' }
  return { plan: 'free', access: 'restricted' }
}

type SupabaseErrorLike = { code?: string; message?: string }

export function isMissingBillingSchemaError(error: SupabaseErrorLike): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('account_billing') && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table'))
}

function basicEntitlements(accountId: string): AccountEntitlements {
  const definition = BILLING_PLANS.free
  return { accountId, configuredPlan: 'free', effectivePlan: 'free', status: 'free', access: 'restricted', gracePeriodEndsAt: null, limits: definition.limits, features: definition.features }
}

export async function getAccountEntitlements(accountId: string, db: SupabaseClient = supabaseAdmin()): Promise<AccountEntitlements> {
  const { data, error } = await db.from('account_billing').select('*').eq('account_id', accountId).maybeSingle()
  if (error) {
    // Fail closed for installations that have not applied billing yet:
    // Basic grants no paid feature and retains every Basic limit.
    if (isMissingBillingSchemaError(error)) {
      console.warn('[billing] account_billing unavailable; applying Basic entitlements')
      return basicEntitlements(accountId)
    }
    throw new Error(`Could not load billing: ${error.message}`)
  }
  const row = data as BillingRow | null
  const effective = effectivePlanFor(row)
  const definition = BILLING_PLANS[effective.plan]
  return { accountId, configuredPlan: row?.plan_key ?? 'free', effectivePlan: effective.plan, status: row?.subscription_status ?? 'free', access: effective.access, gracePeriodEndsAt: row?.grace_period_ends_at ?? null, limits: definition.limits, features: definition.features }
}

export async function assertFeature(accountId: string, feature: BillingFeature, db?: SupabaseClient) {
  const entitlements = await getAccountEntitlements(accountId, db)
  if (!entitlements.features[feature]) throw new BillingAccessError('feature_unavailable', { feature, plan: entitlements.effectivePlan })
  return entitlements
}

export async function assertWithinLimit(accountId: string, limit: BillingLimit, currentUsage: number, increment = 1, db?: SupabaseClient) {
  const entitlements = await getAccountEntitlements(accountId, db)
  const maximum = entitlements.limits[limit]
  if (maximum !== null && currentUsage + increment > maximum) throw new BillingAccessError('limit_reached', { limit, maximum, currentUsage, requested: increment, plan: entitlements.effectivePlan })
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
