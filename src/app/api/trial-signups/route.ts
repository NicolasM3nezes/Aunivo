import { createHash, randomBytes } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { LEGAL_DOCUMENTS } from '@/config/legal'
import { supabaseAdmin } from '@/lib/flows/admin-client'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  BUSINESS_SEGMENTS, MARKETING_CONSENT_VERSION, PRIMARY_GOALS, TEAM_SIZES,
  cleanText, isAllowedOption, isValidBrazilianPhone, isValidEmail,
  normalizeBrazilianPhone, normalizeEmail, validatePassword,
} from '@/lib/trials/signup'

export const runtime = 'nodejs'

const COOKIE = 'aunivo_trial_session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')
const clientIp = (request: NextRequest) => request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'

function jsonError(error: string, status = 400, code?: string) {
  return NextResponse.json({ error, ...(code ? { code } : {}) }, { status })
}

function setSession(response: NextResponse, token: string) {
  response.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: SESSION_MAX_AGE,
  })
  return response
}

async function currentSignup(request: NextRequest) {
  const token = request.cookies.get(COOKIE)?.value
  if (!token || token.length < 32) return null
  const { data, error } = await supabaseAdmin().from('trial_signups').select('*').eq('session_token_hash', hashToken(token)).maybeSingle()
  if (error) throw new Error(`Não foi possível recuperar o cadastro: ${error.message}`)
  return data
}

function safeSignup(row: Record<string, unknown>) {
  return {
    fullName: row.full_name, email: row.email, phone: row.phone,
    companyName: row.company_name ?? '', businessSegment: row.business_segment ?? '',
    teamSize: row.team_size ?? '', primaryGoal: row.primary_goal ?? '',
    currentStep: row.current_step, status: row.status,
    marketingOptIn: Boolean(row.marketing_opt_in),
  }
}

export async function GET(request: NextRequest) {
  try {
    const signup = await currentSignup(request)
    return NextResponse.json({ signup: signup ? safeSignup(signup) : null })
  } catch (error) {
    console.error('[trial-signups:get]', { message: error instanceof Error ? error.message : 'unknown' })
    return jsonError('Não foi possível recuperar seu cadastro agora.', 500)
  }
}

export async function POST(request: NextRequest) {
  const rate = checkRateLimit(`trial-signup:${clientIp(request)}`, { limit: 20, windowMs: 60 * 60 * 1000 })
  if (!rate.success) return jsonError('Muitas tentativas. Aguarde alguns minutos e tente novamente.', 429)

  try {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null
    if (!body || typeof body.action !== 'string') return jsonError('Solicitação inválida.')
    if (body.action === 'capture') return capture(request, body)
    if (body.action === 'company') return updateCompany(request, body)
    if (body.action === 'account') return createAccount(request, body)
    return jsonError('Etapa de cadastro inválida.')
  } catch (error) {
    console.error('[trial-signups:post]', { message: error instanceof Error ? error.message : 'unknown' })
    return jsonError('Não foi possível concluir esta etapa. Tente novamente.', 500)
  }
}

async function capture(request: NextRequest, body: Record<string, unknown>) {
  const fullName = cleanText(body.fullName, 120)
  const email = normalizeEmail(body.email)
  const phone = cleanText(body.phone, 30)
  const normalizedPhone = normalizeBrazilianPhone(body.phone)
  if (fullName.length < 2) return jsonError('Informe seu nome completo.')
  if (!isValidEmail(email)) return jsonError('Informe um e-mail válido.')
  if (!isValidBrazilianPhone(normalizedPhone)) return jsonError('Informe um WhatsApp brasileiro válido com DDD.')

  const db = supabaseAdmin()
  const active = await currentSignup(request)
  const { data: profile, error: profileError } = await db.from('profiles').select('user_id,account_id').ilike('email', email).limit(1).maybeSingle()
  if (profileError) throw new Error(profileError.message)
  if (profile) return jsonError('Este e-mail já possui uma conta. Entre para continuar.', 409, 'EXISTING_USER')

  const { data: existing, error: existingError } = await db.from('trial_signups').select('id,session_token_hash,status,auth_user_id').eq('normalized_email', email).maybeSingle()
  if (existingError) throw new Error(existingError.message)
  if (existing && existing.id !== active?.id) {
    const pending = existing.status === 'email_confirmation_pending'
    return jsonError(
      pending
        ? 'Seu cadastro já foi iniciado. Confirme o e-mail enviado para ativar sua conta.'
        : existing.auth_user_id || ['trial_active', 'converted'].includes(existing.status)
          ? 'Este e-mail já possui uma conta. Entre para continuar.'
          : 'Já existe um cadastro com este e-mail. Continue no navegador em que ele foi iniciado.',
      409, pending ? 'SIGNUP_PENDING' : existing.auth_user_id ? 'EXISTING_USER' : 'SIGNUP_IN_PROGRESS',
    )
  }

  const contactPatch = { full_name: fullName, email, normalized_email: email, phone, normalized_phone: normalizedPhone }
  if (active) {
    const { error } = await db.from('trial_signups').update(contactPatch).eq('id', active.id)
    if (error) throw new Error(error.message)
    await db.from('trial_signup_events').insert({ trial_signup_id: active.id, event_type: 'trial_step_1_completed' })
    return NextResponse.json({ signup: { ...safeSignup(active), fullName, email, phone, currentStep: Math.max(1, Number(active.current_step)) } })
  }

  const token = randomBytes(32).toString('base64url')
  const attribution = body.attribution && typeof body.attribution === 'object' ? body.attribution as Record<string, unknown> : {}
  const row = {
    ...contactPatch, session_token_hash: hashToken(token), current_step: 1, status: 'lead_captured',
    landing_path: cleanText(attribution.landingPath, 500) || null,
    referrer: cleanText(attribution.referrer, 1000) || null,
    utm_source: cleanText(attribution.utmSource, 200) || null,
    utm_medium: cleanText(attribution.utmMedium, 200) || null,
    utm_campaign: cleanText(attribution.utmCampaign, 200) || null,
    utm_content: cleanText(attribution.utmContent, 200) || null,
    utm_term: cleanText(attribution.utmTerm, 200) || null,
    gclid: cleanText(attribution.gclid, 300) || null,
    fbclid: cleanText(attribution.fbclid, 300) || null,
  }
  const { data: created, error } = await db.from('trial_signups').insert(row).select('*').single()
  if (error) throw new Error(error.message)
  await db.from('trial_signup_events').insert([
    { trial_signup_id: created.id, event_type: 'trial_form_viewed' },
    { trial_signup_id: created.id, event_type: 'trial_step_1_completed' },
  ])
  return setSession(NextResponse.json({ signup: safeSignup(created) }, { status: 201 }), token)
}

async function updateCompany(request: NextRequest, body: Record<string, unknown>) {
  const signup = await currentSignup(request)
  if (!signup) return jsonError('Sua sessão de cadastro expirou. Preencha seus dados novamente.', 401, 'SESSION_EXPIRED')
  const companyName = cleanText(body.companyName, 160)
  if (companyName.length < 2) return jsonError('Informe o nome da empresa.')
  if (!isAllowedOption(BUSINESS_SEGMENTS, body.businessSegment)) return jsonError('Selecione o segmento da empresa.')
  if (!isAllowedOption(TEAM_SIZES, body.teamSize)) return jsonError('Selecione o tamanho da equipe.')
  if (!isAllowedOption(PRIMARY_GOALS, body.primaryGoal)) return jsonError('Selecione seu principal objetivo.')
  const patch = { company_name: companyName, business_segment: body.businessSegment, team_size: body.teamSize, primary_goal: body.primaryGoal, current_step: 2, status: 'company_profile_completed' }
  const db = supabaseAdmin()
  const { error } = await db.from('trial_signups').update(patch).eq('id', signup.id)
  if (error) throw new Error(error.message)
  await db.from('trial_signup_events').insert({ trial_signup_id: signup.id, event_type: 'trial_step_2_completed' })
  return NextResponse.json({ signup: { ...safeSignup(signup), companyName, businessSegment: body.businessSegment, teamSize: body.teamSize, primaryGoal: body.primaryGoal, currentStep: 2 } })
}

async function createAccount(request: NextRequest, body: Record<string, unknown>) {
  const signup = await currentSignup(request)
  if (!signup) return jsonError('Sua sessão de cadastro expirou. Preencha seus dados novamente.', 401, 'SESSION_EXPIRED')
  if (signup.current_step < 2 || !signup.company_name) return jsonError('Conclua os dados da empresa antes de criar a conta.')
  const passwordError = validatePassword(body.password)
  if (passwordError) return jsonError(passwordError)
  if (body.password !== body.confirmPassword) return jsonError('As senhas não coincidem.')
  if (body.legalAccepted !== true) return jsonError('Aceite os Termos de Uso e a Política de Privacidade.')

  const db = supabaseAdmin()
  const now = new Date().toISOString()
  const marketingOptIn = body.marketingOptIn === true
  let userId = signup.auth_user_id as string | null

  if (!userId) {
    console.info('[trial-signup] cadastro iniciado', { signupId: signup.id })
    const auth = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
    )
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, '')
    const { data, error } = await auth.auth.signUp({
      email: signup.normalized_email,
      password: body.password as string,
      options: {
        emailRedirectTo: `${appUrl}/auth/callback?next=/dashboard`,
        data: {
          full_name: signup.full_name,
          acquisition_pending: true,
          trial_signup_id: signup.id,
          company_name: signup.company_name,
          legal_terms_accepted: true, legal_privacy_accepted: true,
          terms_version: LEGAL_DOCUMENTS.termsOfUse.version,
          privacy_version: LEGAL_DOCUMENTS.privacyPolicy.version,
        },
      },
    })
    if (error || !data.user) {
      if (error?.message.toLowerCase().includes('already')) return jsonError('Seu cadastro já foi iniciado. Confirme o e-mail enviado para ativar sua conta.', 409, 'SIGNUP_PENDING')
      throw new Error(error?.message ?? 'Auth não retornou o usuário criado')
    }
    if (data.user.identities?.length === 0) {
      return jsonError('Este e-mail já possui uma conta no Aunivo. Entre com sua senha para continuar.', 409, 'EXISTING_USER')
    }
    if (data.session || data.user.email_confirmed_at) {
      console.error('[trial-signup] confirmação de e-mail desativada no Supabase', { signupId: signup.id })
      await db.auth.admin.deleteUser(data.user.id)
      return jsonError('Não foi possível iniciar a confirmação por e-mail. Tente novamente mais tarde.', 503)
    }
    userId = data.user.id
    const { error: linkError } = await db.from('trial_signups').update({
      auth_user_id: userId, status: 'email_confirmation_pending',
      marketing_opt_in: marketingOptIn,
      marketing_consent_at: marketingOptIn ? now : null,
      marketing_consent_version: marketingOptIn ? MARKETING_CONSENT_VERSION : null,
      terms_accepted_at: now, terms_version: LEGAL_DOCUMENTS.termsOfUse.version,
      privacy_policy_version: LEGAL_DOCUMENTS.privacyPolicy.version,
    }).eq('id', signup.id)
    if (linkError) {
      await db.auth.admin.deleteUser(userId)
      throw new Error(linkError.message)
    }
    await db.from('trial_signup_events').upsert(
      { trial_signup_id: signup.id, event_type: 'email_confirmation_requested' },
      { onConflict: 'trial_signup_id,event_type', ignoreDuplicates: true },
    )
    console.info('[trial-signup] usuário pendente criado; confirmação solicitada', { signupId: signup.id, userId })
  } else {
    console.info('[trial-signup] tentativa duplicada de cadastro pendente', { signupId: signup.id, userId })
    return NextResponse.json({
      success: true,
      pending: true,
      message: 'Seu cadastro já foi iniciado. Confirme o e-mail enviado para ativar sua conta.',
    })
  }

  return NextResponse.json({
    success: true,
    pending: true,
    message: 'Enviamos um e-mail de confirmação.',
  })
}
