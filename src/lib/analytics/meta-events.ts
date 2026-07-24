import { BILLING_PLANS } from '@/lib/billing/catalog'
import type { MetaEventOptions, MetaEventParameters, MetaStandardEvent } from './meta-types'

export function metaEventId(prefix: string): string {
  const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}:${id}`
}

export function isMetaTrackingAllowed(): boolean {
  return typeof window !== 'undefined' && window.__aunivoAnalyticsConsent !== 'denied'
}

export function trackMetaEvent(eventName: MetaStandardEvent, parameters?: MetaEventParameters, options?: MetaEventOptions): void {
  if (!isMetaTrackingAllowed() || typeof window.fbq !== 'function') return
  try {
    window.fbq('track', eventName, parameters, options)
    if (process.env.NEXT_PUBLIC_ANALYTICS_DEBUG === 'true') console.info('[analytics:meta]', { eventName, eventId: options?.eventID })
  } catch {
    // Analytics is intentionally fail-open for every product flow.
  }
}

export function trackMetaCustomEvent(eventName: string, parameters?: MetaEventParameters, options?: MetaEventOptions): void {
  if (!isMetaTrackingAllowed() || typeof window.fbq !== 'function') return
  try { window.fbq('trackCustom', eventName, parameters, options) } catch {}
}

const content = (name: string, category: string, ids: string[], type = 'product'): MetaEventParameters => ({
  content_name: name, content_category: category, content_ids: ids, content_type: type,
})

export const trackViewContent = (kind: 'landing' | 'pricing') =>
  trackMetaEvent('ViewContent', kind === 'landing'
    ? content('Landing Page Aunivo', 'SaaS CRM', ['aunivo'])
    : content('Planos Aunivo', 'Pricing', ['basic', 'pro'], 'product_group'))

export const trackLead = () => trackMetaEvent('Lead', {
  content_name: 'Teste gratuito Aunivo', content_category: 'SaaS Lead', value: 0, currency: 'BRL',
}, { eventID: metaEventId('lead') })

export const trackCompleteRegistration = (eventID: string) => trackMetaEvent('CompleteRegistration', {
  content_name: 'Cadastro Aunivo', status: 'completed', currency: 'BRL', value: 0,
}, { eventID })

export const trackStartTrial = (eventID: string) => trackMetaEvent('StartTrial', {
  ...content('Teste Pro Aunivo', 'Free Trial', ['aunivo-pro-trial']),
  value: 0, currency: 'BRL', predicted_ltv: 0,
}, { eventID })

export function paidPlanParameters(plan: 'free' | 'pro'): MetaEventParameters {
  const definition = BILLING_PLANS[plan]
  return {
    ...content(`Plano ${plan === 'free' ? 'Basic' : 'Pro'} Aunivo`, 'Subscription', [`aunivo-${plan === 'free' ? 'basic' : 'pro'}`]),
    num_items: 1, value: definition.prices.monthly / 100, currency: 'BRL',
  }
}

export const trackInitiateCheckout = (plan: 'free' | 'pro', eventID = metaEventId('checkout')) =>
  trackMetaEvent('InitiateCheckout', paidPlanParameters(plan), { eventID })
export const trackAddPaymentInfo = (plan: 'free' | 'pro', eventID: string) =>
  trackMetaEvent('AddPaymentInfo', paidPlanParameters(plan), { eventID })
export const trackPurchase = (parameters: MetaEventParameters, eventID: string) =>
  trackMetaEvent('Purchase', parameters, { eventID })
export const trackSubscribe = (parameters: MetaEventParameters, eventID: string) =>
  trackMetaEvent('Subscribe', parameters, { eventID })
export const trackContact = (method: 'whatsapp' | 'email' | 'sales') =>
  trackMetaEvent('Contact', { content_name: 'Contato comercial Aunivo', content_category: 'Sales Contact', contact_method: method })
export const trackSubmitApplication = () =>
  trackMetaEvent('SubmitApplication', { content_name: 'Solicitação de piloto Aunivo', content_category: 'Pilot Application' }, { eventID: metaEventId('pilot') })
