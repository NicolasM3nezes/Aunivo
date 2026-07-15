import { describe, expect, it } from 'vitest';
import { pipelineEntitlements, pipelineLimitMessage } from './pipeline-entitlements';

describe('pipelineEntitlements', () => {
  it('não assume Basic enquanto o plano ainda está carregando', () => {
    expect(pipelineEntitlements(undefined, 1)).toMatchObject({ canCreatePipeline: false, canDuplicatePipeline: false, canEditPipeline: false });
  });
  it('mantém o único funil Basic editável, mas bloqueia criação e exclusão', () => {
    expect(pipelineEntitlements(1, 1)).toMatchObject({ canCreatePipeline: false, canEditPipeline: true, canDeletePipeline: false, canManageStages: true });
  });
  it('limita Pro a cinco funis e deixa Business sem limite', () => {
    expect(pipelineEntitlements(5, 4).canCreatePipeline).toBe(true);
    expect(pipelineEntitlements(5, 5).canCreatePipeline).toBe(false);
    expect(pipelineEntitlements(null, 50).canCreatePipeline).toBe(true);
  });
  it('traduz o erro do banco usando o plano efetivo', () => {
    expect(pipelineLimitMessage({ message: 'billing_limit_reached:pipelines:5' }, 'pro')).toContain('Pro permite até 5 funis');
    expect(pipelineLimitMessage({ message: 'outro erro' }, 'pro')).toBeNull();
  });
});
