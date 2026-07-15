import type { PlanKey } from './types';

export type PipelineEntitlements = {
  maxPipelines: number | null;
  canCreatePipeline: boolean;
  canEditPipeline: boolean;
  canDeletePipeline: boolean;
  canDuplicatePipeline: boolean;
  canManageStages: boolean;
};

export function pipelineEntitlements(maxPipelines: number | null | undefined, currentPipelines: number): PipelineEntitlements {
  if (maxPipelines === undefined) {
    return { maxPipelines: null, canCreatePipeline: false, canEditPipeline: false, canDeletePipeline: false, canDuplicatePipeline: false, canManageStages: false };
  }
  const withinLimit = maxPipelines === null || currentPipelines < maxPipelines;
  return {
    maxPipelines,
    canCreatePipeline: withinLimit,
    canEditPipeline: true,
    canDeletePipeline: currentPipelines > 1,
    canDuplicatePipeline: withinLimit,
    canManageStages: true,
  };
}

type BillingLimitError = { message?: string } | null | undefined;

export function pipelinePlanLimitMessage(plan: PlanKey, maximum: number | null): string {
  if (plan === 'free') return 'Seu plano Basic permite 1 funil. Faça upgrade para o Pro para criar outros funis.';
  if (plan === 'pro') return `Seu plano Pro permite até ${maximum ?? 5} funis. Exclua um funil que não utiliza ou entre em contato para aumentar sua capacidade.`;
  return maximum === null
    ? 'Entre em contato para aumentar sua capacidade de funis.'
    : `Seu plano Business permite até ${maximum} funis. Entre em contato para aumentar sua capacidade.`;
}

export function pipelineLimitMessage(error: BillingLimitError, plan: PlanKey): string | null {
  const match = error?.message?.match(/billing_limit_reached:pipelines:(\d+)/i);
  if (!match) return null;
  return pipelinePlanLimitMessage(plan, Number(match[1]));
}
