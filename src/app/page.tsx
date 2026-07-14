import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarCheck,
  Check,
  ChevronRight,
  Clock3,
  HeartPulse,
  Home,
  Inbox,
  MessageCircle,
  MessagesSquare,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  UserRoundCheck,
  UsersRound,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';

import { PublicShell } from '@/components/public/public-shell';
import { LandingCheckoutButton } from '@/components/public/landing-checkout-button';
import { Button } from '@/components/ui/button';
import { PLAN_DISPLAY } from '@/config/plans';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

export const metadata: Metadata = {
  metadataBase: new URL("https://www.aunivo.com.br"),

  title: "Aunivo — CRM simples para pequenas empresas",

  description:
    "Organize seus clientes, acompanhe negociações e mantenha cada próximo passo sob controle.",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "/",
    siteName: "Aunivo",
    title: "Aunivo — CRM simples para pequenas empresas",
    description:
      "Organize seus clientes, acompanhe negociações e mantenha cada próximo passo sob controle.",
  },

  twitter: {
    card: "summary_large_image",
    title: "Aunivo — CRM simples para pequenas empresas",
    description:
      "Organize seus clientes, acompanhe negociações e mantenha cada próximo passo sob controle.",
  },
};

const benefits = [
  {
    title: 'Contatos centralizados',
    description: 'Dados, observações e histórico reunidos em um só lugar.',
    icon: Clock3,
  },
  {
    title: 'Retornos no prazo',
    description: 'Saiba quais clientes precisam de acompanhamento.',
    icon: MessageCircle,
  },
  {
    title: 'Vendas organizadas',
    description: 'Contatos, etapas e oportunidades sempre visíveis.',
    icon: UserRoundCheck,
  },
  {
    title: 'Mais foco no cliente',
    description: 'Priorize negociações e não perca oportunidades.',
    icon: Sparkles,
  },
] as const;

const features = [
  {
    title: 'Gestão de contatos',
    description: 'Organize clientes, empresas, telefones, e-mails e observações.',
    icon: Bot,
  },
  {
    title: 'Lembretes de retorno',
    description: 'Agende o próximo contato e veja retornos de hoje e atrasados.',
    icon: UserRoundCheck,
  },
  {
    title: 'Histórico do cliente',
    description: 'Mantenha observações e o contexto comercial de cada cliente.',
    icon: Inbox,
  },
  {
    title: 'Funil de vendas',
    description:
      'Acompanhe oportunidades por etapa e visualize o avanço de cada negociação.',
    icon: BarChart3,
  },
  {
    title: 'Dashboard simples',
    description: 'Acompanhe contatos, negociações, resultados e retornos.',
    icon: Workflow,
  },
  {
    title: 'Relatórios comerciais',
    description: 'Visualize ganhos, perdas, valores e ticket médio.',
    icon: MessagesSquare,
  },
  {
    title: 'Etiquetas',
    description: 'Classifique e filtre contatos conforme sua operação.',
    icon: Zap,
  },
  {
    title: 'Organização de oportunidades',
    description: 'Registre valores e acompanhe cada próximo passo comercial.',
    icon: BarChart3,
  },
] as const;

const audiences = [
  ['Clínicas', HeartPulse],
  ['Imobiliárias', Home],
  ['Prestadores', Wrench],
  ['Lojas', ShoppingBag],
  ['Pequenas empresas', Store],
  ['Equipes comerciais', UsersRound],
] as const;

const steps = [
  {
    number: '01',
    title: 'Crie sua conta',
    text: 'Crie sua conta, escolha o plano ideal e comece a organizar seus clientes.',
  },
  {
    number: '02',
    title: 'Cadastre seus contatos',
    text: 'Centralize clientes, observações e valores estimados.',
  },
  {
    number: '03',
    title: 'Organize e acompanhe',
    text: 'Mova oportunidades no funil e agende os próximos retornos.',
  },
  {
    number: '04',
    title: 'Acompanhe e venda',
    text: 'Sua equipe visualiza oportunidades, prioridades e próximos passos.',
  },
] as const;

const plans = [
  {
    key: 'free',
    name: PLAN_DISPLAY.free.name,
    eyebrow: 'Para começar',
    price: PLAN_DISPLAY.free.price,
    suffix: '',
    description: PLAN_DISPLAY.free.description,
    features: [
      '1 usuário',
      'Até 200 contatos',
      'Funil básico',
      '1 automação ativa',
      '25 respostas de IA por mês',
      'Próximos retornos',
      'Relatórios básicos',
    ],
    cta: PLAN_DISPLAY.free.cta,
    href: '/planos',
    featured: false,
  },
  {
    key: 'pro',
    name: PLAN_DISPLAY.pro.name,
    eyebrow: 'Mais escolhido',
    price: PLAN_DISPLAY.pro.price,
    suffix: '',
    description: PLAN_DISPLAY.pro.description,
    features: [
      'Até 3 usuários',
      'Até 5.000 contatos',
      'Até 5 funis de vendas',
      '25 automações ativas',
      'Campanhas e até 10 fluxos',
      '3 agentes e 2.000 respostas de IA/mês',
      'Base de conhecimento e relatórios avançados',
    ],
    cta: PLAN_DISPLAY.pro.cta,
    href: '/planos',
    featured: true,
  },
  {
    key: 'business',
    name: PLAN_DISPLAY.business.name,
    eyebrow: 'Para operações maiores',
    price: PLAN_DISPLAY.business.price,
    suffix: '',
    description: PLAN_DISPLAY.business.description,
    features: [
      'Mais usuários',
      'Maior capacidade de operação',
      'Configuração personalizada',
      'Suporte prioritário',
      'Condições comerciais sob medida',
      'Estrutura preparada para escalar',
    ],
    cta: PLAN_DISPLAY.business.cta,
    href: '/planos#contato',
    featured: false,
  },
] as const;

const faqs = [
  [
    'O que é o Aunivo?',
    'O Aunivo é um CRM simples e moderno para pequenas empresas organizarem clientes, negociações e próximos retornos.',
  ],
  [
    'Preciso instalar alguma coisa?',
    'Não. O Aunivo funciona no navegador e pode ser acessado em computador, tablet ou celular.',
  ],
  [
    'Para quem o Aunivo foi criado?',
    'Para pequenas empresas que precisam organizar clientes, vendas e retornos sem depender de planilhas.',
  ],
  [
    'Qual é o plano mais acessível?',
    `O plano ${PLAN_DISPLAY.free.name} custa ${PLAN_DISPLAY.free.price} e oferece os recursos essenciais para começar a organizar o atendimento com o Aunivo.`,
  ],
  [
    'Como funcionam os retornos?',
    'Você agenda a próxima data no contato e acompanha no dashboard o que vence hoje ou está atrasado.',
  ],
  [
    'O Aunivo serve para pequenas empresas?',
    'Sim. O produto foi pensado especialmente para pequenas empresas que desejam um CRM simples.',
  ],
  [
    'Como funciona o plano Business?',
    'O plano Business é personalizado. A empresa entra em contato com o time comercial para definir usuários, volume, suporte e condições conforme a operação.',
  ],
  [
    'Posso cancelar quando quiser?',
    'Planos pagos podem ser gerenciados pelo portal de cobrança. Quando o cancelamento é agendado, o acesso permanece até o fim do período contratado.',
  ],
] as const;

export default function HomePage() {
  return (
    <PublicShell>
      <main className="overflow-hidden">
        <section className="border-border/60 relative isolate border-b">
          <div className="bg-background absolute inset-0 -z-20" />
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,color-mix(in_oklab,var(--primary)_20%,transparent),transparent_34%),radial-gradient(circle_at_90%_35%,rgba(16,185,129,.16),transparent_30%)]" />
          <div className="via-primary/50 absolute top-0 left-1/2 -z-10 h-px w-[80%] -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent" />

          <div className="mx-auto grid max-w-7xl items-center gap-0 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-[1.02fr_.98fr] lg:gap-14 lg:px-8 lg:py-32">
            <div>
              <div className="border-primary/20 bg-primary/[0.07] text-primary mb-7 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium shadow-sm">
                <Sparkles className="size-4" />
                CRM simples para pequenas empresas
              </div>

              <h1 className="text-foreground max-w-3xl text-4xl font-bold tracking-[-.045em] sm:text-5xl lg:text-[4rem] lg:leading-[1.04]">
                Organize seus clientes e{' '}
                <span className="from-primary bg-gradient-to-r via-blue-500 to-emerald-400 bg-clip-text text-transparent">
                  acompanhe cada oportunidade de venda
                </span>
              </h1>

              <p className="text-muted-foreground mt-6 max-w-2xl text-lg leading-8 sm:text-xl">
                Controle contatos, negociações e próximos retornos em um só lugar.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button
                  render={<Link href="/planos" />}
                  size="lg"
                  className="shadow-primary/20 h-12 rounded-xl px-6 shadow-lg"
                >
                  Ver planos
                  <ArrowRight className="size-4" />
                </Button>

                <Button
                  render={<Link href="#como-funciona" />}
                  size="lg"
                  variant="outline"
                  className="border-border/80 bg-background/70 h-12 rounded-xl px-6 backdrop-blur"
                >
                  Ver como funciona
                </Button>
              </div>

              <div className="text-muted-foreground mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-500" />
                  Plano a partir de {PLAN_DISPLAY.free.price}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-emerald-500" />
                  {PLAN_DISPLAY.free.name} por {PLAN_DISPLAY.free.price}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4 text-emerald-500" />
                  Configuração segura
                </span>
              </div>
            </div>

            <ProductDemo />
          </div>
        </section>

        <section
          aria-label="Benefícios principais"
          className="border-border/60 bg-muted/20 border-b"
        >
          <div className="divide-border/60 mx-auto grid max-w-7xl divide-y px-4 sm:grid-cols-2 sm:divide-x sm:divide-y-0 sm:px-6 lg:grid-cols-4 lg:px-8">
            {benefits.map(({ title, description, icon: Icon }) => (
              <div key={title} className="group flex gap-4 px-4 py-7">
                <span className="border-primary/10 bg-primary/10 text-primary grid size-11 shrink-0 place-items-center rounded-2xl border transition-transform duration-300 group-hover:-translate-y-0.5">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-foreground text-sm font-semibold">
                    {title}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs leading-5">
                    {description} 
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="grid items-center gap-14 lg:grid-cols-[.92fr_1.08fr]">
            <div>
              <SectionEyebrow>O problema</SectionEyebrow>
              <h2 className="mt-4 max-w-xl text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                Você não deveria perder oportunidades por falta de organização
              </h2>
              <p className="text-muted-foreground mt-5 max-w-xl text-lg leading-8">
                Conversas espalhadas, respostas demoradas e leads sem
                acompanhamento criam uma operação difícil de controlar e ainda
                mais difícil de crescer.
              </p>
            </div>

            <div className="relative">
              <div className="from-primary/10 absolute inset-0 -z-10 rounded-[2rem] bg-gradient-to-br to-emerald-500/10 blur-2xl" />
              <div className="border-border/60 bg-card/80 grid gap-3 rounded-[2rem] border p-4 shadow-xl shadow-black/5 backdrop-blur sm:grid-cols-2 sm:p-6">
                {[
                  'Demora para responder',
                  'Clientes esquecidos',
                  'Conversas desorganizadas',
                  'Falta de acompanhamento',
                  'Leads sem qualificação',
                  'Dependência do trabalho manual',
                ].map((item, index) => (
                  <div
                    key={item}
                    className="border-border/70 bg-background/80 flex items-center gap-3 rounded-2xl border p-4 text-sm font-medium shadow-sm"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-red-500/10 text-xs font-semibold text-red-500">
                      {index + 1}
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          id="recursos"
          className="border-border/60 bg-muted/20 scroll-mt-24 border-y"
        >
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>Uma operação mais inteligente</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                Tudo o que sua empresa precisa para organizar e vender
              </h2>
              <p className="text-muted-foreground mx-auto mt-5 max-w-2xl leading-7">
                Recursos conectados em uma experiência simples, criada para
                transformar conversas em oportunidades acompanháveis.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {features.map(({ title, description, icon: Icon }) => (
                <article
                  key={title}
                  className="group border-border/70 bg-card/80 hover:border-primary/30 hover:shadow-primary/5 relative overflow-hidden rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="via-primary/50 absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="border-primary/10 bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground mb-5 grid size-11 place-items-center rounded-2xl border transition-all">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <p className="text-muted-foreground mt-3 text-sm leading-6">
                    {description}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="como-funciona"
          className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
        >
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>Como funciona</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
              Da primeira mensagem ao próximo passo comercial
            </h2>
          </div>

          <div className="relative mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="via-primary/30 absolute top-8 right-[12%] left-[12%] hidden h-px bg-gradient-to-r from-transparent to-transparent lg:block" />
            {steps.map(({ number, title, text }) => (
              <article
                key={number}
                className="border-border/70 bg-card relative rounded-2xl border p-6 shadow-sm"
              >
                <span className="border-primary/15 bg-primary/10 text-primary relative z-10 inline-flex size-12 items-center justify-center rounded-2xl border text-sm font-bold">
                  {number}
                </span>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-border/60 relative isolate overflow-hidden border-y bg-[#071126] text-white">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_10%_10%,rgba(79,70,229,.35),transparent_34%),radial-gradient(circle_at_90%_80%,rgba(16,185,129,.25),transparent_32%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[.9fr_1.1fr] lg:px-8">
            <div>
              <p className="text-sm font-semibold tracking-[.18em] text-emerald-300 uppercase">
                Por que Aunivo
              </p>
              <h2 className="mt-4 max-w-lg text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                Tecnologia que simplifica sem deixar sua operação genérica
              </h2>
              <p className="mt-5 max-w-lg leading-7 text-white/65">
                Organização comercial e uma experiência simples para pequenas
                empresas acompanharem cada oportunidade.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                'Criado para pequenas empresas',
                'Configuração simples e orientada',
                'Acompanhamento simples e objetivo',
                'Informações centralizadas',
                'Menos tarefas manuais',
                'Estrutura preparada para crescer',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-sm text-white/85 backdrop-blur"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Check className="size-4" />
                  </span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="text-center">
            <SectionEyebrow>Feito para quem atende e vende</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
              O Aunivo se adapta à sua operação
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {audiences.map(([label, Icon]) => (
              <div
                key={label}
                className="group border-border/70 bg-card hover:border-primary/30 rounded-2xl border p-5 text-center shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <span className="bg-primary/10 text-primary mx-auto grid size-11 place-items-center rounded-2xl">
                  <Icon className="size-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section
          id="planos"
          className="border-border/60 bg-muted/20 scroll-mt-24 border-y"
        >
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <SectionEyebrow>Planos simples e transparentes</SectionEyebrow>
              <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
                Comece pelo Basic e evolua quando sua operação crescer
              </h2>
              <p className="text-muted-foreground mx-auto mt-5 max-w-2xl leading-7">
                Escolha o plano que combina com o momento da sua empresa.
              </p>
            </div>

            <div className="mt-14 grid items-stretch gap-6 lg:grid-cols-3">
              {plans.map((plan) => (
                <article
                  key={plan.key}
                  className={
                    plan.featured
                      ? 'border-primary bg-card shadow-primary/15 relative flex h-full flex-col overflow-hidden rounded-[2rem] border-2 shadow-2xl'
                      : 'border-border/70 bg-card relative flex h-full flex-col overflow-hidden rounded-[2rem] border shadow-sm'
                  }
                >
                  {plan.featured ? (
                    <div className="from-primary bg-gradient-to-r to-emerald-500 px-4 py-2.5 text-center text-xs font-semibold tracking-[.14em] text-white uppercase">
                      {plan.eyebrow}
                    </div>
                  ) : (
                    <div className="text-muted-foreground px-7 pt-7 text-xs font-semibold tracking-[.14em] uppercase">
                      {plan.eyebrow}
                    </div>
                  )}

                  <div className={plan.featured ? 'p-7' : 'px-7 pt-4 pb-7'}>
                    <h3 className="text-2xl font-bold tracking-tight">
                      {plan.name}
                    </h3>

                    <div className="mt-5 flex min-h-14 items-end gap-1">
                      <span className="text-4xl font-bold tracking-[-.045em]">
                        {plan.price}
                      </span>
                      {plan.suffix ? (
                        <span className="text-muted-foreground pb-1 text-sm">
                          {plan.suffix}
                        </span>
                      ) : null}
                    </div>

                    <p className="text-muted-foreground mt-4 min-h-20 text-sm leading-6">
                      {plan.description}
                    </p>

                    {plan.key === 'business' ? (
                      <Button
                        render={<Link href={plan.href} />}
                        className="mt-6 h-11 w-full rounded-xl"
                        variant="outline"
                      >
                        {plan.cta}
                        <ArrowRight className="size-4" />
                      </Button>
                    ) : (
                      <LandingCheckoutButton
                        plan={plan.key}
                        label={plan.cta}
                        featured={plan.featured}
                      />
                    )}

                    <div className="bg-border/70 my-7 h-px" />

                    <p className="text-sm font-semibold">
                      Incluído neste plano:
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
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Button
                render={<Link href="/planos" />}
                variant="ghost"
                className="rounded-xl"
              >
                Ver comparação completa
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </section>

        <section
          id="faq"
          className="mx-auto max-w-4xl scroll-mt-24 px-4 py-20 sm:px-6 lg:py-28"
        >
          <div className="text-center">
            <SectionEyebrow>Perguntas frequentes</SectionEyebrow>
            <h2 className="mt-4 text-3xl font-bold tracking-[-.03em] sm:text-4xl">
              Tudo o que você precisa saber para começar
            </h2>
          </div>

          <Accordion className="border-border/70 bg-card mt-10 rounded-3xl border px-5 shadow-sm sm:px-7">
            {faqs.map(([question, answer], index) => (
              <AccordionItem key={question} value={`faq-${index}`}>
                <AccordionTrigger className="py-5 text-left text-base font-semibold">
                  {question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5 leading-7">
                  {answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="px-4 pb-20 sm:px-6 lg:pb-28">
          <div className="shadow-primary/20 relative isolate mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-[#071126] px-6 py-16 text-center text-white shadow-2xl sm:px-12">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_0%_0%,rgba(79,70,229,.65),transparent_38%),radial-gradient(circle_at_100%_100%,rgba(16,185,129,.45),transparent_35%)]" />
            <div className="mx-auto mb-6 grid size-14 place-items-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur">
              <Sparkles className="size-6 text-emerald-300" />
            </div>

            <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-[-.03em] sm:text-4xl">
              Pare de perder oportunidades por falta de acompanhamento
            </h2>

            <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/70">
              Organize seus contatos, acompanhe negociações e transforme cada
              oportunidade em um próximo passo claro.
            </p>

            <Button
              render={<Link href="/planos" />}
              size="lg"
              variant="secondary"
              className="mt-8 h-12 rounded-xl px-6"
            >
              Ver planos e começar
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      </main>
    </PublicShell>
  );
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-primary text-sm font-semibold tracking-[.18em] uppercase">
      {children}
    </p>
    
  );
}

function ProductDemo() {
  return (
    
    <div className="relative mx-auto hidden w-full max-w-xl lg:block">
      
      <div className="bg-primary/15 absolute -inset-10 -z-10 rounded-full blur-3xl" />

      

      <div className="border-border/70 bg-card overflow-hidden rounded-[1.75rem] border shadow-2xl shadow-black/10">
        <div className="border-border/70 bg-background/70 flex items-center justify-between border-b px-5 py-3 backdrop-blur">
          <div className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-red-400" />
            <span className="size-2.5 rounded-full bg-amber-400" />
            <span className="size-2.5 rounded-full bg-emerald-400" />
          </div>

          <span className="text-muted-foreground text-xs font-medium">
            Aunivo • CRM comercial
          </span>

          <span className="size-8" />
        </div>

        <div className="grid min-h-[410px] grid-cols-[.37fr_.63fr]">
          <div className="border-border/70 bg-muted/25 border-r p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
                Novos leads
              </p>

              <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[9px] font-semibold">
                3
              </span>
            </div>

            {['Mariana Alves', 'Clínica Sorriso', 'Rafael Lima'].map(
              (name, index) => (
                <div
                  key={name}
                  className={`mb-2 rounded-xl p-3 ${
                    index === 0
                      ? 'bg-primary/10 ring-primary/20 ring-1'
                      : 'bg-background/70'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="bg-primary/15 text-primary grid size-7 shrink-0 place-items-center rounded-full text-[10px] font-bold">
                      {name[0]}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-semibold">
                        {name}
                      </p>
                      <p className="text-muted-foreground truncate text-[9px]">
                        Follow-up comercial
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>

          <div className="flex flex-col p-4">
            <div className="border-border/70 flex items-center justify-between border-b pb-3">
              <div>
                <p className="text-sm font-semibold">Mariana Alves</p>
                <p className="text-[10px] text-emerald-500">
                  ● Oportunidade em andamento
                </p>
              </div>

              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-semibold text-emerald-600">
                Retorno hoje
              </span>
            </div>

            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="bg-muted max-w-[80%] rounded-2xl rounded-bl-md p-3 text-xs">
                Interesse registrado no plano Pro.
              </div>

              <div className="bg-primary text-primary-foreground ml-auto max-w-[88%] rounded-2xl rounded-br-md p-3 text-xs shadow-sm">
                <span className="mb-1 flex items-center gap-1 text-[9px] opacity-75">
                  Registro comercial
                </span>
                Proposta enviada. Retomar o contato nesta tarde para confirmar
                os próximos passos.
              </div>

              <div className="bg-muted max-w-[80%] rounded-2xl rounded-bl-md p-3 text-xs">
                Responsável: Mariana • Valor: R$ 2.400
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="border-border/70 bg-background rounded-xl border p-2.5">
                <p className="text-muted-foreground text-[9px]">Funil</p>
                <p className="mt-1 text-[10px] font-semibold">
                  Novo contato → Negociação
                </p>
              </div>

              <div className="border-border/70 bg-background rounded-xl border p-2.5">
                <p className="text-muted-foreground text-[9px]">Próxima ação</p>
                <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold">
                  <CalendarCheck className="text-primary size-3" />
                  Agendar conversa
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-border/70 bg-background/90 absolute -bottom-7 -left-7 hidden rounded-2xl border px-4 py-3 shadow-xl backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-500">
            <Check className="size-4" />
          </span>
          <div>
            <p className="text-muted-foreground text-[10px]">
              Follow-up atualizado
            </p>
            <p className="text-xs font-semibold">Oportunidade pronta para avançar</p>
          </div>
        </div>
      </div>
    </div>
  );
}
