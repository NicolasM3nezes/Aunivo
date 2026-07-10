import { describe, expect, it } from 'vitest'
import { effectivePlanFor } from './entitlements'
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
