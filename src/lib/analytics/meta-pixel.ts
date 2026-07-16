export const META_STANDARD_EVENTS = [
  'PageView',
  'ViewContent',
  'Lead',
  'CompleteRegistration',
  'StartTrial',
  'InitiateCheckout',
  'Purchase',
] as const

export type MetaStandardEvent = (typeof META_STANDARD_EVENTS)[number]
export type MetaEventParameters = Record<string, string | number | boolean>

type MetaPixelArguments =
  | ['init', pixelId: string]
  | ['track', eventName: MetaStandardEvent, parameters?: MetaEventParameters]
  | ['trackCustom', eventName: string, parameters?: MetaEventParameters]

export interface MetaPixelFunction {
  (...args: MetaPixelArguments): void
  callMethod?: (...args: MetaPixelArguments) => void
  queue: MetaPixelArguments[]
  loaded: boolean
  push: MetaPixelFunction
  version: string
}

declare global {
  interface Window {
    fbq?: MetaPixelFunction
    _fbq?: MetaPixelFunction
    __aunivoMetaPixelId?: string
    __aunivoMetaPixelLastPageView?: string
    __aunivoMetaPixelLastViewContent?: string
  }
}

export function trackMetaEvent(
  eventName: MetaStandardEvent,
  parameters?: MetaEventParameters,
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return

  try {
    window.fbq('track', eventName, parameters)
  } catch {
    // Ad blockers and privacy extensions may replace or interrupt fbq.
  }
}

export function trackMetaCustomEvent(
  eventName: string,
  parameters?: MetaEventParameters,
): void {
  if (typeof window === 'undefined' || typeof window.fbq !== 'function') return

  try {
    window.fbq('trackCustom', eventName, parameters)
  } catch {
    // Tracking must never interrupt the product flow.
  }
}

export function trackMetaInitiateCheckout(plan: 'free' | 'pro'): void {
  trackMetaEvent('InitiateCheckout', {
    value: plan === 'free' ? 12.9 : 39.9,
    currency: 'BRL',
    content_name: plan === 'free' ? 'Basic' : 'Pro',
  })
}
