'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function MarketingConsent() {
  const [available, setAvailable] = useState(false)
  const [optedIn, setOptedIn] = useState(false)
  const [loading, setLoading] = useState(true)
  useEffect(() => { fetch('/api/account/marketing-consent').then((r) => r.json()).then((data) => { setAvailable(Boolean(data.available)); setOptedIn(Boolean(data.optedIn)) }).finally(() => setLoading(false)) }, [])
  if (loading) return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando preferências...</div>
  if (!available) return null
  async function save() {
    setLoading(true)
    const next = !optedIn
    const response = await fetch('/api/account/marketing-consent', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ optedIn: next }) })
    if (response.ok) { setOptedIn(next); toast.success(next ? 'Comunicações de marketing autorizadas.' : 'Consentimento de marketing revogado.') }
    else toast.error('Não foi possível salvar sua preferência.')
    setLoading(false)
  }
  return <div className="rounded-xl border border-border bg-card p-5"><h3 className="font-semibold">Comunicações do Aunivo</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{optedIn ? 'Você autorizou novidades, dicas e ofertas por e-mail e WhatsApp.' : 'Você não recebe campanhas promocionais. Mensagens essenciais da conta continuam ativas.'}</p><Button type="button" variant="outline" className="mt-4" onClick={() => void save()} disabled={loading}>{optedIn ? 'Revogar consentimento' : 'Autorizar comunicações'}</Button></div>
}
