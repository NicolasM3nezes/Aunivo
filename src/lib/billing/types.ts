export type PlanKey = 'free' | 'pro' | 'business'
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
  | 'broadcast_recipients_monthly' | 'ai_replies_monthly'

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
  cancel_at_period_end: boolean
  canceled_at: string | null
  grace_period_ends_at: string | null
  last_invoice_status: string | null
  last_provider_event_created_at: string | null
  last_synced_at: string | null
}

export interface AccountEntitlements {
  accountId: string
  configuredPlan: PlanKey
  effectivePlan: PlanKey
  status: SubscriptionStatus
  access: 'full' | 'grace' | 'restricted'
  gracePeriodEndsAt: string | null
  limits: Record<BillingLimit, number | null>
  features: Record<BillingFeature, boolean>
}
