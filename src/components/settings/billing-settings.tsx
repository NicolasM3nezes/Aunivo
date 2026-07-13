'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
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
import { BILLING_PLANS } from '@/lib/billing/catalog';
import { PLAN_DISPLAY } from '@/config/plans';
import type {
  AccountEntitlements,
  BillingRow,
  PlanKey,
} from '@/lib/billing/types';

interface State {
  entitlements: AccountEntitlements;
  billing: BillingRow | null;
  canManage: boolean;
  trialEligible: boolean;
}

export function BillingSettings() {
  const t = useTranslations('Billing');
  const search = useSearchParams();
  const salesUrl = process.env.NEXT_PUBLIC_SALES_CONTACT_URL?.trim();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    const response = await fetch('/api/billing/state', { cache: 'no-store' });
    if (!response.ok) throw new Error(t('errors.load'));
    setState((await response.json()) as State);
  }, [t]);
  useEffect(() => {
    void load().catch((error: Error) => toast.error(error.message));
  }, [load]);
  useEffect(() => {
    if (search.get('checkout') !== 'success') return;
    toast.info(t('confirming'));
    const timer = window.setInterval(() => void load(), 3000);
    const stop = window.setTimeout(() => window.clearInterval(timer), 30000);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [load, search, t]);

  const open = async (path: string, body?: object) => {
    setBusy(path);
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url)
        throw new Error(data.error ?? t('errors.action'));
      window.location.assign(data.url);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.action'));
      setBusy(null);
    }
  };
  const synchronize = async () => {
    setBusy('sync');
    try {
      const response = await fetch('/api/billing/sync', { method: 'POST' });
      if (!response.ok) throw new Error(t('errors.sync'));
      await load();
      toast.success(t('synced'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.sync'));
    } finally {
      setBusy(null);
    }
  };

  if (!state)
    return (
      <Card>
        <CardContent className="text-muted-foreground py-10 text-center">
          {t('loading')}
        </CardContent>
      </Card>
    );
  const current = state.entitlements.effectivePlan;
  const hasAccess = state.entitlements.access !== 'restricted';
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
            <Badge>{hasAccess ? PLAN_DISPLAY[current].name : 'Sem assinatura'}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <span>
            {t('status')}: {t(`statuses.${state.entitlements.status}`)}
          </span>
          {state.billing?.current_period_end && (
            <span>
              {t('renewal')}:{' '}
              {new Intl.DateTimeFormat('pt-BR').format(
                new Date(state.billing.current_period_end)
              )}
            </span>
          )}
          {state.billing?.trial_end && state.entitlements.status === 'trialing' && (
            <span>Fim do teste: {new Intl.DateTimeFormat('pt-BR').format(new Date(state.billing.trial_end))}</span>
          )}
          {state.billing?.cancel_at_period_end && (
            <span className="text-amber-600 dark:text-amber-300">Cancelamento agendado para o fim do período.</span>
          )}
          {state.entitlements.access === 'grace' && state.entitlements.gracePeriodEndsAt && (
            <span className="text-amber-600 dark:text-amber-300">Carência até {new Intl.DateTimeFormat('pt-BR').format(new Date(state.entitlements.gracePeriodEndsAt))}.</span>
          )}
          {state.billing?.last_invoice_paid_at && (
            <span>Último pagamento: {new Intl.DateTimeFormat('pt-BR').format(new Date(state.billing.last_invoice_paid_at))}</span>
          )}
          <div className="basis-full" />
          {state.canManage && state.billing?.provider_customer_id && (
            <Button
              onClick={() => void open('/api/billing/portal')}
              disabled={!!busy}
            >
              {t('manage')}
            </Button>
          )}
          {state.canManage && state.billing?.provider_customer_id && (
            <Button
              variant="outline"
              onClick={() => void synchronize()}
              disabled={!!busy}
            >
              {t('sync')}
            </Button>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.keys(BILLING_PLANS) as PlanKey[]).map((key) => {
          const plan = BILLING_PLANS[key];
          const display = PLAN_DISPLAY[key];
          return (
            <Card
              key={key}
              className={
                plan.recommended
                  ? 'border-primary shadow-primary/10 shadow-lg'
                  : ''
              }
            >
              <CardHeader>
                <CardTitle>{display.name}</CardTitle>
                <CardDescription>{display.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-3xl font-bold">{display.price}</div>
                <ul className="text-muted-foreground space-y-1 text-sm">
                  <li>
                    {t('limits.members', {
                      value: plan.limits.members ?? t('unlimited'),
                    })}
                  </li>
                  <li>
                    {t('limits.contacts', {
                      value: plan.limits.contacts ?? t('unlimited'),
                    })}
                  </li>
                  <li>
                    {t('limits.automations', {
                      value: plan.limits.automations ?? t('unlimited'),
                    })}
                  </li>
                </ul>
                {key === 'business' && key !== current ? (
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
                ) : (
                  <Button
                    className="w-full"
                    disabled={
                      !state.canManage ||
                      (key === current && hasAccess) ||
                      !!busy
                    }
                    onClick={() =>
                      void open('/api/billing/checkout', {
                        planKey: key,
                        interval: 'monthly',
                      })
                    }
                  >
                    {key === current && hasAccess
                      ? t('current')
                      : key === 'pro' && !state.trialEligible
                        ? 'Assinar Pro'
                        : display.cta}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {!state.canManage && (
        <p className="text-muted-foreground text-sm">{t('ownerOnly')}</p>
      )}
    </div>
  );
}
