import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import type { AccessGrantRow, AccessOverridePlan, BillingRow, EffectiveAccountAccess, PlanKey } from './types'

const DAY_MS = 86_400_000
const toPlanKey = (plan: AccessOverridePlan): PlanKey => plan === 'basic' ? 'free' : plan
const isFuture = (value: string | null, now: Date) => !value || new Date(value).getTime() > now.getTime()

export function isActiveGrant(grant: AccessGrantRow, now = new Date()): boolean {
  return grant.status === 'active' && new Date(grant.starts_at).getTime() <= now.getTime() && isFuture(grant.expires_at, now)
}

function daysRemaining(expiresAt: string | null, now: Date): number | null {
  if (!expiresAt) return null
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / DAY_MS))
}

function grantAccess(grant: AccessGrantRow, active: boolean, now: Date): EffectiveAccountAccess {
  return {
    plan: toPlanKey(grant.plan_key), source: grant.grant_type,
    status: active ? 'active' : 'expired', startsAt: grant.starts_at,
    expiresAt: grant.expires_at, daysRemaining: daysRemaining(grant.expires_at, now),
    isActive: active, isPilot: grant.grant_type === 'pilot', isInternal: grant.grant_type === 'internal',
    hasStripeSubscription: false, access: active ? 'full' : 'restricted',
  }
}

export function resolveEffectiveAccountAccess(billing: BillingRow | null, grants: AccessGrantRow[], now = new Date()): EffectiveAccountAccess {
  grants = [...grants].sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime())
  const hasStripeSubscription = Boolean(billing?.provider_subscription_id)
  const activeInternal = grants.find((grant) => grant.grant_type === 'internal' && isActiveGrant(grant, now))
  if (activeInternal) return { ...grantAccess(activeInternal, true, now), hasStripeSubscription }

  if (billing?.access_override_plan && isFuture(billing.access_override_expires_at, now)) {
    return {
      plan: toPlanKey(billing.access_override_plan), source: 'internal', status: 'active',
      startsAt: null, expiresAt: billing.access_override_expires_at,
      daysRemaining: daysRemaining(billing.access_override_expires_at, now), isActive: true,
      isPilot: false, isInternal: true, hasStripeSubscription, access: 'full',
    }
  }

  if (billing?.subscription_status === 'active' || billing?.subscription_status === 'trialing') {
    return {
      plan: billing.plan_key, source: 'stripe', status: billing.subscription_status,
      startsAt: billing.current_period_start, expiresAt: billing.current_period_end,
      daysRemaining: null, isActive: true, isPilot: false, isInternal: false,
      hasStripeSubscription, access: 'full',
    }
  }
  if (billing?.subscription_status === 'past_due' && billing.grace_period_ends_at && new Date(billing.grace_period_ends_at).getTime() > now.getTime()) {
    return {
      plan: billing.plan_key, source: 'stripe', status: 'past_due', startsAt: billing.current_period_start,
      expiresAt: billing.grace_period_ends_at, daysRemaining: daysRemaining(billing.grace_period_ends_at, now),
      isActive: true, isPilot: false, isInternal: false, hasStripeSubscription, access: 'grace',
    }
  }

  const activePilot = grants.find((grant) => grant.grant_type === 'pilot' && isActiveGrant(grant, now))
  if (activePilot) return { ...grantAccess(activePilot, true, now), hasStripeSubscription }

  const expiredPilot = grants.find((grant) => grant.grant_type === 'pilot' && (grant.status === 'expired' || (grant.status === 'active' && !isFuture(grant.expires_at, now))))
  if (expiredPilot) return { ...grantAccess(expiredPilot, false, now), hasStripeSubscription }

  return {
    plan: 'free', source: 'none', status: billing?.subscription_status ?? 'none',
    startsAt: null, expiresAt: null, daysRemaining: null, isActive: false,
    isPilot: false, isInternal: false, hasStripeSubscription, access: 'restricted',
  }
}

type SupabaseErrorLike = { code?: string; message?: string }
export function isMissingAccessGrantsSchemaError(error: SupabaseErrorLike): boolean {
  if (error.code === '42P01' || error.code === 'PGRST205') return true
  const message = error.message?.toLowerCase() ?? ''
  return message.includes('account_access_grants') && (message.includes('does not exist') || message.includes('schema cache') || message.includes('could not find the table'))
}

export async function getEffectiveAccountAccess(accountId: string, db: SupabaseClient = supabaseAdmin(), now = new Date()): Promise<EffectiveAccountAccess> {
  const [billingResult, grantsResult] = await Promise.all([
    db.from('account_billing').select('*').eq('account_id', accountId).maybeSingle(),
    db.from('account_access_grants').select('*').eq('account_id', accountId),
  ])
  if (billingResult.error) throw new Error(`Could not load billing: ${billingResult.error.message}`)
  if (grantsResult.error && !isMissingAccessGrantsSchemaError(grantsResult.error)) throw new Error(`Could not load access grants: ${grantsResult.error.message}`)
  return resolveEffectiveAccountAccess(
    billingResult.data as BillingRow | null,
    grantsResult.error || !Array.isArray(grantsResult.data) ? [] : grantsResult.data as AccessGrantRow[],
    now,
  )
}

export function canOpenStripePortal(access: EffectiveAccountAccess): boolean {
  return !access.isInternal && access.hasStripeSubscription
}

export async function hasPilotGrantHistory(accountId: string, db: SupabaseClient = supabaseAdmin()): Promise<boolean> {
  const { count, error } = await db.from('account_access_grants').select('id', { count: 'exact', head: true }).eq('account_id', accountId).eq('grant_type', 'pilot')
  if (error && isMissingAccessGrantsSchemaError(error)) return false
  if (error) throw new Error(`Could not check pilot history: ${error.message}`)
  return (count ?? 0) > 0
}

export async function convertActivePilotGrant(db: SupabaseClient, accountId: string, convertedAt = new Date().toISOString()): Promise<void> {
  const { error } = await db.from('account_access_grants').update({ status: 'converted', converted_at: convertedAt }).eq('account_id', accountId).eq('grant_type', 'pilot').eq('status', 'active')
  if (error && !isMissingAccessGrantsSchemaError(error)) throw new Error(`Could not convert pilot grant: ${error.message}`)
}
