import Link from 'next/link'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>
}) {
  const { erro } = await searchParams
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <section className="w-full max-w-lg rounded-2xl border bg-card p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">Confirme seu acesso ao Aunivo</h1>
        <p className="mt-4 text-muted-foreground">
          {erro || 'Enviamos um e-mail de confirmação. Acesse sua caixa de entrada para ativar sua conta e iniciar seu teste gratuito de 14 dias.'}
        </p>
        <p className="mt-6 text-sm text-muted-foreground">
          Já confirmou? <Link className="font-medium text-primary underline" href="/login">Entre com sua senha</Link>.
        </p>
      </section>
    </main>
  )
}
