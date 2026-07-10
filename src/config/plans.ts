import type { PlanKey } from '@/lib/billing/types';

export const PLAN_DISPLAY: Record<
  PlanKey,
  { name: string; price: string; description: string; cta: string }
> = {
  free: {
    name: 'Basic',
    price: 'R$ 12,90/mês',
    description: 'O essencial para organizar seu atendimento comercial.',
    cta: 'Começar com o Basic',
  },
  pro: {
    name: 'Pro',
    price: 'R$ 39,90/mês',
    description:
      'Automação e inteligência artificial para acelerar suas vendas.',
    cta: 'Assinar Pro',
  },
  business: {
    name: 'Business',
    price: 'Sob consulta',
    description:
      'Uma solução orientada para operações com necessidades específicas.',
    cta: 'Falar com o comercial',
  },
} as const;

export function getPlanDisplay(plan: PlanKey) {
  return PLAN_DISPLAY[plan];
}
