import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { getAccountEntitlements } from '@/lib/billing/entitlements'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { billingErrorResponse } from '@/lib/billing/http'
import type { BillingStateRow } from '@/lib/billing/types'
import { hasPilotGrantHistory } from '@/lib/billing/access'

const publicBillingColumns = [
  'plan_key', 'billing_interval', 'subscription_status',
  'current_period_start', 'current_period_end', 'trial_start', 'trial_end',
  'trial_used_at', 'cancel_at_period_end', 'canceled_at', 'grace_period_ends_at',
  'last_invoice_status', 'last_invoice_paid_at', 'last_payment_failed_at',
  'provider_customer_id', 'provider_subscription_id',
].join(',')

export async function GET() {
  try {
    const ctx = await getCurrentAccount()
    const entitlements = await getAccountEntitlements(ctx.accountId)
    const pilotHistory = await hasPilotGrantHistory(ctx.accountId)
    const { data, error } = await supabaseAdmin().from('account_billing').select(publicBillingColumns).eq('account_id', ctx.accountId).maybeSingle()
    if (error) throw new Error(error.message)
    const publicData = data as unknown as BillingStateRow | null
    const billing = ctx.role === 'owner' || !publicData ? publicData : {
      ...publicData,
      provider_customer_id: null,
      provider_subscription_id: null,
    }
    return NextResponse.json({ entitlements, billing, canManage: ctx.role === 'owner', trialEligible: ctx.role === 'owner' && !entitlements.effectiveAccess.isInternal && !pilotHistory && !publicData?.trial_used_at })
  } catch (error) { return billingErrorResponse(error) }
}
