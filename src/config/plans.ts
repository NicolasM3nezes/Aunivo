import type { PlanKey } from '@/lib/billing/types';
import { PLAN_DISPLAY_NAMES } from '@/lib/billing/plan-permissions';

export const PLAN_DISPLAY: Record<
  PlanKey,
  { name: string; price: string; description: string; cta: string }
> = {
  free: {
    name: PLAN_DISPLAY_NAMES.free,
    price: 'R$ 12,90/mês',
    description: 'O essencial para organizar sua operação, com cobrança mensal imediata.',
    cta: 'Assinar Basic',
  },
  pro: {
    name: PLAN_DISPLAY_NAMES.pro,
    price: 'R$ 39,90/mês',
    description:
      'CRM completo com 14 dias grátis no primeiro teste e cartão cadastrado no início.',
    cta: 'Começar teste grátis',
  },
  business: {
    name: PLAN_DISPLAY_NAMES.business,
    price: 'Sob consulta',
    description:
      'Uma solução orientada para operações com necessidades específicas.',
    cta: 'Falar com o comercial',
  },
} as const;

export function getPlanDisplay(plan: PlanKey) {
  return PLAN_DISPLAY[plan];
}
