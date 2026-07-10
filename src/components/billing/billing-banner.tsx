'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { AccountEntitlements, BillingRow } from '@/lib/billing/types'

interface State { entitlements: AccountEntitlements; billing: BillingRow | null; canManage: boolean }

export function BillingBanner() {
  const t = useTranslations('Billing.banner')
  const [state, setState] = useState<State | null>(null)
  useEffect(() => { let alive = true; void fetch('/api/billing/state', { cache: 'no-store' }).then((r) => r.ok ? r.json() : null).then((value: State | null) => { if (alive) setState(value) }); return () => { alive = false } }, [])
  if (!state) return null
  const pastDue = state.entitlements.status === 'past_due'
  const canceling = state.billing?.cancel_at_period_end
  if (!pastDue && !canceling) return null
  const message = pastDue ? (state.entitlements.access === 'grace' ? t('grace') : t('overdue')) : t('canceling')
  return <div role="status" className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-900 dark:text-amber-100">{message} {state.canManage ? <Link className="font-semibold underline" href="/settings?tab=billing">{t('action')}</Link> : t('askOwner')}</div>
}
