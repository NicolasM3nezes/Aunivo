'use client'

import { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { trackMetaInitiateCheckout } from '@/lib/analytics/meta-pixel'
import { Button } from '@/components/ui/button'

export default function CheckoutPage() {
  return <Suspense fallback={<CheckoutStatus />}><CheckoutFlow /></Suspense>
}

function CheckoutFlow() {
  const search = useSearchParams()
  const started = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const plan = search.get('plan') === 'pro' ? 'pro' : search.get('plan') === 'free' ? 'free' : null

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!plan) return
    void (async () => {
      const { data } = await createClient().auth.getUser()
      if (!data.user) {
        window.location.replace(`/cadastro?plan=${plan}`)
        return
      }
      const response = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planKey: plan, interval: 'monthly' }),
      })
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string; portal?: boolean; reused?: boolean } | null
      if (!response.ok || !payload?.url) throw new Error(payload?.error ?? 'Não foi possível iniciar o pagamento.')
      if (!payload.portal && !payload.reused) trackMetaInitiateCheckout(plan)
      window.location.replace(payload.url)
    })().catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Não foi possível iniciar o pagamento.'))
  }, [plan])

  return !plan ? <CheckoutStatus error="Selecione o plano Basic ou Pro." /> : error ? <CheckoutStatus error={error} /> : <CheckoutStatus />
}

function CheckoutStatus({ error }: { error?: string }) {
  return <main className="grid min-h-screen place-items-center bg-background px-4"><div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">{error ? <><h1 className="text-xl font-semibold">Não foi possível abrir o pagamento</h1><p className="mt-3 text-sm text-muted-foreground">{error}</p><Button render={<Link href="/planos" />} className="mt-6">Voltar aos planos</Button></> : <><Loader2 className="mx-auto size-8 animate-spin text-primary" /><h1 className="mt-4 text-xl font-semibold">Preparando seu pagamento seguro</h1><p className="mt-2 text-sm text-muted-foreground">Você será direcionado ao Stripe Checkout.</p></>}</div></main>
}
