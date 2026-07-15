import { NextResponse } from 'next/server'
import { getCurrentAccount, toErrorResponse } from '@/lib/auth/account'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { MARKETING_CONSENT_VERSION } from '@/lib/trials/signup'

export async function GET() {
  try {
    const { userId, accountId } = await getCurrentAccount()
    const { data, error } = await supabaseAdmin().from('trial_signups').select('marketing_opt_in,marketing_consent_at,marketing_revoked_at').eq('auth_user_id', userId).eq('account_id', accountId).maybeSingle()
    if (error) throw error
    return NextResponse.json({ available: Boolean(data), optedIn: Boolean(data?.marketing_opt_in), consentedAt: data?.marketing_consent_at ?? null, revokedAt: data?.marketing_revoked_at ?? null })
  } catch (error) { return toErrorResponse(error) }
}

export async function PATCH(request: Request) {
  try {
    const { userId, accountId } = await getCurrentAccount()
    const body = await request.json().catch(() => null)
    if (!body || typeof body.optedIn !== 'boolean') return NextResponse.json({ error: 'Preferência inválida.' }, { status: 400 })
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin().from('trial_signups').update({
      marketing_opt_in: body.optedIn,
      marketing_consent_at: body.optedIn ? now : null,
      marketing_consent_version: body.optedIn ? MARKETING_CONSENT_VERSION : null,
      marketing_revoked_at: body.optedIn ? null : now,
    }).eq('auth_user_id', userId).eq('account_id', accountId).select('id').maybeSingle()
    if (error) throw error
    return NextResponse.json({ available: Boolean(data), optedIn: body.optedIn })
  } catch (error) { return toErrorResponse(error) }
}
