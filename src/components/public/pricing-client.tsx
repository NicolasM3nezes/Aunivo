'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Loader2, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createClient } from '@/lib/supabase/client';
import { BILLING_PLANS } from '@/lib/billing/catalog';
import { PLAN_DISPLAY } from '@/config/plans';
import type {
  AccountEntitlements,
  BillingRow,
  PlanKey,
} from '@/lib/billing/types';

interface BillingState {
  entitlements: AccountEntitlements;
  billing: BillingRow | null;
  canManage: boolean;
}

export function PricingClient() {
  const salesUrl = process.env.NEXT_PUBLIC_SALES_CONTACT_URL?.trim();
  const [billing, setBilling] = useState<BillingState | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void createClient()
      .auth.getUser()
      .then(async ({ data }) => {
        if (!alive || !data.user) return;
        setAuthenticated(true);
        const response = await fetch('/api/billing/state', {
          cache: 'no-store',
        });
        if (alive && response.ok)
          setBilling((await response.json()) as BillingState);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function checkout(planKey: Exclude<PlanKey, 'free'>) {
    if (!authenticated) {
      window.location.assign(`/cadastro?plan=${planKey}&interval=monthly`);
      return;
    }
    setBusy(planKey);
    try {
      const response = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ planKey, interval: 'monthly' }),
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url)
        throw new Error(
          data.error === 'STRIPE_SECRET_KEY is required' ||
            data.error?.includes('PRICE_ID')
            ? 'O sistema de pagamentos ainda não foi configurado neste ambiente.'
            : (data.error ?? 'Não foi possível iniciar o pagamento.')
        );
      window.location.assign(data.url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível iniciar o pagamento.'
      );
      setBusy(null);
    }
  }

  async function portal() {
    setBusy('portal');
    try {
      const response = await fetch('/api/billing/portal', { method: 'POST' });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url)
        throw new Error(
          data.error ?? 'Não foi possível abrir o gerenciamento.'
        );
      window.location.assign(data.url);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Não foi possível abrir o gerenciamento.'
      );
      setBusy(null);
    }
  }

  const current = billing?.entitlements.effectivePlan;
  return (
    <>
      {billing &&
        ['past_due', 'unpaid', 'incomplete', 'canceled'].includes(
          billing.entitlements.status
        ) && (
          <div className="mx-auto mb-8 max-w-3xl rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-center text-sm text-amber-800 dark:text-amber-200">
            Sua assinatura requer atenção.{' '}
            {billing.canManage
              ? 'Use o gerenciamento de cobrança para revisar o pagamento.'
              : 'Fale com o proprietário da conta.'}
          </div>
        )}
      <div className="grid gap-5 lg:grid-cols-3">
        {(['free', 'pro', 'business'] as const).map((key) => {
          const plan = BILLING_PLANS[key];
          const display = PLAN_DISPLAY[key];
          const isCurrent = current === key;
          return (
            <Card
              key={key}
              className={`relative flex flex-col ${plan.recommended ? 'border-primary shadow-primary/10 shadow-xl' : ''}`}
            >
              {plan.recommended && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Mais popular
                </Badge>
              )}
              <CardHeader>
                <CardTitle>{display.name}</CardTitle>
                <CardDescription>{display.description}</CardDescription>
                <div className="pt-4 text-4xl font-bold">{display.price}</div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col">
                <ul className="flex-1 space-y-3 text-sm">
                  <PlanBenefit>
                    Até {plan.limits.members}{' '}
                    {plan.limits.members === 1 ? 'membro' : 'membros'}
                  </PlanBenefit>
                  <PlanBenefit>
                    Até{' '}
                    {new Intl.NumberFormat('pt-BR').format(
                      plan.limits.contacts ?? 0
                    )}{' '}
                    contatos
                  </PlanBenefit>
                  <PlanBenefit>
                    {plan.limits.pipelines === null
                      ? 'Funis ilimitados'
                      : `${plan.limits.pipelines} ${plan.limits.pipelines === 1 ? 'funil' : 'funis'}`}
                  </PlanBenefit>
                  <PlanBenefit>
                    {plan.limits.automations === null
                      ? 'Automações ilimitadas'
                      : `${plan.limits.automations} ${plan.limits.automations === 1 ? 'automação' : 'automações'}`}
                  </PlanBenefit>
                  <PlanBenefit enabled={plan.features.broadcasts}>
                    Campanhas
                  </PlanBenefit>
                  <PlanBenefit enabled={plan.features.ai_auto_reply}>
                    Resposta automática com IA
                  </PlanBenefit>
                  <PlanBenefit enabled={plan.features.public_api}>
                    API pública, webhooks e MCP
                  </PlanBenefit>
                </ul>
                <div className="mt-7">
                  {isCurrent ? (
                    <Button className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : key === 'free' ? (
                    <Button
                      render={<Link href="/cadastro" />}
                      className="w-full"
                      variant="outline"
                    >
                      {display.cta}
                    </Button>
                  ) : key === 'business' ? (
                    salesUrl ? (
                      <Button
                        render={
                          <a href={salesUrl} target="_blank" rel="noreferrer" />
                        }
                        className="w-full"
                        variant="outline"
                      >
                        {display.cta}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        {display.cta}
                      </Button>
                    )
                  ) : billing?.billing?.provider_subscription_id ? (
                    <Button
                      className="w-full"
                      onClick={() => void portal()}
                      disabled={!!busy}
                    >
                      {busy === 'portal' ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        'Gerenciar assinatura'
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={key === 'pro' ? 'default' : 'outline'}
                      onClick={() => void checkout(key)}
                      disabled={!!busy}
                    >
                      {busy === key ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        display.cta
                      )}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function PlanBenefit({
  children,
  enabled = true,
}: {
  children: React.ReactNode;
  enabled?: boolean;
}) {
  return (
    <li
      className={`flex gap-2 ${enabled ? '' : 'text-muted-foreground decoration-border line-through'}`}
    >
      {enabled ? (
        <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
      ) : (
        <Minus className="mt-0.5 size-4 shrink-0" />
      )}
      <span>{children}</span>
    </li>
  );
}
