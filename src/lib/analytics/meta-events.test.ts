import { afterEach, describe, expect, it, vi } from 'vitest'
import { paidPlanParameters, trackContact, trackInitiateCheckout, trackLead } from './meta-events'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Meta Pixel events', () => {
  it('does not throw when fbq is unavailable', () => {
    vi.stubGlobal('window', {})
    expect(() => trackLead()).not.toThrow()
  })

  it('tracks a successful lead without personal data', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackLead()
    expect(fbq).toHaveBeenCalledWith('track', 'Lead', {
      content_name: 'Teste gratuito Aunivo',
      content_category: 'SaaS Lead',
      value: 0,
      currency: 'BRL',
    }, expect.objectContaining({ eventID: expect.stringMatching(/^lead:/) }))
    expect(JSON.stringify(fbq.mock.calls)).not.toMatch(/email|phone|password/i)
  })

  it('uses centralized numeric prices for checkout', () => {
    expect(paidPlanParameters('free')).toMatchObject({ value: 12.9, currency: 'BRL', content_ids: ['aunivo-basic'] })
    expect(paidPlanParameters('pro')).toMatchObject({ value: 39.9, currency: 'BRL', content_ids: ['aunivo-pro'] })
  })

  it('respects an explicit marketing denial', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq, __aunivoAnalyticsConsent: 'denied' })
    trackInitiateCheckout('pro')
    trackContact('whatsapp')
    expect(fbq).not.toHaveBeenCalled()
  })
})
