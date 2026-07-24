export const META_ANALYTICS_CONFIG = {
  currency: 'BRL',
  trial: {
    value: 39.90,
    predictedLtv: 39.90,
    contentName: 'Teste Pro Aunivo',
    contentCategory: 'Free Trial',
    contentId: 'aunivo-pro-trial',
    contentType: 'product',
  },
} as const

export function validateMetaMonetaryEvent(value: number, currency: string): boolean {
  return Number.isFinite(value) && value > 0 && /^[A-Z]{3}$/.test(currency)
}

export function metaStartTrialParameters() {
  const { trial, currency } = META_ANALYTICS_CONFIG
  return {
    value: trial.value,
    currency,
    predicted_ltv: trial.predictedLtv,
    content_name: trial.contentName,
    content_category: trial.contentCategory,
    content_ids: [trial.contentId],
    content_type: trial.contentType,
  }
}

export function metaCompleteRegistrationParameters() {
  const { trial, currency } = META_ANALYTICS_CONFIG
  return {
    content_name: 'Cadastro Aunivo',
    status: 'completed',
    value: trial.value,
    currency,
  }
}
