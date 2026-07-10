import type { BillingFeature, BillingInterval, BillingLimit, PlanDefinition, PlanKey } from './types'

const freeFeatures: Record<BillingFeature, boolean> = {
  contacts: true, shared_inbox: false, whatsapp: true, pipelines: true, dashboard: true,
  custom_fields: false, broadcasts: false, automations: true, flows: false,
  ai_drafts: true, ai_auto_reply: false, knowledge_base: false, reports: false,
  public_api: false, external_webhooks: false, mcp: false, advanced_permissions: false,
}

export const BILLING_PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free', name: 'Free', description: 'Para começar a organizar suas vendas.',
    prices: { monthly: 0, yearly: 0 },
    limits: { members: 1, contacts: 200, pipelines: 1, automations: 1, broadcast_recipients_monthly: 0, ai_replies_monthly: 25 },
    features: freeFeatures,
  },
  pro: {
    key: 'pro', name: 'Pro', description: 'Automação e IA para equipes em crescimento.', recommended: true,
    prices: { monthly: 22900, yearly: 229000 },
    limits: { members: 3, contacts: 5000, pipelines: 5, automations: 25, broadcast_recipients_monthly: 5000, ai_replies_monthly: 2000 },
    features: { ...freeFeatures, shared_inbox: true, custom_fields: true, broadcasts: true, flows: true, ai_auto_reply: true, knowledge_base: true, reports: true },
  },
  business: {
    key: 'business', name: 'Business', description: 'Escala, integrações e limites ampliados.',
    prices: { monthly: 49900, yearly: 499000 },
    limits: { members: 10, contacts: 50000, pipelines: null, automations: null, broadcast_recipients_monthly: 50000, ai_replies_monthly: 20000 },
    features: { ...freeFeatures, shared_inbox: true, custom_fields: true, broadcasts: true, flows: true, ai_auto_reply: true, knowledge_base: true, reports: true, public_api: true, external_webhooks: true, mcp: true, advanced_permissions: true },
  },
}

export const PLAN_KEYS = Object.keys(BILLING_PLANS) as PlanKey[]
export const BILLING_INTERVALS: BillingInterval[] = ['monthly', 'yearly']
export function isPlanKey(value: unknown): value is PlanKey { return typeof value === 'string' && PLAN_KEYS.includes(value as PlanKey) }
export function isBillingInterval(value: unknown): value is BillingInterval { return typeof value === 'string' && BILLING_INTERVALS.includes(value as BillingInterval) }
export function getPlan(plan: PlanKey) { return BILLING_PLANS[plan] }
export function planHasFeature(plan: PlanKey, feature: BillingFeature) { return BILLING_PLANS[plan].features[feature] }
export function planLimit(plan: PlanKey, limit: BillingLimit) { return BILLING_PLANS[plan].limits[limit] }

export function priceIdFor(plan: Exclude<PlanKey, 'free'>, interval: BillingInterval): string {
  const envKey = `STRIPE_${plan.toUpperCase()}_${interval === 'monthly' ? 'MONTHLY' : 'YEARLY'}_PRICE_ID`
  const value = process.env[envKey]?.trim()
  if (!value) throw new Error(`${envKey} is required`)
  return value
}

export function planForPriceId(priceId: string): { planKey: Exclude<PlanKey, 'free'>; interval: BillingInterval } | null {
  for (const planKey of ['pro', 'business'] as const) for (const interval of BILLING_INTERVALS) {
    const key = `STRIPE_${planKey.toUpperCase()}_${interval === 'monthly' ? 'MONTHLY' : 'YEARLY'}_PRICE_ID`
    if (process.env[key] && process.env[key] === priceId) return { planKey, interval }
  }
  return null
}
