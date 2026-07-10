import { NextResponse } from 'next/server'
import { BillingAccessError } from './entitlements'
import { ForbiddenError, UnauthorizedError } from '@/lib/auth/account'

export function billingErrorResponse(error: unknown) {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof BillingAccessError) return NextResponse.json({ error: error.message, code: error.code, ...error.detail }, { status: 402 })
  console.error('[billing]', error)
  if (error instanceof Error && (/^STRIPE_.* is required$/.test(error.message) || error.message === 'NEXT_PUBLIC_APP_URL is required')) {
    return NextResponse.json({ error: 'O sistema de pagamentos ainda não foi configurado neste ambiente.', code: 'payments_not_configured' }, { status: 503 })
  }
  return NextResponse.json({ error: 'Billing request failed' }, { status: 500 })
}
