import { describe, expect, it } from 'vitest'
import type { EffectiveAccountAccess } from './types'
import { pilotPresentationState } from './presentation'

const access = (overrides: Partial<EffectiveAccountAccess> = {}): EffectiveAccountAccess => ({
  plan: 'pro', source: 'pilot', status: 'active', startsAt: '2026-07-01T00:00:00Z',
  expiresAt: '2026-08-01T00:00:00Z', daysRemaining: 19, isActive: true,
  isPilot: true, isInternal: false, hasStripeSubscription: false, access: 'full', ...overrides,
})

describe('pilot billing presentation', () => {
  it('shows the regular active pilot state', () => expect(pilotPresentationState(access())).toBe('active'))
  it('highlights the final seven days', () => expect(pilotPresentationState(access({ daysRemaining: 7 }))).toBe('ending_soon'))
  it('shows the safe-data expiry message after access ends', () => expect(pilotPresentationState(access({ isActive: false, access: 'restricted', daysRemaining: 0 }))).toBe('expired'))
  it('does not show pilot UI for Stripe customers', () => expect(pilotPresentationState(access({ source: 'stripe', isPilot: false }))).toBe('none'))
})
