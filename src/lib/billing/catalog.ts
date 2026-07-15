import type { BillingFeature, BillingInterval, BillingLimit, PlanDefinition, PlanKey } from './types'
import { PLAN_DISPLAY_NAMES, PLAN_LIMITS } from './plan-permissions'
import { FEATURES } from '@/config/features'

const freeFeatures: Record<BillingFeature, boolean> = {
  contacts: true, shared_inbox: false, whatsapp: true, pipelines: true, dashboard: true,
  custom_fields: false, broadcasts: false, automations: FEATURES.automations, flows: false,
  ai_drafts: true, ai_auto_reply: false, knowledge_base: false, reports: false,
  public_api: false, external_webhooks: false, mcp: false, advanced_permissions: false,
}

export const BILLING_PLANS: Record<PlanKey, PlanDefinition> = {
  free: {
    key: 'free', name: PLAN_DISPLAY_NAMES.free, description: 'Para começar a organizar suas vendas.',
    prices: { monthly: 1290, yearly: 0 },
    limits: PLAN_LIMITS.free,
    features: freeFeatures,
  },
  pro: {
    key: 'pro', name: PLAN_DISPLAY_NAMES.pro, description: 'Gestão comercial para equipes em crescimento.', recommended: true,
    prices: { monthly: 3990, yearly: 0 },
    limits: PLAN_LIMITS.pro,
    features: { ...freeFeatures, shared_inbox: true, custom_fields: true, broadcasts: true, flows: true, ai_auto_reply: true, knowledge_base: true, reports: true },
  },
  business: {
    key: 'business', name: PLAN_DISPLAY_NAMES.business, description: 'Escala, integrações e limites personalizados.',
    prices: { monthly: 0, yearly: 0 },
    limits: PLAN_LIMITS.business,
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

export function priceIdFor(plan: Exclude<PlanKey, 'business'>, interval: BillingInterval = 'monthly'): string {
  if (interval !== 'monthly') throw new Error('Only monthly billing is available')
  const envKey = plan === 'free' ? 'STRIPE_BASIC_MONTHLY_PRICE_ID' : 'STRIPE_PRO_MONTHLY_PRICE_ID'
  const value = process.env[envKey]?.trim()
  if (!value) throw new Error(`${envKey} is required`)
  return value
}

export function planForPriceId(priceId: string): { planKey: Exclude<PlanKey, 'business'>; interval: 'monthly' } | null {
  if (process.env.STRIPE_BASIC_MONTHLY_PRICE_ID?.trim() === priceId) return { planKey: 'free', interval: 'monthly' }
  if (process.env.STRIPE_PRO_MONTHLY_PRICE_ID?.trim() === priceId) return { planKey: 'pro', interval: 'monthly' }
  return null
}
