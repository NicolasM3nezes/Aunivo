import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { appUrl, stripeServer } from '@/lib/billing/stripe/server'
import { billingErrorResponse } from '@/lib/billing/http'
import { canOpenStripePortal, getEffectiveAccountAccess } from '@/lib/billing/access'

export async function POST() {
  try {
    const ctx = await requireRole('owner')
    const db = supabaseAdmin()
    const [{ data }, access] = await Promise.all([
      db.from('account_billing').select('provider_customer_id').eq('account_id', ctx.accountId).single(),
      getEffectiveAccountAccess(ctx.accountId, db),
    ])
    if (!canOpenStripePortal(access) || !data?.provider_customer_id) return NextResponse.json({ error: access.isInternal ? 'Esta conta possui acesso interno e não usa o portal de cobrança.' : 'No Stripe customer exists for this account' }, { status: 409 })
    const session = await stripeServer().billingPortal.sessions.create({ customer: data.provider_customer_id, return_url: `${appUrl()}/settings?tab=billing` })
    return NextResponse.json({ url: session.url })
  } catch (error) { return billingErrorResponse(error) }
}
