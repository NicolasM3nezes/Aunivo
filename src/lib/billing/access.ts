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
    status: active ? (grant.grant_type === 'trial' ? 'trialing' : 'active') : 'expired', startsAt: grant.starts_at,
    expiresAt: grant.expires_at, daysRemaining: daysRemaining(grant.expires_at, now),
    isActive: active, isPilot: grant.grant_type === 'pilot', isInternal: grant.grant_type === 'internal',
    isTrial: grant.grant_type === 'trial',
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
      daysRemaining: daysRemaining(billing.access_override_expires_at, now),
      isActive: true, isPilot: false, isInternal: true, isTrial: false,
      hasStripeSubscription, access: 'full',
    }
  }

  const activePilot = grants.find((grant) => grant.grant_type === 'pilot' && isActiveGrant(grant, now))
  if (activePilot) return { ...grantAccess(activePilot, true, now), hasStripeSubscription }

  const inGrace = billing?.subscription_status === 'past_due'
    && Boolean(billing.grace_period_ends_at)
    && isFuture(billing.grace_period_ends_at, now)
  if (billing?.subscription_status === 'active' || billing?.subscription_status === 'trialing' || inGrace) {
    return {
      plan: billing.plan_key, source: 'stripe', status: billing.subscription_status,
      startsAt: billing.current_period_start,
      expiresAt: inGrace ? billing.grace_period_ends_at : billing.current_period_end,
      daysRemaining: null, isActive: true, isPilot: false, isInternal: false, isTrial: false,
      hasStripeSubscription, access: inGrace ? 'grace' : 'full',
    }
  }
  const activeTrial = grants.find((grant) => grant.grant_type === 'trial' && isActiveGrant(grant, now))
  if (activeTrial) return { ...grantAccess(activeTrial, true, now), hasStripeSubscription }

  const expiredTrial = grants.find((grant) => grant.grant_type === 'trial' && (grant.status === 'expired' || (grant.status === 'active' && !isFuture(grant.expires_at, now))))
  if (expiredTrial) return { ...grantAccess(expiredTrial, false, now), hasStripeSubscription }

  const expiredPilot = grants.find((grant) => grant.grant_type === 'pilot' && (grant.status === 'expired' || (grant.status === 'active' && !isFuture(grant.expires_at, now))))
  if (expiredPilot) return { ...grantAccess(expiredPilot, false, now), hasStripeSubscription }

  return {
    plan: 'free', source: 'none', status: billing?.subscription_status ?? 'none',
    startsAt: null, expiresAt: null, daysRemaining: null, isActive: false,
    isPilot: false, isInternal: false, isTrial: false, hasStripeSubscription, access: 'restricted',
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
  if (billingResult.error || grantsResult.error) {
    const error = billingResult.error ?? grantsResult.error
    console.error('[billing:entitlements]', { message: error?.message, code: error?.code, details: error?.details, hint: error?.hint, accountId })
    throw new Error(`${billingResult.error ? 'Could not load billing' : 'Could not load access grants'}: ${error?.message}`)
  }
  const access = resolveEffectiveAccountAccess(
    billingResult.data as BillingRow | null,
    Array.isArray(grantsResult.data) ? grantsResult.data as AccessGrantRow[] : [],
    now,
  )
  if (access.source === 'trial' && !access.isActive && access.status === 'expired') {
    const { data: signup, error: expiryError } = await db.from('trial_signups').update({ status: 'trial_expired' }).eq('account_id', accountId).eq('status', 'trial_active').select('id').maybeSingle()
    if (!expiryError && signup?.id) await db.from('trial_signup_events').insert({ trial_signup_id: signup.id, event_type: 'trial_expired' })
    const { error: grantError } = await db.from('account_access_grants').update({ status: 'expired' }).eq('account_id', accountId).eq('grant_type', 'trial').eq('status', 'active')
    if (expiryError && expiryError.code !== '42P01' && expiryError.code !== 'PGRST205') console.error('[billing:trial-expiry]', { accountId, code: expiryError.code })
    if (grantError && !isMissingAccessGrantsSchemaError(grantError)) console.error('[billing:trial-expiry-grant]', { accountId, code: grantError.code })
  }
  return access
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

export async function convertActiveTrialGrant(db: SupabaseClient, accountId: string, convertedAt = new Date().toISOString()): Promise<void> {
  const { error } = await db.from('account_access_grants').update({ status: 'converted', converted_at: convertedAt }).eq('account_id', accountId).eq('grant_type', 'trial').in('status', ['active', 'expired'])
  if (error && !isMissingAccessGrantsSchemaError(error)) throw new Error(`Could not convert trial grant: ${error.message}`)

  const { data: signup, error: signupError } = await db.from('trial_signups').update({ status: 'converted', converted_at: convertedAt }).eq('account_id', accountId).in('status', ['trial_active', 'trial_expired']).select('id').maybeSingle()
  if (signupError && signupError.code !== '42P01' && signupError.code !== 'PGRST205') throw new Error(`Could not convert trial signup: ${signupError.message}`)
  if (signup?.id) {
    const { error: eventError } = await db.from('trial_signup_events').insert({ trial_signup_id: signup.id, event_type: 'subscription_started' })
    if (eventError && eventError.code !== '42P01' && eventError.code !== 'PGRST205') throw new Error(`Could not record trial conversion: ${eventError.message}`)
  }
}
