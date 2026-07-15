'use client'

import { useCallback, useEffect, useState } from 'react'
import type { AccountEntitlements } from '@/lib/billing/types'

type BillingStateResponse = { entitlements?: AccountEntitlements; error?: string }

export function useAccountEntitlements(accountId: string | null | undefined) {
  const [entitlements, setEntitlements] = useState<AccountEntitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (showLoading: boolean): Promise<AccountEntitlements | null> => {
    if (!accountId) {
      setEntitlements(null)
      setLoading(false)
      return null
    }

    if (showLoading) setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/billing/state', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({})) as BillingStateResponse
      if (!response.ok || !payload.entitlements) {
        throw new Error(payload.error ?? 'Não foi possível carregar os limites da conta.')
      }
      setEntitlements(payload.entitlements)
      return payload.entitlements
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Não foi possível carregar os limites da conta.'
      setEntitlements(null)
      setError(message)
      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [accountId])

  const refresh = useCallback(() => load(true), [load])

  useEffect(() => {
    setEntitlements(null)
    setLoading(true)
    void load(true)
  }, [load])

  useEffect(() => {
    const reload = () => { void load(false) }
    const interval = window.setInterval(reload, 60_000)
    window.addEventListener('focus', reload)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', reload)
    }
  }, [load])

  return { entitlements, loading, error, refresh }
}
