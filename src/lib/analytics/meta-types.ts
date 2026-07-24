export const META_STANDARD_EVENTS = [
  'PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'StartTrial',
  'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Subscribe', 'Contact',
  'Search', 'Schedule', 'SubmitApplication', 'AddToCart', 'AddToWishlist',
  'CustomizeProduct', 'Donate', 'FindLocation',
] as const

export type MetaStandardEvent = (typeof META_STANDARD_EVENTS)[number]
export type MetaEventValue = string | number | boolean | string[]
export type MetaEventParameters = Record<string, MetaEventValue>
export type MetaEventOptions = { eventID?: string }

export type MetaPixelArguments =
  | ['init', pixelId: string]
  | ['track', eventName: MetaStandardEvent, parameters?: MetaEventParameters, options?: MetaEventOptions]
  | ['trackCustom', eventName: string, parameters?: MetaEventParameters, options?: MetaEventOptions]
  | ['consent', state: 'grant' | 'revoke']

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
    __aunivoAnalyticsConsent?: 'granted' | 'denied'
  }
}
