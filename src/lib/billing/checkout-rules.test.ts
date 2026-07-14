import { describe, expect, it } from 'vitest'
import { isCheckoutPlan, shouldApplyProTrial, subscriptionBlocksCheckout } from './checkout-rules'

describe('Stripe checkout rules', () => {
  it('allows only the monthly self-service plans', () => {
    expect(isCheckoutPlan('free')).toBe(true)
    expect(isCheckoutPlan('pro')).toBe(true)
    expect(isCheckoutPlan('business')).toBe(false)
  })

  it('never gives Basic a trial', () => expect(shouldApplyProTrial('free', null)).toBe(false))
  it('gives Pro one account-level trial', () => {
    expect(shouldApplyProTrial('pro', null)).toBe(true)
    expect(shouldApplyProTrial('pro', '2026-07-13T12:00:00Z')).toBe(false)
  })
  it('never stacks the Pro trial after pilot access', () => {
    expect(shouldApplyProTrial('pro', null, true)).toBe(false)
  })

  it.each(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])('blocks duplicate checkout for %s', (status) => {
    expect(subscriptionBlocksCheckout(status)).toBe(true)
  })
  it.each(['free', 'canceled', 'incomplete_expired'])('allows recovery checkout for %s', (status) => {
    expect(subscriptionBlocksCheckout(status)).toBe(false)
  })
})
