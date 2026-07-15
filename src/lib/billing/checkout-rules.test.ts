import { describe, expect, it } from 'vitest'
import { isCheckoutPlan, subscriptionBlocksCheckout } from './checkout-rules'

describe('Stripe checkout rules', () => {
  it('allows only the monthly self-service plans', () => {
    expect(isCheckoutPlan('free')).toBe(true)
    expect(isCheckoutPlan('pro')).toBe(true)
    expect(isCheckoutPlan('business')).toBe(false)
  })

  it.each(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])('blocks duplicate checkout for %s', (status) => {
    expect(subscriptionBlocksCheckout(status)).toBe(true)
  })
  it.each(['free', 'canceled', 'incomplete_expired'])('allows recovery checkout for %s', (status) => {
    expect(subscriptionBlocksCheckout(status)).toBe(false)
  })
})
