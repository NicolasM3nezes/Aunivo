import { afterEach, describe, expect, it } from 'vitest'
import { BILLING_PLANS, isBillingInterval, isPlanKey, planForPriceId, priceIdFor } from './catalog'

afterEach(() => {
  delete process.env.STRIPE_PRO_MONTHLY_PRICE_ID
  delete process.env.STRIPE_BASIC_MONTHLY_PRICE_ID
  delete process.env.STRIPE_PRO_YEARLY_PRICE_ID
  delete process.env.STRIPE_BUSINESS_MONTHLY_PRICE_ID
  delete process.env.STRIPE_BUSINESS_YEARLY_PRICE_ID
})

describe('billing catalog', () => {
  it('validates stable plan and interval keys', () => {
    expect(isPlanKey('free')).toBe(true); expect(isPlanKey('enterprise')).toBe(false)
    expect(isBillingInterval('yearly')).toBe(true); expect(isBillingInterval('weekly')).toBe(false)
  })
  it('represents unlimited limits as null and disabled usage as zero', () => {
    expect(BILLING_PLANS.business.limits.pipelines).toBeNull()
    expect(BILLING_PLANS.business.limits.members).toBeNull()
    expect(BILLING_PLANS.business.limits.ai_replies_monthly).toBeNull()
    expect(BILLING_PLANS.free.limits.broadcast_recipients_monthly).toBe(0)
    expect(BILLING_PLANS.free.limits.flows).toBe(0)
    expect(BILLING_PLANS.free.features.public_api).toBe(false)
  })
  it('uses Basic only as the display name for the stable free key', () => {
    expect(BILLING_PLANS.free.key).toBe('free')
    expect(BILLING_PLANS.free.name).toBe('Basic')
  })
  it('maps only allowlisted price ids', () => {
    process.env.STRIPE_BASIC_MONTHLY_PRICE_ID = 'price_basic_month'
    process.env.STRIPE_PRO_MONTHLY_PRICE_ID = 'price_pro_month'
    expect(priceIdFor('free', 'monthly')).toBe('price_basic_month')
    expect(priceIdFor('pro', 'monthly')).toBe('price_pro_month')
    expect(planForPriceId('price_pro_month')).toEqual({ planKey: 'pro', interval: 'monthly' })
    expect(planForPriceId('price_attacker')).toBeNull()
  })
  it('rejects missing configured price ids', () => {
    expect(() => priceIdFor('pro', 'yearly')).toThrow('Only monthly billing is available')
  })
})
