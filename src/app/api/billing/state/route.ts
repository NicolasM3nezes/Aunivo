import { NextResponse } from 'next/server'
import { getCurrentAccount } from '@/lib/auth/account'
import { getAccountEntitlements } from '@/lib/billing/entitlements'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { billingErrorResponse } from '@/lib/billing/http'

export async function GET() {
  try {
    const ctx = await getCurrentAccount()
    const entitlements = await getAccountEntitlements(ctx.accountId)
    if (ctx.role !== 'owner') return NextResponse.json({ entitlements, billing: null, canManage: false })
    const { data, error } = await supabaseAdmin().from('account_billing').select('*').eq('account_id', ctx.accountId).maybeSingle()
    if (error) throw new Error(error.message)
    return NextResponse.json({ entitlements, billing: data, canManage: true })
  } catch (error) { return billingErrorResponse(error) }
}
