import type { PlanKey } from '@/lib/billing/types';
import { PLAN_DISPLAY_NAMES } from '@/lib/billing/plan-permissions';

export const PLAN_DISPLAY: Record<
  PlanKey,
  { name: string; price: string; description: string; cta: string }
> = {
  free: {
    name: PLAN_DISPLAY_NAMES.free,
    price: 'R$ 12,90/mês',
    description: 'O essencial para organizar seu atendimento comercial.',
    cta: 'Começar com o Basic',
  },
  pro: {
    name: PLAN_DISPLAY_NAMES.pro,
    price: 'R$ 39,90/mês',
    description:
      'Automação e inteligência artificial para acelerar suas vendas.',
    cta: 'Assinar Pro',
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
