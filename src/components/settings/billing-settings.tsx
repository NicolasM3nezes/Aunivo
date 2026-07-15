'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
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
import { pilotPresentationState } from '@/lib/billing/presentation';
import type {
  AccountEntitlements,
  BillingStateRow,
  PlanKey,
} from '@/lib/billing/types';

interface State {
  entitlements: AccountEntitlements;
  billing: BillingStateRow | null;
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
  const access = state.entitlements.effectiveAccess;
  const isInternal = access.isInternal && access.isActive;
  const isTrial = access.isTrial && access.isActive;
  const pilotState = pilotPresentationState(access);
  const isPilot = pilotState !== 'none';
  const pilotActive = pilotState === 'active' || pilotState === 'ending_soon';
  const pilotExpires = access.expiresAt
    ? new Intl.DateTimeFormat('pt-BR').format(new Date(access.expiresAt))
    : null;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{t('title')}</CardTitle>
              <CardDescription>{t('description')}</CardDescription>
            </div>
            <Badge>
              {isTrial
                ? 'Teste Pro ativo'
                : pilotActive
                ? t('pilot.title', { plan: PLAN_DISPLAY[access.plan].name })
                : isPilot
                  ? t('pilot.expiredBadge')
                : isInternal
                ? t('internal.plan', { plan: PLAN_DISPLAY[current].name })
                : hasAccess
                  ? PLAN_DISPLAY[current].name
                  : 'Sem assinatura'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {isTrial ? (
            <div className="basis-full space-y-2">
              <p>Você está testando todos os recursos do Aunivo Pro sem cartão e sem cobrança automática.</p>
              {pilotExpires && <p>Seu teste termina em {pilotExpires} ({access.daysRemaining ?? 0} dias restantes).</p>}
              <p>Você pode assinar Basic ou Pro agora, ou escolher ao final do teste.</p>
            </div>
          ) : pilotActive ? (
            <div className="basis-full space-y-2">
              <p>{t('pilot.description', { plan: PLAN_DISPLAY[access.plan].name })}</p>
              {pilotExpires && <p>{t('pilot.endsAt', { date: pilotExpires })}</p>}
              <p>{t('pilot.daysRemaining', { days: access.daysRemaining ?? 0 })}</p>
              <p>{t('pilot.noCharge')}</p>
              {pilotState === 'ending_soon' && (
                <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 font-medium text-amber-800 dark:text-amber-200">
                  {t('pilot.endingSoon', { days: access.daysRemaining ?? 0 })}
                </p>
              )}
            </div>
          ) : isPilot ? (
            <p className="basis-full rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-800 dark:text-amber-200">
              {t('pilot.expired')}
            </p>
          ) : isInternal ? (
            <span>{t('internal.noCharge')}</span>
          ) : (
            <span>
              {t('status')}: {t(`statuses.${state.entitlements.status}`)}
            </span>
          )}
          {!isInternal && !isPilot && !isTrial && state.billing?.current_period_end && (
            <span>
              {t('renewal')}:{' '}
              {new Intl.DateTimeFormat('pt-BR').format(
                new Date(state.billing.current_period_end)
              )}
            </span>
          )}
          {!isInternal && !isPilot && state.billing?.trial_end && state.entitlements.status === 'trialing' && (
            <span>Fim do teste: {new Intl.DateTimeFormat('pt-BR').format(new Date(state.billing.trial_end))}</span>
          )}
          {!isInternal && !isPilot && state.billing?.cancel_at_period_end && (
            <span className="text-amber-600 dark:text-amber-300">Cancelamento agendado para o fim do período.</span>
          )}
          {!isInternal && !isPilot && state.entitlements.access === 'grace' && state.entitlements.gracePeriodEndsAt && (
            <span className="text-amber-600 dark:text-amber-300">Carência até {new Intl.DateTimeFormat('pt-BR').format(new Date(state.entitlements.gracePeriodEndsAt))}.</span>
          )}
          {!isInternal && !isPilot && state.billing?.last_invoice_paid_at && (
            <span>Último pagamento: {new Intl.DateTimeFormat('pt-BR').format(new Date(state.billing.last_invoice_paid_at))}</span>
          )}
          <div className="basis-full" />
          {isPilot && state.canManage && (
            <Button onClick={() => void open('/api/billing/checkout', { planKey: 'pro', interval: 'monthly' })} disabled={!!busy}>
              {t('pilot.subscribePro')}
            </Button>
          )}
          {isPilot && (
            <Button variant="outline" render={<Link href="/planos" />}>
              {t('pilot.viewPlans')}
            </Button>
          )}
          {!isInternal && !isPilot && state.canManage && state.billing?.provider_customer_id && (
            <Button
              onClick={() => void open('/api/billing/portal')}
              disabled={!!busy}
            >
              {t('manage')}
            </Button>
          )}
          {!isInternal && !isPilot && state.canManage && state.billing?.provider_customer_id && (
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
                </ul>
                {isInternal && key !== current ? null : key === 'business' && key !== current ? (
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
                      (key === current && hasAccess && !isTrial) ||
                      !!busy
                    }
                    onClick={() =>
                      void open('/api/billing/checkout', {
                        planKey: key,
                        interval: 'monthly',
                      })
                    }
                  >
                    {isTrial && (key === 'free' || key === 'pro')
                      ? `Assinar ${display.name}`
                      : key === current && hasAccess
                      ? t('current')
                      : `Assinar ${display.name}`}
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
