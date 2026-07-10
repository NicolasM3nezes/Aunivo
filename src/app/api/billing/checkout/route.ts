import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { appUrl, stripeServer } from '@/lib/billing/stripe/server'
import { isBillingInterval, isPlanKey, priceIdFor } from '@/lib/billing/catalog'
import { billingErrorResponse } from '@/lib/billing/http'

export async function POST(request: Request) {
  try {
    const ctx = await requireRole('owner')
    const body = await request.json().catch(() => null)
    if (!body || !isPlanKey(body.planKey) || body.planKey === 'free') return NextResponse.json({ error: 'Invalid paid plan' }, { status: 400 })
    if (!isBillingInterval(body.interval)) return NextResponse.json({ error: 'Invalid billing interval' }, { status: 400 })
    const db = supabaseAdmin()
    const { data: billing, error } = await db.from('account_billing').select('*').eq('account_id', ctx.accountId).single()
    if (error) throw new Error(error.message)
    const stripe = stripeServer()
    if (billing.provider_subscription_id && ['active','trialing','past_due'].includes(billing.subscription_status)) {
      const portal = await stripe.billingPortal.sessions.create({ customer: billing.provider_customer_id, return_url: `${appUrl()}/settings?tab=billing` })
      return NextResponse.json({ url: portal.url, portal: true })
    }
    let customerId = billing.provider_customer_id as string | null
    if (!customerId) {
      const { data: profile } = await db.from('profiles').select('email').eq('user_id', ctx.userId).single()
      const customer = await stripe.customers.create({ email: profile?.email ?? undefined, name: ctx.account.name, metadata: { app: 'aunivo', account_id: ctx.accountId, owner_user_id: ctx.userId } })
      customerId = customer.id
      const { error: updateError } = await db.from('account_billing').update({ provider_customer_id: customerId, last_synced_at: new Date().toISOString() }).eq('account_id', ctx.accountId)
      if (updateError) throw new Error(updateError.message)
    }
    const price = priceIdFor(body.planKey, body.interval)
    const bucket = Math.floor(Date.now() / 300_000)
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription', customer: customerId, line_items: [{ price, quantity: 1 }], client_reference_id: ctx.accountId,
      metadata: { app: 'aunivo', account_id: ctx.accountId, plan_key: body.planKey, interval: body.interval },
      subscription_data: { metadata: { app: 'aunivo', account_id: ctx.accountId, plan_key: body.planKey, interval: body.interval } },
      allow_promotion_codes: true, billing_address_collection: 'required', tax_id_collection: { enabled: true }, locale: 'auto',
      success_url: `${appUrl()}/settings?tab=billing&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl()}/settings?tab=billing&checkout=canceled`,
    }, { idempotencyKey: `checkout:${ctx.accountId}:${body.planKey}:${body.interval}:${bucket}` })
    if (!session.url) throw new Error('Stripe Checkout did not return a URL')
    return NextResponse.json({ url: session.url })
  } catch (error) { return billingErrorResponse(error) }
}
