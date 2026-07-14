import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { planForPriceId } from '../catalog'
import type { SubscriptionStatus } from '../types'

const unix = (value: number | null | undefined) => value ? new Date(value * 1000).toISOString() : null
const accepted = new Set<SubscriptionStatus>(['trialing','active','past_due','unpaid','canceled','incomplete','incomplete_expired','paused'])

export function mapStripeSubscription(subscription: Stripe.Subscription, eventCreated?: number) {
  const item = subscription.items.data[0]
  const priceId = item?.price.id
  const mapped = priceId ? planForPriceId(priceId) : null
  if (!mapped) throw new Error(`Subscription uses an unknown Stripe Price: ${priceId ?? 'missing'}`)
  const status = subscription.status === 'canceled' ? 'canceled' : subscription.status
  if (!accepted.has(status as SubscriptionStatus)) throw new Error(`Unsupported Stripe subscription status: ${status}`)
  const graceDays = Math.max(0, Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? '7') || 7)
  const grace = status === 'past_due' ? new Date(Date.now() + graceDays * 86_400_000).toISOString() : null
  return {
    provider: 'stripe', provider_customer_id: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
    provider_subscription_id: subscription.id, provider_price_id: priceId,
    plan_key: mapped.planKey, billing_interval: mapped.interval, subscription_status: status,
    current_period_start: unix(item?.current_period_start), current_period_end: unix(item?.current_period_end),
    trial_start: unix(subscription.trial_start), trial_end: unix(subscription.trial_end),
    cancel_at_period_end: subscription.cancel_at_period_end, canceled_at: unix(subscription.canceled_at),
    grace_period_ends_at: grace, last_provider_event_created_at: unix(eventCreated), last_synced_at: new Date().toISOString(),
  }
}

export async function syncStripeSubscription(db: SupabaseClient, accountId: string, subscription: Stripe.Subscription, eventCreated?: number) {
  const patch = mapStripeSubscription(subscription, eventCreated)
  const { data: existing, error: readError } = await db.from('account_billing').select('account_id,provider_customer_id,last_provider_event_created_at,grace_period_ends_at,subscription_status').eq('account_id', accountId).maybeSingle()
  if (readError) throw new Error(readError.message)
  if (existing?.provider_customer_id && existing.provider_customer_id !== patch.provider_customer_id) throw new Error('Stripe Customer is already linked to another billing record')
  if (eventCreated && existing?.last_provider_event_created_at && new Date(existing.last_provider_event_created_at).getTime() > eventCreated * 1000) return false
  if (patch.subscription_status === 'past_due' && existing?.subscription_status === 'past_due' && existing.grace_period_ends_at) patch.grace_period_ends_at = existing.grace_period_ends_at
  // Update only Stripe-owned columns. In particular, webhook synchronization
  // must never write or clear the independent administrative override fields.
  const { error } = existing
    ? await db.from('account_billing').update(patch).eq('account_id', accountId)
    : await db.from('account_billing').insert({ account_id: accountId, ...patch })
  if (error) throw new Error(error.message)
  return true
}

export function stripeAccountId(subscription: Stripe.Subscription): string | null {
  return subscription.metadata.account_id || null
}
