import { describe, expect, it } from 'vitest'
import { effectivePlanFor, getAccountEntitlements, isMissingBillingSchemaError } from './entitlements'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BillingRow, SubscriptionStatus } from './types'

function row(status: SubscriptionStatus, overrides: Partial<BillingRow> = {}): BillingRow {
  return { account_id: 'a', provider_customer_id: 'cus', provider_subscription_id: 'sub', provider_price_id: 'price', plan_key: 'pro', billing_interval: 'monthly', subscription_status: status, current_period_start: null, current_period_end: null, trial_start: null, trial_end: null, cancel_at_period_end: false, canceled_at: null, grace_period_ends_at: null, last_invoice_status: null, last_provider_event_created_at: null, last_synced_at: null, ...overrides }
}

describe('effective billing access', () => {
  it.each(['active','trialing'] as const)('keeps paid access for %s', (status) => expect(effectivePlanFor(row(status)).plan).toBe('pro'))
  it('keeps access when cancellation is scheduled', () => expect(effectivePlanFor(row('active', { cancel_at_period_end: true })).plan).toBe('pro'))
  it('keeps past_due access inside grace', () => expect(effectivePlanFor(row('past_due', { grace_period_ends_at: '2099-01-01T00:00:00Z' })).access).toBe('grace'))
  it('restricts past_due after grace', () => expect(effectivePlanFor(row('past_due', { grace_period_ends_at: '2020-01-01T00:00:00Z' })).plan).toBe('free'))
  it.each(['canceled','unpaid','paused','incomplete_expired'] as const)('restricts %s', (status) => expect(effectivePlanFor(row(status)).access).toBe('restricted'))
  it('defaults missing billing rows to Free', () => expect(effectivePlanFor(null).plan).toBe('free'))
})

describe('billing schema compatibility', () => {
  it('recognizes only missing-table/schema-cache errors', () => {
    expect(isMissingBillingSchemaError({ code: '42P01', message: 'relation missing' })).toBe(true)
    expect(isMissingBillingSchemaError({ code: 'PGRST205', message: "Could not find the table 'account_billing' in the schema cache" })).toBe(true)
    expect(isMissingBillingSchemaError({ code: '42501', message: 'permission denied' })).toBe(false)
  })

  it('fails closed to Basic when billing has not been migrated yet', async () => {
    const terminal = Promise.resolve({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'account_billing' in the schema cache" } })
    const query = { select: () => query, eq: () => query, maybeSingle: () => terminal }
    const db = { from: () => query } as unknown as SupabaseClient
    const result = await getAccountEntitlements('account-1', db)
    expect(result.effectivePlan).toBe('free')
    expect(result.features.automations).toBe(true)
    expect(result.limits.automations).toBe(1)
  })

  it('does not hide permission or connectivity failures', async () => {
    const terminal = Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } })
    const query = { select: () => query, eq: () => query, maybeSingle: () => terminal }
    const db = { from: () => query } as unknown as SupabaseClient
    await expect(getAccountEntitlements('account-1', db)).rejects.toThrow('permission denied')
  })
})
