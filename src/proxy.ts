import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isV1DisabledApi, isV1DisabledPage } from '@/config/features'
import { getEffectiveAccountAccess } from '@/lib/billing/access'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // getUser() transparently refreshes an expired access token, which
  // ROTATES the refresh token and writes the new cookies onto
  // `supabaseResponse` via setAll() above. Any response we return in
  // place of `supabaseResponse` (every redirect / JSON branch below)
  // is a fresh object that does NOT carry those Set-Cookie headers, so
  // the rotated token never reaches the browser. The next request then
  // replays the old, now-consumed refresh token, the refresh fails, and
  // the session wedges — the user gets a broken reload after idling and
  // can only recover by manually clearing cookies (issue #288). Copy the
  // refreshed cookies onto whatever response we hand back to fix that.
  const withRefreshedCookies = <T extends NextResponse>(response: T): T => {
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie)
    })
    return response
  }

  if (isV1DisabledApi(request.nextUrl.pathname)) {
    if (!user) {
      return withRefreshedCookies(NextResponse.json({ error: 'UNAUTHORIZED', message: 'Sua sessão expirou. Entre novamente.' }, { status: 401 }))
    }
    return withRefreshedCookies(NextResponse.json({
      error: 'FEATURE_DISABLED',
      message: 'Este recurso não está disponível na versão atual do Aunivo.',
    }, { status: 403 }))
  }

  if (isV1DisabledPage(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = 'recurso=indisponivel'
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // Auth pages - redirect to dashboard if already logged in.
  // Exception: when an invite token is in the query string we
  // send the already-signed-in user to /join/<token> instead so
  // they can accept the invitation in one click. Without this,
  // a forwarded invite link to someone who's already signed in
  // would silently drop them on /dashboard.
  if (user && (
    request.nextUrl.pathname === '/login' ||
    request.nextUrl.pathname === '/signup' ||
    request.nextUrl.pathname === '/cadastro' ||
    request.nextUrl.pathname === '/forgot-password'
  )) {
    const url = request.nextUrl.clone()
    const inviteToken = request.nextUrl.searchParams.get('invite')
    if (
      inviteToken &&
      (request.nextUrl.pathname === '/login' ||
        request.nextUrl.pathname === '/signup' ||
        request.nextUrl.pathname === '/cadastro')
    ) {
      url.pathname = `/join/${encodeURIComponent(inviteToken)}`
      url.search = ''
    } else {
      const selectedPlan = request.nextUrl.searchParams.get('plan')
      if (selectedPlan === 'free' || selectedPlan === 'pro') {
        url.pathname = '/checkout'
        url.search = `plan=${selectedPlan}`
      } else {
        url.pathname = '/dashboard'
        url.search = ''
      }
    }
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // Protected pages - redirect to login if not authenticated
  const protectedPaths = ['/dashboard', '/inbox', '/contacts', '/pipelines', '/tasks', '/notifications', '/reports', '/broadcasts', '/automations', '/flows', '/agents', '/settings', '/configuracoes', '/assinatura']
  if (!user && protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return withRefreshedCookies(NextResponse.redirect(url))
  }

  // A Supabase account is created before checkout, but application access only
  // starts after Stripe confirms a paid Basic/Business subscription or the Pro
  // trial. Billing, checkout and portal routes remain reachable for recovery.
  const isProtectedPage = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))
  const isBillingRecoveryPage =
    request.nextUrl.pathname === '/assinatura' ||
    request.nextUrl.pathname.startsWith('/configuracoes/assinatura') ||
    (request.nextUrl.pathname === '/settings' && request.nextUrl.searchParams.get('tab') === 'billing')
  const gatedApiPrefixes = ['/api/account', '/api/ai', '/api/automations', '/api/flows', '/api/quick-replies', '/api/tasks']
  const isGatedApi = gatedApiPrefixes.some(path => request.nextUrl.pathname.startsWith(path)) ||
    (request.nextUrl.pathname.startsWith('/api/whatsapp/') && !request.nextUrl.pathname.includes('/webhook'))

  if (user && ((isProtectedPage && !isBillingRecoveryPage) || isGatedApi)) {
    const { data: profile } = await supabase.from('profiles').select('account_id').eq('user_id', user.id).maybeSingle()
    const access = profile?.account_id
      ? await getEffectiveAccountAccess(profile.account_id)
      : null

    if (!access?.isActive) {
      if (isGatedApi) {
        return withRefreshedCookies(NextResponse.json({ error: 'SUBSCRIPTION_REQUIRED', message: 'Escolha um plano para continuar usando o Aunivo.' }, { status: 402 }))
      }
      const url = request.nextUrl.clone()
      url.pathname = '/planos'
      url.search = ''
      url.searchParams.set('assinatura', 'necessaria')
      url.searchParams.set('next', request.nextUrl.pathname)
      return withRefreshedCookies(NextResponse.redirect(url))
    }
  }

  // API routes that need auth (not webhooks)
  if (!user && request.nextUrl.pathname.startsWith('/api/whatsapp/') &&
      !request.nextUrl.pathname.includes('/webhook')) {
    return withRefreshedCookies(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    )
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
