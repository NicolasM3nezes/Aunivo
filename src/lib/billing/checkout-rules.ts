import type { PlanKey, SubscriptionStatus } from './types'

export type CheckoutPlan = Exclude<PlanKey, 'business'>

const blockingStatuses = new Set<SubscriptionStatus>(['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused'])

export function isCheckoutPlan(value: unknown): value is CheckoutPlan {
  return value === 'free' || value === 'pro'
}

export function subscriptionBlocksCheckout(status: string): boolean {
  return blockingStatuses.has(status as SubscriptionStatus)
}
