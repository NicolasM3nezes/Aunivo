import { describe, expect, it } from 'vitest';
import { buildReport } from './analytics';

describe('buildReport', () => {
  it('calcula conversão, ticket e isolamento temporal sem NaN', () => {
    const now = new Date(2026, 6, 12, 12);
    const contacts = [
      { created_at: '2026-07-12T10:00:00Z', lead_source: 'Site', is_active: true },
      { created_at: '2026-01-01T10:00:00Z', lead_source: null, is_active: true },
      { created_at: '2026-07-12T10:00:00Z', lead_source: 'Site', is_active: false },
    ];
    const deals = [
      { status: 'won', value: 200, stage_id: 'b', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-07-12T10:00:00Z' },
      { status: 'lost', value: 50, stage_id: 'b', created_at: '2026-07-10T00:00:00Z', updated_at: '2026-07-11T10:00:00Z' },
      { status: 'open', value: 300, stage_id: 'a', created_at: '2026-07-12T00:00:00Z', updated_at: null },
    ];
    const report = buildReport(contacts, deals, [{ id: 'b', name: 'Fim', position: 2 }, { id: 'a', name: 'Início', position: 1 }], '7', now);
    expect(report.totalContacts).toBe(2);
    expect(report.newContacts).toBe(1);
    expect(report.conversion).toBe(0.5);
    expect(report.average).toBe(200);
    expect(report.pipelineValue).toBe(300);
    expect(report.stages.map((stage) => stage.name)).toEqual(['Início', 'Fim']);
    expect(report.contactsTimeline).toHaveLength(7);
  });

  it('retorna zeros quando não há negociações finalizadas', () => {
    const report = buildReport([], [], [], '30', new Date(2026, 6, 12));
    expect(report.conversion).toBe(0);
    expect(report.average).toBe(0);
    expect(report.results.every((item) => item.value === 0)).toBe(true);
  });
});
