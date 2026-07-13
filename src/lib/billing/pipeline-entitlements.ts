import type { PlanKey } from './types';
import { PLAN_LIMITS } from './plan-permissions';

export type PipelineEntitlements = {
  maxPipelines: number | null;
  canCreatePipeline: boolean;
  canEditPipeline: boolean;
  canDeletePipeline: boolean;
  canDuplicatePipeline: boolean;
  canManageStages: boolean;
};

export function pipelineEntitlements(plan: PlanKey, currentPipelines: number): PipelineEntitlements {
  const maxPipelines = PLAN_LIMITS[plan].pipelines;
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

export const BASIC_PIPELINE_LIMIT_MESSAGE = 'Seu plano Basic permite apenas 1 funil. Faça upgrade para o Pro para criar mais funis.';

