import { describe, expect, it } from 'vitest'
import type { AccessGrantRow, BillingRow, SubscriptionStatus } from './types'
import { BILLING_PLANS } from './catalog'
import type { SupabaseClient } from '@supabase/supabase-js'
import { canOpenStripePortal, convertActivePilotGrant, resolveEffectiveAccountAccess } from './access'

const now = new Date('2026-07-13T12:00:00Z')
function billing(status: SubscriptionStatus = 'free', overrides: Partial<BillingRow> = {}): BillingRow {
  return { account_id: 'account-1', provider_customer_id: null, provider_subscription_id: null, provider_price_id: null, plan_key: 'pro', billing_interval: null, subscription_status: status, current_period_start: null, current_period_end: null, trial_start: null, trial_end: null, trial_used_at: null, cancel_at_period_end: false, canceled_at: null, grace_period_ends_at: null, last_invoice_status: null, last_invoice_paid_at: null, last_payment_failed_at: null, last_provider_event_created_at: null, last_synced_at: null, access_override_plan: null, access_override_expires_at: null, access_override_reason: null, ...overrides }
}
function grant(type: 'pilot' | 'internal', overrides: Partial<AccessGrantRow> = {}): AccessGrantRow {
  return { id: `${type}-1`, account_id: 'account-1', grant_type: type, plan_key: 'pro', status: 'active', starts_at: '2026-07-01T00:00:00Z', expires_at: type === 'pilot' ? '2026-08-01T00:00:00Z' : null, reason: null, created_by: null, created_at: '2026-07-01T00:00:00Z', updated_at: '2026-07-01T00:00:00Z', revoked_at: null, converted_at: null, ...overrides }
}

describe('effective account access resolver', () => {
  it('does not grant Pro without Stripe or a grant', () => expect(resolveEffectiveAccountAccess(billing(), [], now)).toMatchObject({ plan: 'free', source: 'none', isActive: false }))
  it('gives an active Pro pilot exactly the Pro catalog permissions', () => {
    const access = resolveEffectiveAccountAccess(billing(), [grant('pilot')], now)
    expect(access).toMatchObject({ plan: 'pro', source: 'pilot', isActive: true, isPilot: true })
    expect(BILLING_PLANS[access.plan]).toBe(BILLING_PLANS.pro)
  })
  it('expires by date even while status is still active', () => expect(resolveEffectiveAccountAccess(billing(), [grant('pilot', { expires_at: '2026-07-12T00:00:00Z' })], now)).toMatchObject({ source: 'pilot', isActive: false, access: 'restricted', daysRemaining: 0 }))
  it('keeps permanent internal Pro active', () => expect(resolveEffectiveAccountAccess(billing(), [grant('internal')], now)).toMatchObject({ plan: 'pro', source: 'internal', isActive: true }))
  it('prioritizes internal, then Stripe, then pilot', () => {
    const paid = billing('active', { provider_subscription_id: 'sub_1' })
    expect(resolveEffectiveAccountAccess(paid, [grant('pilot'), grant('internal')], now).source).toBe('internal')
    expect(resolveEffectiveAccountAccess(paid, [grant('pilot')], now).source).toBe('stripe')
  })
  it('keeps paid Basic and Pro behavior', () => {
    expect(resolveEffectiveAccountAccess(billing('active', { plan_key: 'free' }), [], now).plan).toBe('free')
    expect(resolveEffectiveAccountAccess(billing('trialing', { plan_key: 'pro' }), [], now).plan).toBe('pro')
  })
  it('keeps a legacy billing override aligned with database enforcement', () => expect(resolveEffectiveAccountAccess(billing('free', { access_override_plan: 'pro' }), [], now)).toMatchObject({ plan: 'pro', source: 'internal', isActive: true }))
  it('keeps Stripe access during a valid past-due grace period', () => expect(resolveEffectiveAccountAccess(billing('past_due', { grace_period_ends_at: '2099-01-01T00:00:00Z' }), [], now)).toMatchObject({ plan: 'pro', source: 'stripe', isActive: true, access: 'grace' }))
  it('does not open Stripe Portal for a pilot without a subscription', () => expect(canOpenStripePortal(resolveEffectiveAccountAccess(billing(), [grant('pilot')], now))).toBe(false))
  it('marks the active pilot converted without deleting its history', async () => {
    let patch: Record<string, unknown> | undefined
    const filters: Array<[string, string]> = []
    const query = { eq: (column: string, value: string) => { filters.push([column, value]); return query }, then: (resolve: (value: unknown) => void) => resolve({ error: null }) }
    const db = { from: () => ({ update: (value: Record<string, unknown>) => { patch = value; return query } }) } as unknown as SupabaseClient
    await convertActivePilotGrant(db, 'account-1', '2026-07-13T12:00:00Z')
    expect(patch).toEqual({ status: 'converted', converted_at: '2026-07-13T12:00:00Z' })
    expect(filters).toContainEqual(['grant_type', 'pilot'])
    expect(filters).toContainEqual(['status', 'active'])
  })
})
