import type { InternalPlan } from './plan-permissions'

export type PlanKey = InternalPlan
export type AccessOverridePlan = 'basic' | 'pro' | 'business'
export type BillingAccessSource = 'internal' | 'stripe' | 'pilot' | 'trial' | 'none'
export type AccessGrantType = 'pilot' | 'internal' | 'trial'
export type AccessGrantStatus = 'active' | 'revoked' | 'expired' | 'converted'
export type BillingInterval = 'monthly' | 'yearly'
export type SubscriptionStatus =
  | 'free' | 'trialing' | 'active' | 'past_due' | 'unpaid'
  | 'canceled' | 'incomplete' | 'incomplete_expired' | 'paused'

export type BillingFeature =
  | 'contacts' | 'shared_inbox' | 'whatsapp' | 'pipelines' | 'dashboard'
  | 'custom_fields' | 'broadcasts' | 'automations' | 'flows' | 'ai_drafts'
  | 'ai_auto_reply' | 'knowledge_base' | 'reports' | 'public_api'
  | 'external_webhooks' | 'mcp' | 'advanced_permissions'

export type BillingLimit =
  | 'members' | 'contacts' | 'pipelines' | 'automations'
  | 'flows' | 'ai_agents' | 'broadcast_recipients_monthly' | 'ai_replies_monthly'

export interface PlanDefinition {
  key: PlanKey
  name: string
  description: string
  prices: Record<BillingInterval, number>
  limits: Record<BillingLimit, number | null>
  features: Record<BillingFeature, boolean>
  recommended?: boolean
}

export interface BillingRow {
  account_id: string
  provider_customer_id: string | null
  provider_subscription_id: string | null
  provider_price_id: string | null
  plan_key: PlanKey
  billing_interval: BillingInterval | null
  subscription_status: SubscriptionStatus
  current_period_start: string | null
  current_period_end: string | null
  trial_start: string | null
  trial_end: string | null
  trial_used_at: string | null
  cancel_at_period_end: boolean
  canceled_at: string | null
  grace_period_ends_at: string | null
  last_invoice_status: string | null
  last_invoice_paid_at: string | null
  last_payment_failed_at: string | null
  last_provider_event_created_at: string | null
  last_synced_at: string | null
  access_override_plan: AccessOverridePlan | null
  access_override_expires_at: string | null
  access_override_reason: string | null
}

export interface AccessGrantRow {
  id: string
  account_id: string
  grant_type: AccessGrantType
  plan_key: AccessOverridePlan
  status: AccessGrantStatus
  starts_at: string
  expires_at: string | null
  reason: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  revoked_at: string | null
  converted_at: string | null
}

export interface EffectiveAccountAccess {
  plan: PlanKey
  source: BillingAccessSource
  status: SubscriptionStatus | AccessGrantStatus | 'none'
  startsAt: string | null
  expiresAt: string | null
  daysRemaining: number | null
  isActive: boolean
  isPilot: boolean
  isInternal: boolean
  isTrial: boolean
  hasStripeSubscription: boolean
  access: 'full' | 'grace' | 'restricted'
}

export interface AccountEntitlements {
  accountId: string
  configuredPlan: PlanKey
  effectivePlan: PlanKey
  status: SubscriptionStatus
  access: 'full' | 'grace' | 'restricted'
  source: BillingAccessSource
  effectiveAccess: EffectiveAccountAccess
  gracePeriodEndsAt: string | null
  limits: Record<BillingLimit, number | null>
  features: Record<BillingFeature, boolean>
}

export type BillingStateRow = Pick<
  BillingRow,
  | 'plan_key'
  | 'billing_interval'
  | 'subscription_status'
  | 'current_period_start'
  | 'current_period_end'
  | 'trial_start'
  | 'trial_end'
  | 'trial_used_at'
  | 'cancel_at_period_end'
  | 'canceled_at'
  | 'grace_period_ends_at'
  | 'last_invoice_status'
  | 'last_invoice_paid_at'
  | 'last_payment_failed_at'
  | 'provider_customer_id'
  | 'provider_subscription_id'
>
