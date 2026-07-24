import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { createClient } from '@/lib/supabase/server'
import { sendMetaConversion, sendMetaStartTrial } from '@/lib/analytics/meta-conversions'

export const runtime = 'nodejs'

function redirectTo(request: NextRequest, pathname: string, error?: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = error ? `erro=${encodeURIComponent(error)}` : ''
  return NextResponse.redirect(url)
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const requestedNext = request.nextUrl.searchParams.get('next')
  const safeNext = requestedNext?.startsWith('/') && !requestedNext.startsWith('//')
    ? requestedNext
    : '/dashboard'
  if (!code) return redirectTo(request, '/auth/verificar-email', 'Link de confirmação inválido ou expirado.')

  try {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw exchangeError

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user || !user.email || !user.email_confirmed_at) {
      return redirectTo(request, '/auth/verificar-email', 'Confirme seu e-mail antes de acessar o Aunivo.')
    }

    const db = supabaseAdmin()
    const { data: signup, error: signupError } = await db
      .from('trial_signups')
      .select('id,normalized_email,status')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    if (signupError) {
      console.error('[auth-callback] cadastro pendente não localizado', { userId: user.id, code: signupError?.code })
      return redirectTo(request, '/auth/verificar-email', 'Não conseguimos localizar seu cadastro pendente.')
    }
    if (!signup) return redirectTo(request, safeNext)
    if (signup.normalized_email !== user.email.toLowerCase()) {
      console.error('[auth-callback] e-mail confirmado diverge do cadastro', { userId: user.id, signupId: signup.id })
      return redirectTo(request, '/auth/verificar-email', 'Não conseguimos validar seu cadastro pendente.')
    }

    console.info('[auth-callback] confirmação concluída; ativação iniciada', { signupId: signup.id, userId: user.id })
    const { data, error } = await db.rpc('activate_confirmed_self_service_trial', {
      target_signup_id: signup.id,
      target_user_id: user.id,
    })
    if (error) throw error
    const activation = Array.isArray(data) ? data[0] : data
    console.info('[auth-callback] conta ativada e trial iniciado', {
      signupId: signup.id,
      userId: user.id,
      accountId: activation?.account_id,
      trialEndsAt: activation?.trial_ends_at,
    })
    const sourceUrl = `${(process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, '')}/auth/callback`
    await Promise.all([
      sendMetaConversion(db, {
        eventName: 'CompleteRegistration',
        eventId: `registration:${signup.id}`,
        externalReference: signup.id,
        eventSourceUrl: sourceUrl,
        email: user.email,
        customData: { content_name: 'Cadastro Aunivo', status: 'completed', value: 0, currency: 'BRL' },
      }),
      sendMetaStartTrial(db, {
        trialId: signup.id,
        eventSourceUrl: sourceUrl,
        email: user.email,
      }),
    ])
    return redirectTo(request, '/dashboard')
  } catch (error) {
    console.error('[auth-callback] erro de ativação', {
      message: error instanceof Error ? error.message : 'unknown',
    })
    return redirectTo(request, '/auth/verificar-email', 'Seu e-mail foi confirmado, mas não conseguimos finalizar a ativação. Tente novamente.')
  }
}
