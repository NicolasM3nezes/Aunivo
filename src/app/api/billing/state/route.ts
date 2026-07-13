import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { getAccountEntitlements } from '@/lib/billing/entitlements'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { billingErrorResponse } from '@/lib/billing/http'

export async function GET() {
  try {
    const ctx = await getCurrentAccount()
    const entitlements = await getAccountEntitlements(ctx.accountId)
    const { data, error } = await supabaseAdmin().from('account_billing').select('*').eq('account_id', ctx.accountId).maybeSingle()
    if (error) throw new Error(error.message)
    const billing = ctx.role === 'owner' || !data ? data : {
      ...data,
      provider_customer_id: null,
      provider_subscription_id: null,
      provider_price_id: null,
      last_provider_event_created_at: null,
    }
    return NextResponse.json({ entitlements, billing, canManage: ctx.role === 'owner', trialEligible: ctx.role === 'owner' && !data?.trial_used_at })
  } catch (error) { return billingErrorResponse(error) }
}
