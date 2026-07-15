import type { PlanKey } from '@/lib/billing/types';
import { PLAN_DISPLAY_NAMES } from '@/lib/billing/plan-permissions';

export const PLAN_DISPLAY: Record<
  PlanKey,
  { name: string; price: string; description: string; cta: string }
> = {
  free: {
    name: PLAN_DISPLAY_NAMES.free,
    price: 'R$ 12,90/mês',
    description: 'O essencial para organizar sua operação depois de testar todos os recursos Pro.',
    cta: 'Começar teste grátis',
  },
  pro: {
    name: PLAN_DISPLAY_NAMES.pro,
    price: 'R$ 39,90/mês',
    description:
      'CRM completo para experimentar por 14 dias, sem cartão e sem cobrança automática.',
    cta: 'Testar Pro grátis',
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
