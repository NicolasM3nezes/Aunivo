import { describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncStripeSubscription } from './sync'

describe('Stripe billing synchronization', () => {
  it('updates only Stripe-owned fields and preserves access overrides', async () => {
    vi.stubEnv('STRIPE_PRO_MONTHLY_PRICE_ID', 'price_pro')
    let updatePatch: Record<string, unknown> | undefined
    const existing = {
      account_id: 'account-1',
      provider_customer_id: 'cus_1',
      last_provider_event_created_at: null,
      grace_period_ends_at: null,
      subscription_status: 'free',
    }
    const selectQuery = {
      select: () => selectQuery,
      eq: () => selectQuery,
      maybeSingle: () => Promise.resolve({ data: existing, error: null }),
    }
    const updateQuery = { eq: () => Promise.resolve({ error: null }) }
    const db = {
      from: () => ({
        ...selectQuery,
        update: (patch: Record<string, unknown>) => {
          updatePatch = patch
          return updateQuery
        },
      }),
    } as unknown as SupabaseClient
    const subscription = {
      id: 'sub_1',
      customer: 'cus_1',
      status: 'active',
      metadata: { account_id: 'account-1' },
      items: { data: [{ price: { id: 'price_pro' }, current_period_start: 1, current_period_end: 2 }] },
      trial_start: null,
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
    } as unknown as Stripe.Subscription

    await syncStripeSubscription(db, 'account-1', subscription, 3)

    expect(updatePatch).toMatchObject({
      provider_subscription_id: 'sub_1',
      subscription_status: 'active',
      plan_key: 'pro',
    })
    expect(updatePatch).not.toHaveProperty('access_override_plan')
    expect(updatePatch).not.toHaveProperty('access_override_expires_at')
    expect(updatePatch).not.toHaveProperty('access_override_reason')
  })
})
