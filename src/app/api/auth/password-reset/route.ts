import { createHash } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { createClient } from '@/lib/supabase/server'
import { validatePassword } from '@/lib/trials/signup'

export const runtime = 'nodejs'

const COOKIE_NAME = 'aunivo_password_recovery'
const invalidMessage = 'Este link de recuperação é inválido ou expirou. Solicite um novo link.'
const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

function clearRecoveryCookie(response: NextResponse) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
  return response
}

async function recoveryContext(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value
  if (!token) return null

  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return null

  const { data: recovery, error } = await supabaseAdmin()
    .from('password_recovery_sessions')
    .select('id,user_id,expires_at,used_at')
    .eq('token_hash', tokenHash(token))
    .maybeSingle()

  if (
    error ||
    !recovery ||
    recovery.user_id !== user.id ||
    recovery.used_at ||
    new Date(recovery.expires_at).getTime() <= Date.now()
  ) return null

  return { recovery, supabase, user }
}

export async function GET(request: NextRequest) {
  const context = await recoveryContext(request)
  if (!context) {
    return clearRecoveryCookie(NextResponse.json({ valid: false, message: invalidMessage }, { status: 401 }))
  }
  return NextResponse.json({ valid: true })
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { password?: unknown } | null
  const passwordError = validatePassword(body?.password)
  if (passwordError) return NextResponse.json({ message: passwordError }, { status: 400 })

  const context = await recoveryContext(request)
  if (!context) {
    return clearRecoveryCookie(NextResponse.json({ message: invalidMessage }, { status: 401 }))
  }

  // Claim first: the conditional update makes the proof single-use even if
  // two form submissions arrive at the same time.
  const { data: claimed, error: claimError } = await supabaseAdmin()
    .from('password_recovery_sessions')
    .update({ used_at: new Date().toISOString() })
    .eq('id', context.recovery.id)
    .is('used_at', null)
    .select('id')
    .maybeSingle()
  if (claimError || !claimed) {
    return clearRecoveryCookie(NextResponse.json({ message: invalidMessage }, { status: 401 }))
  }

  const { error: updateError } = await context.supabase.auth.updateUser({ password: body!.password as string })
  if (updateError) {
    console.error('[password-reset] senha não atualizada', {
      userId: context.user.id,
      code: updateError.code,
    })
    return clearRecoveryCookie(NextResponse.json(
      { message: 'Não foi possível redefinir sua senha. Solicite um novo link e tente novamente.' },
      { status: 500 },
    ))
  }

  console.info('[password-reset] senha redefinida', { userId: context.user.id })
  await context.supabase.auth.signOut({ scope: 'local' })
  return clearRecoveryCookie(NextResponse.json({ success: true }))
}
