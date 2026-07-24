import { createHash } from 'node:crypto'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidEmail, normalizeEmail } from '@/lib/trials/signup'

export const runtime = 'nodejs'

const genericMessage =
  'Se existir uma conta com este e-mail, enviaremos um link para redefinir sua senha.'
const hash = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24)
const clientIp = (request: NextRequest) =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
  request.headers.get('x-real-ip') ||
  'unknown'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { email?: unknown } | null
  const email = normalizeEmail(body?.email)

  // Keep malformed and unknown addresses indistinguishable to prevent
  // account enumeration. The browser still performs basic type=email validation.
  if (!isValidEmail(email)) return NextResponse.json({ message: genericMessage })

  const rate = checkRateLimit(`password-recovery:${clientIp(request)}:${hash(email)}`, {
    limit: 3,
    windowMs: 15 * 60 * 1000,
  })
  if (!rate.success) {
    return NextResponse.json(
      { message: 'Aguarde alguns minutos antes de solicitar um novo link.' },
      { status: 429 },
    )
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, '')
  const auth = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } },
  )
  const { error } = await auth.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl}/auth/redefinir-senha`,
  })

  if (error) {
    console.warn('[password-recovery] solicitação não enviada', {
      emailHash: hash(email),
      code: error.code,
    })
  } else {
    console.info('[password-recovery] solicitação aceita', { emailHash: hash(email) })
  }

  return NextResponse.json({ message: genericMessage })
}
