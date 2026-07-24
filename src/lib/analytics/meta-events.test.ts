import { afterEach, describe, expect, it, vi } from 'vitest'
import { paidPlanParameters, trackCompleteRegistration, trackContact, trackInitiateCheckout, trackLead, trackStartTrial, trackViewContent } from './meta-events'
import { META_ANALYTICS_CONFIG, metaStartTrialParameters, validateMetaMonetaryEvent } from './meta-config'

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
    }, expect.objectContaining({ eventID: expect.stringMatching(/^lead:/) }))
    expect(JSON.stringify(fbq.mock.calls)).not.toMatch(/email|phone|password/i)
  })

  it('uses centralized numeric prices for checkout', () => {
    expect(paidPlanParameters('free')).toMatchObject({ value: 12.9, currency: 'BRL', content_ids: ['aunivo-basic'] })
    expect(paidPlanParameters('pro')).toMatchObject({ value: 39.9, currency: 'BRL', content_ids: ['aunivo-pro'] })
  })

  it('uses canonical plan ids for pricing ViewContent', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackViewContent('pricing')
    expect(fbq).toHaveBeenCalledWith('track', 'ViewContent', expect.objectContaining({
      content_ids: ['aunivo-basic', 'aunivo-pro'],
      content_type: 'product_group',
    }), undefined)
  })

  it('uses a positive numeric reference value for CompleteRegistration', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackCompleteRegistration('registration:user-1')
    expect(fbq).toHaveBeenCalledWith('track', 'CompleteRegistration', expect.objectContaining({
      value: 39.9,
      currency: 'BRL',
    }), { eventID: 'registration:user-1' })
  })

  it('respects an explicit marketing denial', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq, __aunivoAnalyticsConsent: 'denied' })
    trackInitiateCheckout('pro')
    trackContact('whatsapp')
    expect(fbq).not.toHaveBeenCalled()
  })

  it('tracks StartTrial with numeric Pro value, BRL and eventID', () => {
    const fbq = vi.fn()
    vi.stubGlobal('window', { fbq })
    trackStartTrial('trial:signup-1')
    expect(fbq).toHaveBeenCalledWith('track', 'StartTrial', {
      value: 39.9,
      currency: 'BRL',
      predicted_ltv: 39.9,
      content_name: 'Teste Pro Aunivo',
      content_category: 'Free Trial',
      content_ids: ['aunivo-pro-trial'],
      content_type: 'product',
    }, { eventID: 'trial:signup-1' })
    expect(typeof metaStartTrialParameters().value).toBe('number')
    expect(validateMetaMonetaryEvent(META_ANALYTICS_CONFIG.trial.value, META_ANALYTICS_CONFIG.currency)).toBe(true)
  })
})
