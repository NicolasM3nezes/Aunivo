import { describe, expect, it } from 'vitest';
import { pipelineEntitlements } from './pipeline-entitlements';

describe('pipelineEntitlements', () => {
  it('mantém o único funil Basic editável, mas bloqueia criação e exclusão', () => {
    expect(pipelineEntitlements('free', 1)).toMatchObject({ canCreatePipeline: false, canEditPipeline: true, canDeletePipeline: false, canManageStages: true });
  });
  it('deixa Pro e Business sem limite de funis', () => {
    expect(pipelineEntitlements('pro', 50).canCreatePipeline).toBe(true);
    expect(pipelineEntitlements('business', 50).canCreatePipeline).toBe(true);
  });
});

