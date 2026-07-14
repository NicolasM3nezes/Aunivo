import type Stripe from 'stripe'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { stripeServer, stripeWebhookSecret } from '@/lib/billing/stripe/server'
import { stripeAccountId, syncStripeSubscription } from '@/lib/billing/stripe/sync'
import { notifyBillingOwner } from '@/lib/billing/notifications'
import { convertActivePilotGrant } from '@/lib/billing/access'

export const runtime = 'nodejs'

async function accountForCustomer(customerId: string) {
  const { data } = await supabaseAdmin().from('account_billing').select('account_id').eq('provider_customer_id', customerId).maybeSingle()
  return data?.account_id as string | undefined
}

async function subscriptionFromEvent(event: Stripe.Event): Promise<Stripe.Subscription | null> {
  if (event.type.startsWith('customer.subscription.')) return event.data.object as Stripe.Subscription
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const id = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
    return id ? stripeServer().subscriptions.retrieve(id) : null
  }
  if (event.type.startsWith('invoice.')) {
    const invoice = event.data.object as Stripe.Invoice
    const customer = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    if (!customer) return null
    const accountId = await accountForCustomer(customer)
    const { data } = accountId ? await supabaseAdmin().from('account_billing').select('provider_subscription_id').eq('account_id', accountId).single() : { data: null }
    return data?.provider_subscription_id ? stripeServer().subscriptions.retrieve(data.provider_subscription_id) : null
  }
  return null
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature' }, { status: 400 })
  let event: Stripe.Event
  try { event = stripeServer().webhooks.constructEvent(await request.text(), signature, stripeWebhookSecret()) }
  catch { return NextResponse.json({ error: 'Invalid Stripe signature' }, { status: 400 }) }
  const db = supabaseAdmin()
  const object = event.data.object as { id?: string; livemode?: boolean }
  const { error: claimError } = await db.from('billing_webhook_events').insert({ provider_event_id: event.id, event_type: event.type, object_id: object.id ?? null, livemode: event.livemode, attempts: 1 })
  if (claimError?.code === '23505') {
    const { data: prior } = await db.from('billing_webhook_events').select('processing_status,attempts,received_at').eq('provider_event_id', event.id).single()
    if (prior?.processing_status === 'processed') return NextResponse.json({ received: true, duplicate: true })
    if (prior?.processing_status === 'processing' && prior.received_at && Date.now() - new Date(prior.received_at).getTime() < 300_000) return NextResponse.json({ received: true, duplicate: true, processing: true })
    await db.from('billing_webhook_events').update({ processing_status: 'processing', attempts: Number(prior?.attempts ?? 0) + 1, error_message: null }).eq('provider_event_id', event.id)
  }
  if (claimError && claimError.code !== '23505') { console.error('[billing webhook] claim failed', claimError.message); return NextResponse.json({ error: 'Could not claim event' }, { status: 500 }) }
  try {
    const supported = new Set(['checkout.session.completed','customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','customer.subscription.trial_will_end','invoice.paid','invoice.payment_succeeded','invoice.payment_failed','invoice.payment_action_required'])
    if (supported.has(event.type)) {
      const subscription = await subscriptionFromEvent(event)
      if (subscription) {
        const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id
        const metadataAccount = stripeAccountId(subscription)
        const customerAccount = await accountForCustomer(customerId)
        const accountId = metadataAccount ?? customerAccount
        if (!accountId || (metadataAccount && customerAccount && metadataAccount !== customerAccount)) throw new Error('Stripe customer/account association is invalid')
        await syncStripeSubscription(db, accountId, subscription, event.created)
        if (
          ['checkout.session.completed', 'customer.subscription.created', 'customer.subscription.updated', 'invoice.paid'].includes(event.type) &&
          (subscription.status === 'active' || subscription.status === 'trialing')
        ) {
          await convertActivePilotGrant(db, accountId, new Date(event.created * 1000).toISOString())
        }
        if (event.type.startsWith('invoice.')) {
          const invoice = event.data.object as Stripe.Invoice
          const invoicePatch: Record<string, string | null> = { last_invoice_status: invoice.status ?? event.type }
          if (event.type === 'invoice.paid' || event.type === 'invoice.payment_succeeded') invoicePatch.last_invoice_paid_at = new Date(event.created * 1000).toISOString()
          if (event.type === 'invoice.payment_failed') invoicePatch.last_payment_failed_at = new Date(event.created * 1000).toISOString()
          await db.from('account_billing').update(invoicePatch).eq('account_id', accountId)
        }
        if (event.type === 'checkout.session.completed' && subscription.trial_start) {
          const { error: trialError } = await db.from('account_billing').update({ trial_used_at: new Date(event.created * 1000).toISOString() }).eq('account_id', accountId).is('trial_used_at', null)
          if (trialError) throw new Error(trialError.message)
        }
        const notifications: Partial<Record<Stripe.Event.Type, [string,string]>> = {
          'checkout.session.completed': ['billing_subscription_activated','Assinatura recebida'],
          'invoice.paid': ['billing_payment_confirmed','Pagamento confirmado'],
          'invoice.payment_succeeded': ['billing_payment_confirmed','Pagamento confirmado'],
          'invoice.payment_failed': ['billing_payment_failed','Falha no pagamento'],
          'invoice.payment_action_required': ['billing_payment_action_required','Pagamento requer autenticação'],
          'customer.subscription.deleted': ['billing_canceled','Assinatura cancelada'],
          'customer.subscription.trial_will_end': ['billing_trial_ending','Seu período de teste termina em breve'],
        }
        const notice = notifications[event.type]
        if (notice) await notifyBillingOwner(db, accountId, notice[0], notice[1])
        if (event.type === 'customer.subscription.updated' && subscription.cancel_at_period_end) await notifyBillingOwner(db, accountId, 'billing_cancel_scheduled', 'Cancelamento agendado')
      }
    }
    await db.from('billing_webhook_events').update({ processing_status: 'processed', processed_at: new Date().toISOString(), error_message: null }).eq('provider_event_id', event.id)
    return NextResponse.json({ received: true })
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown processing error'
    await db.from('billing_webhook_events').update({ processing_status: 'failed', error_message: message }).eq('provider_event_id', event.id)
    console.error('[billing webhook]', event.id, message)
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 })
  }
}
