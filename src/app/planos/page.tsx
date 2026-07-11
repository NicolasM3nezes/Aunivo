import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Check,
  CircleCheck,
  Crown,
  Headphones,
  MessageCircleMore,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  Zap,
} from 'lucide-react';

import { PublicShell } from '@/components/public/public-shell';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { PLAN_DISPLAY } from '@/config/plans';

export const metadata: Metadata = {
  title: 'Planos e preços — Aunivo',
  description:
    'Compare os planos Basic, Pro e Business do Aunivo para automatizar atendimento e vendas pelo WhatsApp.',
  alternates: {
    canonical: '/planos',
  },
};

const plans = [
  {
    key: 'free',
    name: PLAN_DISPLAY.free.name,
    badge: 'Para começar',
    description: PLAN_DISPLAY.free.description,
    price: PLAN_DISPLAY.free.price,
    priceSuffix: '',
    cta: PLAN_DISPLAY.free.cta,
    href: '/cadastro?plan=free',
    featured: false,
    icon: Sparkles,
    features: [
      '1 usuário',
      'Até 200 contatos',
      '1 funil de vendas',
      '1 automação ativa',
      '25 respostas de IA por mês',
      'Caixa de entrada compartilhada',
    ],
  },
  {
    key: 'pro',
    name: PLAN_DISPLAY.pro.name,
    badge: 'Mais escolhido',
    description: PLAN_DISPLAY.pro.description,
    price: PLAN_DISPLAY.pro.price,
    priceSuffix: '',
    cta: PLAN_DISPLAY.pro.cta,
    href: '/planos',
    featured: true,
    icon: Crown,
    features: [
      'Até 3 usuários',
      'Até 5.000 contatos',
      'Até 5 funis',
      'Até 25 automações',
      '2.000 respostas de IA por mês',
      'Campanhas e fluxos inteligentes',
      'Base de conhecimento',
      'Indicadores operacionais',
    ],
  },
  {
    key: 'business',
    name: PLAN_DISPLAY.business.name,
    badge: 'Sob medida',
    description: PLAN_DISPLAY.business.description,
    price: PLAN_DISPLAY.business.price,
    priceSuffix: '',
    cta: PLAN_DISPLAY.business.cta,
    href: '#contato',
    featured: false,
    icon: UsersRound,
    features: [
      'Usuários personalizados',
      'Volume de contatos sob medida',
      'Funis e automações avançadas',
      'Maior capacidade de IA',
      'API, webhooks e MCP',
      'Implantação personalizada',
      'Suporte prioritário',
      'Condições comerciais especiais',
    ],
  },
] as const;

const comparison = [
  ['Usuários', '1', 'Até 3', 'Personalizado'],
  ['Contatos', 'Até 200', 'Até 5.000', 'Sob medida'],
  ['Funis', '1', 'Até 5', 'Personalizado'],
  ['Automações', '1', 'Até 25', 'Personalizado'],
  ['Campanhas', '—', 'Incluídas', 'Incluídas'],
  ['Respostas de IA', '25/mês', '2.000/mês', 'Sob medida'],
  ['Base de conhecimento', '—', 'Incluída', 'Incluída'],
  ['API, webhooks e MCP', '—', '—', 'Incluídos'],
  ['Suporte prioritário', '—', 'Incluído', 'Incluído'],
] as const;

const benefits = [
  {
    title: 'Comece com baixo investimento',
    description: `Tenha acesso ao essencial por apenas ${PLAN_DISPLAY.free.price}.`,
    icon: ShieldCheck,
  },
  {
    title: 'Cresça no seu ritmo',
    description: 'Faça upgrade quando sua operação realmente precisar.',
    icon: Zap,
  },
  {
    title: 'Venda com mais contexto',
    description: 'Conversas, contatos e oportunidades em um só lugar.',
    icon: MessageCircleMore,
  },
  {
    title: 'Automatize o repetitivo',
    description: 'Sua equipe foca em negociação e relacionamento.',
    icon: Workflow,
  },
] as const;

const faqs = [
  {
    value: 'basic',
    question: `Quanto custa o plano ${PLAN_DISPLAY.free.name}?`,
    answer: `O plano ${PLAN_DISPLAY.free.name} custa ${PLAN_DISPLAY.free.price} e inclui os recursos essenciais para começar a organizar o atendimento e usar automação no Aunivo.`,
  },
  {
    value: 'pro',
    question: `O plano ${PLAN_DISPLAY.pro.name} custa ${PLAN_DISPLAY.pro.price}?`,
    answer: `Sim. O plano ${PLAN_DISPLAY.pro.name} custa ${PLAN_DISPLAY.pro.price} e é indicado para pequenas equipes que querem usar automações, IA, campanhas e recursos comerciais mais completos.`,
  },
  {
    value: 'business',
    question: 'Como funciona o preço do Business?',
    answer:
      'O Business é personalizado. O valor depende do número de usuários, volume de contatos, capacidade de IA, implantação e necessidades específicas da empresa.',
  },
  {
    value: 'change',
    question: 'Posso trocar de plano depois?',
    answer:
      'Sim. Você pode começar no Basic, migrar para o Pro e conversar com o comercial quando precisar de uma estrutura Business.',
  },
  {
    value: 'cancel',
    question: 'O que acontece ao cancelar?',
    answer:
      'Quando o cancelamento é agendado para o fim do período, os recursos pagos permanecem disponíveis até a data final da assinatura. Seus dados não são apagados automaticamente.',
  },
] as const;

export default function PlansPage() {
  const salesUrl = process.env.NEXT_PUBLIC_SALES_CONTACT_URL?.trim();

  return (
    <PublicShell>
      <main className="overflow-hidden">
        <section className="border-border/60 relative isolate border-b">
          <div className="bg-background absolute inset-0 -z-20" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_10%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_34%),radial-gradient(circle_at_90%_20%,rgba(16,185,129,.16),transparent_30%)]" />
          <div className="via-primary/50 absolute top-0 left-1/2 -z-10 h-px w-[82%] -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent" />

          <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 lg:py-28">
            <div className="border-primary/20 bg-primary/[0.07] text-primary inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-sm">
              <Sparkles className="size-4" />
              Planos simples, claros e pensados para crescer
            </div>

            <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-[-.045em] sm:text-5xl lg:text-6xl">
              Escolha o plano que transforma seu WhatsApp em uma{' '}
              <span className="from-primary bg-gradient-to-r via-blue-500 to-emerald-400 bg-clip-text text-transparent">
                operação comercial de verdade
              </span>
            </h1>

            <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-lg leading-8">
              Comece pelo Basic, automatize sua rotina com o Pro e avance para
              uma estrutura personalizada quando sua empresa crescer.
            </p>

            <div className="text-muted-foreground mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm">
              <span className="inline-flex items-center gap-2">
                <CircleCheck className="size-4 text-emerald-500" />
                {PLAN_DISPLAY.free.name} por {PLAN_DISPLAY.free.price}
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleCheck className="size-4 text-emerald-500" />
                Upgrade quando precisar
              </span>
              <span className="inline-flex items-center gap-2">
                <CircleCheck className="size-4 text-emerald-500" />
                Business sob medida
              </span>
            </div>
          </div>
        </section>

        <section className="border-border/60 bg-muted/20 border-b">
          <div className="divide-border/60 mx-auto grid max-w-7xl divide-y px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-8">
            {benefits.map(({ title, description, icon: Icon }) => (
              <div key={title} className="flex gap-4 px-4 py-7">
                <span className="border-primary/10 bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-2xl border">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-primary text-sm font-semibold tracking-[.18em] uppercase">
              Planos Aunivo
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
              Comece pelo Basic. Evolua para o que gera resultado.
            </h2>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl leading-7">
              Todos os planos foram pensados para reduzir tarefas manuais e
              ajudar sua equipe a responder melhor, acompanhar mais e vender com
              mais clareza.
            </p>
          </div>

          <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;

              return (
                <article
                  key={plan.key}
                  className={
                    plan.featured
                      ? 'border-primary bg-card shadow-primary/15 relative flex h-full flex-col overflow-hidden rounded-[2rem] border-2 shadow-2xl'
                      : 'border-border/70 bg-card relative flex h-full flex-col overflow-hidden rounded-[2rem] border shadow-sm'
                  }
                >
                  {plan.featured ? (
                    <div className="from-primary bg-gradient-to-r to-emerald-500 px-4 py-2.5 text-center text-xs font-semibold tracking-[.16em] text-white uppercase">
                      {plan.badge}
                    </div>
                  ) : null}

                  <div className="flex h-full flex-col p-7">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        {!plan.featured ? (
                          <p className="text-muted-foreground text-xs font-semibold tracking-[.16em] uppercase">
                            {plan.badge}
                          </p>
                        ) : null}
                        <h3 className="mt-2 text-2xl font-bold tracking-tight">
                          {plan.name}
                        </h3>
                      </div>

                      <span
                        className={
                          plan.featured
                            ? 'bg-primary text-primary-foreground shadow-primary/20 grid size-11 shrink-0 place-items-center rounded-2xl shadow-lg'
                            : 'bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-2xl'
                        }
                      >
                        <Icon className="size-5" />
                      </span>
                    </div>

                    <div className="mt-6 flex min-h-14 items-end gap-1">
                      <span className="text-4xl font-bold tracking-[-.045em]">
                        {plan.price}
                      </span>
                      {plan.priceSuffix ? (
                        <span className="text-muted-foreground pb-1 text-sm">
                          {plan.priceSuffix}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-muted-foreground mt-4 min-h-20 text-sm leading-6">
                      {plan.description}
                    </p>

                    {plan.key === 'business' && salesUrl ? (
                      <Button
                        render={
                          <a href={salesUrl} target="_blank" rel="noreferrer" />
                        }
                        className="mt-6 h-11 w-full rounded-xl"
                        variant="outline"
                      >
                        {plan.cta}
                        <ArrowRight className="size-4" />
                      </Button>
                    ) : (
                      <Button
                        render={<Link href={plan.href} />}
                        className="mt-6 h-11 w-full rounded-xl"
                        variant={plan.featured ? 'default' : 'outline'}
                      >
                        {plan.cta}
                        <ArrowRight className="size-4" />
                      </Button>
                    )}

                    <div className="bg-border/70 my-7 h-px" />

                    <p className="text-sm font-semibold">
                      O que está incluído:
                    </p>

                    <ul className="mt-4 space-y-3">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="text-muted-foreground flex items-start gap-3 text-sm"
                        >
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-emerald-500">
                            <Check className="size-3.5" />
                          </span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-center text-sm">
            O plano Business é personalizado. Nossa equipe entende sua operação
            e monta uma proposta conforme usuários, volume e necessidades.
          </p>
        </section>

        <section className="border-border/60 bg-muted/20 border-y">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-primary text-sm font-semibold tracking-[.18em] uppercase">
                Comparação detalhada
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                Veja o que muda em cada plano
              </h2>
              <p className="text-muted-foreground mx-auto mt-5 max-w-2xl leading-7">
                Compare os principais limites e escolha a opção mais adequada
                para o momento da sua operação.
              </p>
            </div>

            <div className="border-border/70 bg-card mt-12 hidden overflow-hidden rounded-3xl border shadow-sm md:block">
              <div className="border-border/70 bg-muted/40 grid grid-cols-4 border-b px-6 py-5 text-sm font-semibold">
                <span>Recurso</span>
                <span>{PLAN_DISPLAY.free.name}</span>
                <span className="text-primary">Pro</span>
                <span>Business</span>
              </div>

              {comparison.map((row) => (
                <div
                  key={row[0]}
                  className="border-border/70 grid grid-cols-4 border-b px-6 py-4 text-sm last:border-0"
                >
                  <strong className="font-semibold">{row[0]}</strong>
                  <span className="text-muted-foreground">{row[1]}</span>
                  <span className="text-foreground font-medium">{row[2]}</span>
                  <span className="text-muted-foreground">{row[3]}</span>
                </div>
              ))}
            </div>

            <div className="mt-10 grid gap-4 md:hidden">
              {comparison.map((row) => (
                <article
                  key={row[0]}
                  className="border-border/70 bg-card rounded-2xl border p-5 shadow-sm"
                >
                  <h3 className="font-semibold">{row[0]}</h3>
                  <dl className="mt-4 grid grid-cols-3 gap-3 text-xs">
                    <div>
                      <dt className="font-semibold">
                        {PLAN_DISPLAY.free.name}
                      </dt>
                      <dd className="text-muted-foreground mt-1 leading-5">
                        {row[1]}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-primary font-semibold">Pro</dt>
                      <dd className="text-foreground mt-1 leading-5">
                        {row[2]}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Business</dt>
                      <dd className="text-muted-foreground mt-1 leading-5">
                        {row[3]}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="contato"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
        >
          <div className="shadow-primary/20 relative isolate overflow-hidden rounded-[2rem] bg-[#071126] px-6 py-16 text-white shadow-2xl sm:px-12">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,rgba(79,70,229,.65),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,.45),transparent_35%)]" />

            <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-sm text-white/80 backdrop-blur">
                  <Headphones className="size-4 text-emerald-300" />
                  Atendimento comercial
                </div>

                <h2 className="mt-5 max-w-2xl text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                  Sua operação precisa de mais usuários, volume ou integração?
                </h2>

                <p className="mt-4 max-w-2xl leading-7 text-white/70">
                  Converse com nosso time e receba uma proposta Business criada
                  para a realidade da sua empresa.
                </p>
              </div>

              <div className="lg:text-right">
                {salesUrl ? (
                  <Button
                    render={
                      <a href={salesUrl} target="_blank" rel="noreferrer" />
                    }
                    size="lg"
                    variant="secondary"
                    className="h-12 rounded-xl px-6"
                  >
                    Falar com um especialista
                    <ArrowRight className="size-4" />
                  </Button>
                ) : (
                  <Button
                    render={<Link href="/contato" />}
                    size="lg"
                    variant="secondary"
                    className="h-12 rounded-xl px-6"
                  >
                    Falar com um especialista
                    <ArrowRight className="size-4" />
                  </Button>
                )}

                <p className="mt-3 text-xs text-white/50">
                  Sem compromisso. Entendemos sua necessidade primeiro.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="border-border/60 bg-muted/20 border-t">
          <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:py-28">
            <div className="text-center">
              <p className="text-primary text-sm font-semibold tracking-[.18em] uppercase">
                Perguntas frequentes
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                Dúvidas antes de escolher
              </h2>
            </div>

            <Accordion className="border-border/70 bg-card mt-10 rounded-3xl border px-5 shadow-sm sm:px-7">
              {faqs.map((faq) => (
                <AccordionItem key={faq.value} value={faq.value}>
                  <AccordionTrigger className="py-5 text-left text-base font-semibold">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground pb-5 leading-7">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <span className="bg-primary/10 text-primary mx-auto grid size-14 place-items-center rounded-2xl">
              <Bot className="size-6" />
            </span>

            <h2 className="mt-6 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
              Comece hoje a construir um atendimento que vende melhor
            </h2>

            <p className="text-muted-foreground mx-auto mt-4 max-w-2xl leading-7">
              Comece pelo plano Basic e veja como o Aunivo pode organizar sua
              operação desde a primeira conversa.
            </p>

            <Button
              render={<Link href="/cadastro?plan=free" />}
              size="lg"
              className="shadow-primary/20 mt-8 h-12 rounded-xl px-6 shadow-lg"
            >
              {PLAN_DISPLAY.free.cta}
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}
