import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Clock3, ShieldCheck } from 'lucide-react'
import { getCurrentAccount, UnauthorizedError } from '@/lib/auth/account'
import { getEffectiveAccountAccess } from '@/lib/billing/access'
import { TrialExpiredActions } from '@/components/billing/trial-expired-actions'

export const metadata: Metadata = { title: 'Seu teste gratuito terminou', robots: { index: false, follow: false } }

export default async function TrialExpiredPage() {
  let accountId: string
  try { ({ accountId } = await getCurrentAccount()) } catch (error) { if (error instanceof UnauthorizedError) redirect('/login'); throw error }
  const access = await getEffectiveAccountAccess(accountId)
  if (access.isActive) redirect('/dashboard')
  if (access.source !== 'trial') redirect('/planos')

  return <main className="grid min-h-screen place-items-center bg-background px-4 py-12">
    <section className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-7 shadow-2xl sm:p-10">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-500"><Clock3 className="size-7" /></span>
      <p className="mt-6 text-sm font-semibold text-primary">Aunivo Pro</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Seu teste gratuito terminou</h1>
      <p className="mt-4 leading-7 text-muted-foreground">Seus dados continuam seguros. Escolha um plano para continuar usando o Aunivo.</p>
      <div className="my-7 flex items-start gap-3 rounded-2xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-500" /><p>Nenhum contato, funil, tarefa ou relatório foi excluído. Seu espaço será liberado assim que a assinatura for confirmada.</p></div>
      <TrialExpiredActions />
    </section>
  </main>
}
