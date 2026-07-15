import type { Metadata } from 'next'
import { Check, Sparkles } from 'lucide-react'
import { PublicShell } from '@/components/public/public-shell'
import { TrialSignupForm } from '@/components/public/trial-signup-form'

export const metadata: Metadata = {
  title: 'Teste grátis por 14 dias',
  description: 'Crie sua conta e teste todos os recursos do Aunivo Pro por 14 dias, sem cartão de crédito.',
  robots: { index: false, follow: false },
}

export default function CadastroPage() {
  return (
    <PublicShell>
      <main className="relative isolate overflow-hidden px-4 pb-20 pt-28 sm:px-6 lg:pt-36">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_15%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_35%),radial-gradient(circle_at_85%_50%,rgba(16,185,129,.14),transparent_30%)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1fr_.9fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"><Sparkles className="size-4" />14 dias de Aunivo Pro</div>
            <h1 className="mt-6 text-4xl font-bold tracking-[-.04em] sm:text-5xl">Organize seus contatos e vendas com o Aunivo</h1>
            <p className="mt-5 max-w-xl text-lg leading-8 text-muted-foreground">Teste todos os recursos do Aunivo Pro por 14 dias. Organize contatos, negociações, tarefas e resultados em um único lugar.</p>
            <ul className="mt-7 grid gap-3 text-sm sm:grid-cols-2">
              {['14 dias grátis', 'Sem cartão de crédito', 'Sem cobrança automática', 'Configuração rápida'].map((item) => <li key={item} className="flex items-center gap-2"><span className="grid size-6 place-items-center rounded-full bg-emerald-500/10 text-emerald-500"><Check className="size-4" /></span>{item}</li>)}
            </ul>
          </div>
          <TrialSignupForm />
        </div>
      </main>
    </PublicShell>
  )
}
