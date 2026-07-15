'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LEGAL_DOCUMENTS } from '@/config/legal'
import { BUSINESS_SEGMENTS, MARKETING_CONSENT_VERSION, PRIMARY_GOALS, TEAM_SIZES, formatBrazilianPhone } from '@/lib/trials/signup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type FormState = {
  fullName: string; email: string; phone: string; companyName: string
  businessSegment: string; teamSize: string; primaryGoal: string
  password: string; confirmPassword: string; legalAccepted: boolean; marketingOptIn: boolean
}

const initialForm: FormState = {
  fullName: '', email: '', phone: '', companyName: '', businessSegment: '', teamSize: '', primaryGoal: '',
  password: '', confirmPassword: '', legalAccepted: false, marketingOptIn: false,
}

type ApiPayload = { error?: string; code?: string; signup?: Partial<FormState> & { currentStep?: number; status?: string }; success?: boolean }

export function TrialSignupForm() {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(initialForm)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const firstInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    let active = true
    fetch('/api/trial-signups').then(async (response) => response.json()).then((payload: ApiPayload) => {
      if (!active || !payload.signup) return
      setForm((current) => ({ ...current, ...payload.signup, password: '', confirmPassword: '' }))
      setStep(Math.min(3, Math.max(1, Number(payload.signup.currentStep ?? 1) + (Number(payload.signup.currentStep) < 3 ? 1 : 0))))
    }).catch(() => undefined).finally(() => active && setRestoring(false))
    return () => { active = false }
  }, [])

  useEffect(() => { if (!restoring) firstInput.current?.focus() }, [step, restoring])

  const progress = useMemo(() => `${Math.round((step / 3) * 100)}%`, [step])
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }))

  async function submit(action: 'capture' | 'company' | 'account') {
    if (loading) return
    setLoading(true); setError(null)
    const params = new URLSearchParams(window.location.search)
    const attribution = {
      landingPath: `${window.location.pathname}${window.location.search}`,
      referrer: document.referrer || '', utmSource: params.get('utm_source') || '', utmMedium: params.get('utm_medium') || '',
      utmCampaign: params.get('utm_campaign') || '', utmContent: params.get('utm_content') || '', utmTerm: params.get('utm_term') || '',
      gclid: params.get('gclid') || '', fbclid: params.get('fbclid') || '',
    }
    try {
      const response = await fetch('/api/trial-signups', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action, ...form, attribution }),
      })
      const payload = await response.json().catch(() => null) as ApiPayload | null
      if (!response.ok) {
        setError(payload?.error ?? 'Não foi possível concluir esta etapa.')
        if (payload?.code === 'EXISTING_USER') setTimeout(() => router.push('/login'), 1200)
        return
      }
      if (action === 'capture') setStep(2)
      else if (action === 'company') setStep(3)
      else {
        const { error: signInError } = await createClient().auth.signInWithPassword({ email: form.email.trim().toLowerCase(), password: form.password })
        if (signInError) { setError('Sua conta foi criada. Entre com seu e-mail e senha para continuar.'); setTimeout(() => router.push('/login'), 1500); return }
        router.push('/dashboard')
        router.refresh()
      }
    } catch {
      setError('Não foi possível concluir seu cadastro. Verifique sua conexão e tente novamente.')
    } finally { setLoading(false) }
  }

  return (
    <div id="teste-gratis" className="min-w-0 overflow-visible scroll-mt-24 rounded-[2rem] border border-border/70 bg-card/95 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-semibold text-primary">Comece seu teste grátis</p><h2 className="mt-1 text-xl font-bold">Crie seu espaço no Aunivo</h2><p className="mt-1 text-sm text-muted-foreground">Em poucos minutos, sem cartão.</p></div>
        <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Etapa {step} de 3</span>
      </div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`Progresso: etapa ${step} de 3`}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: progress }} /></div>

      <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit(step === 1 ? 'capture' : step === 2 ? 'company' : 'account') }} noValidate>
        {error ? <div id="trial-form-error" role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}

        {step === 1 ? <>
          <Field label="Nome completo" id="trial-full-name"><Input ref={firstInput} id="trial-full-name" autoComplete="name" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} placeholder="Digite seu nome completo" required aria-invalid={Boolean(error)} /></Field>
          <Field label="E-mail profissional" id="trial-email"><Input id="trial-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="Digite seu melhor e-mail" required /></Field>
          <Field label="WhatsApp com DDD" id="trial-phone"><Input id="trial-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => update('phone', formatBrazilianPhone(e.target.value))} placeholder="(11) 99999-9999" required /></Field>
        </> : null}

        {step === 2 ? <>
          <Field label="Nome da empresa" id="trial-company"><Input ref={firstInput} id="trial-company" autoComplete="organization" value={form.companyName} onChange={(e) => update('companyName', e.target.value)} required /></Field>
          <SelectField label="Segmento" id="trial-segment" value={form.businessSegment} options={BUSINESS_SEGMENTS} onChange={(value) => update('businessSegment', value)} />
          <SelectField label="Tamanho da equipe" id="trial-team" value={form.teamSize} options={TEAM_SIZES} onChange={(value) => update('teamSize', value)} />
          <SelectField label="Principal objetivo com o Aunivo" id="trial-goal" value={form.primaryGoal} options={PRIMARY_GOALS} onChange={(value) => update('primaryGoal', value)} />
        </> : null}

        {step === 3 ? <>
          <Field label="Senha" id="trial-password" hint="Mínimo de 8 caracteres, com uma letra e um número."><Input ref={firstInput} id="trial-password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => update('password', e.target.value)} required /></Field>
          <Field label="Confirme sua senha" id="trial-confirm-password"><Input id="trial-confirm-password" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => update('confirmPassword', e.target.value)} required /></Field>
          <label className="flex items-start gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.legalAccepted} onChange={(e) => update('legalAccepted', e.target.checked)} required /><span>Ao criar minha conta, declaro que li e aceito os <Link href={LEGAL_DOCUMENTS.termsOfUse.route} target="_blank" rel="noopener noreferrer" className="text-primary underline">Termos de Uso</Link> e a <Link href={LEGAL_DOCUMENTS.privacyPolicy.route} target="_blank" rel="noopener noreferrer" className="text-primary underline">Política de Privacidade</Link> do Aunivo.</span></label>
          <label className="flex items-start gap-3 text-sm leading-6 text-muted-foreground"><input type="checkbox" className="mt-1 size-4 accent-primary" checked={form.marketingOptIn} onChange={(e) => update('marketingOptIn', e.target.checked)} /><span>Quero receber novidades, dicas e ofertas do Aunivo por e-mail e WhatsApp. <span className="sr-only">Versão {MARKETING_CONSENT_VERSION}</span></span></label>
        </> : null}

        <div className="flex gap-3 pt-1">
          {step > 1 ? <Button type="button" variant="outline" onClick={() => { setError(null); setStep((current) => current - 1) }} disabled={loading}><ArrowLeft />Voltar</Button> : null}
          <Button type="submit" className="h-11 flex-1" disabled={loading || restoring || (step === 3 && !form.legalAccepted)}>{loading || restoring ? <Loader2 className="animate-spin" /> : step === 3 ? <ShieldCheck /> : null}{loading ? 'Aguarde...' : step === 3 ? 'Criar minha conta grátis' : 'Continuar grátis'}{!loading && step < 3 ? <ArrowRight /> : null}</Button>
        </div>
      </form>
      <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground"><Check className="size-3.5 text-emerald-500" />14 dias grátis. Não é necessário cartão de crédito.</p>
    </div>
  )
}

function Field({ label, id, hint, children }: { label: string; id: string; hint?: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{children}{hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}</div>
}

function SelectField({ label, id, value, options, onChange }: { label: string; id: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value || null} onValueChange={(nextValue) => onChange(nextValue ?? '')} required>
        <SelectTrigger
          id={id}
          className="h-11 w-full min-w-0 gap-2 rounded-xl px-3 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate"
        >
          <SelectValue placeholder="Selecione uma opção" />
        </SelectTrigger>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          collisionAvoidance={{ side: 'flip', align: 'shift', fallbackAxisSide: 'none' }}
          collisionPadding={8}
          sideOffset={6}
          positionerClassName="z-[100] max-w-[calc(100vw-2rem)]"
          className="z-[100] max-h-[min(240px,var(--available-height))] w-(--anchor-width) min-w-(--anchor-width) max-w-[calc(100vw-2rem)] overflow-x-hidden overflow-y-auto [&_[data-slot=select-item-text]]:min-w-0 [&_[data-slot=select-item-text]]:shrink [&_[data-slot=select-item-text]]:whitespace-normal [&_[data-slot=select-item-text]]:break-words"
        >
          {options.map((option) => (
            <SelectItem key={option} value={option} className="min-h-10 min-w-0 py-2">
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
