import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/account'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { stripeServer } from '@/lib/billing/stripe/server'
import { syncStripeSubscription } from '@/lib/billing/stripe/sync'
import { billingErrorResponse } from '@/lib/billing/http'
import { getEffectiveAccountAccess } from '@/lib/billing/access'

export async function POST() {
  try {
    const ctx = await requireRole('owner')
    const limit = checkRateLimit(`billing-sync:${ctx.userId}`, { limit: 6, windowMs: 60_000 })
    if (!limit.success) return rateLimitResponse(limit)
    const db = supabaseAdmin()
    const [{ data }, access] = await Promise.all([
      db.from('account_billing').select('provider_customer_id,provider_subscription_id').eq('account_id', ctx.accountId).single(),
      getEffectiveAccountAccess(ctx.accountId, db),
    ])
    if (access.isInternal && access.isActive) return NextResponse.json({ error: 'Esta conta possui acesso interno e não requer sincronização com o Stripe.' }, { status: 409 })
    if (!data?.provider_customer_id) return NextResponse.json({ error: 'No Stripe customer exists for this account' }, { status: 409 })
    let subscription
    if (data.provider_subscription_id) subscription = await stripeServer().subscriptions.retrieve(data.provider_subscription_id)
    else {
      const list = await stripeServer().subscriptions.list({ customer: data.provider_customer_id, status: 'all', limit: 10 })
      subscription = list.data.find((item) => item.metadata.account_id === ctx.accountId && item.status !== 'canceled') ?? list.data[0]
    }
    if (!subscription) return NextResponse.json({ error: 'No Stripe subscription found' }, { status: 404 })
    await syncStripeSubscription(db, ctx.accountId, subscription)
    return NextResponse.json({ synchronized: true })
  } catch (error) { return billingErrorResponse(error) }
}
