import { describe, expect, it } from 'vitest';
import { buildReport, normalizeSourceKey, sourceDisplayName } from './analytics';

describe('buildReport', () => {
  it('calcula conversão, ticket e isolamento temporal sem NaN', () => {
    const now = new Date(2026, 6, 12, 12);
    const contacts = [
      { created_at: '2026-07-12T10:00:00Z', lead_source: 'Site', is_active: true },
      { created_at: '2026-01-01T10:00:00Z', lead_source: null, is_active: true },
      { created_at: '2026-07-12T10:00:00Z', lead_source: 'Site', is_active: false },
    ];
    const deals = [
      { status: 'won', value: 200, stage_id: 'b', pipeline_id: 'p', created_at: '2026-06-01T00:00:00Z', updated_at: '2026-07-12T10:00:00Z' },
      { status: 'lost', value: 50, stage_id: 'b', pipeline_id: 'p', created_at: '2026-07-10T00:00:00Z', updated_at: '2026-07-11T10:00:00Z' },
      { status: 'open', value: 300, stage_id: 'a', pipeline_id: 'p', created_at: '2026-07-12T00:00:00Z', updated_at: null },
    ];
    const report = buildReport(contacts, deals, [{ id: 'b', name: 'Fim', position: 2, pipeline_id: 'p', pipeline_name: 'Principal' }, { id: 'a', name: 'Início', position: 1, pipeline_id: 'p', pipeline_name: 'Principal' }], [{ id: 'p', name: 'Principal' }], '7', now);
    expect(report.totalContacts).toBe(2);
    expect(report.newContacts).toBe(1);
    expect(report.conversion).toBe(0.5);
    expect(report.average).toBe(200);
    expect(report.pipelineValue).toBe(300);
    expect(report.stages.map((stage) => stage.name)).toEqual(['Início', 'Fim']);
    expect(report.contactsTimeline).toHaveLength(7);
  });

  it('retorna zeros quando não há negociações finalizadas', () => {
    const report = buildReport([], [], [], [], '30', new Date(2026, 6, 12));
    expect(report.conversion).toBe(0);
    expect(report.average).toBe(0);
    expect(report.results.every((item) => item.value === 0)).toBe(true);
  });

  it('agrupa origens conhecidas ignorando espaços e capitalização', () => {
    const now = new Date('2026-07-12T12:00:00Z');
    const contacts = ['whatsapp', 'WhatsApp', ' WHATSAPP ', 'Instagram', 'indicação', null, '   ', '__none__'].map((lead_source) => ({
      created_at: '2026-07-12T10:00:00Z', lead_source, is_active: true,
    }));
    const report = buildReport(contacts, [], [], [], '7', now);
    expect(report.sources).toEqual([
      { name: 'WhatsApp', value: 3 },
      { name: 'Não informado', value: 3 },
      { name: 'Instagram', value: 1 },
      { name: 'Indicação', value: 1 },
    ]);
    expect(report.sourceSummary).toEqual({ total: 8, informed: 5, uninformed: 3, coverage: 5 / 8, topName: 'WhatsApp', topValue: 3 });
  });

  it('preserva origem personalizada e não escolhe Não informado como principal', () => {
    const now = new Date('2026-07-12T12:00:00Z');
    const contacts = [null, '', '  ', 'Feira local'].map((lead_source) => ({
      created_at: '2026-07-12T10:00:00Z', lead_source, is_active: true,
    }));
    const report = buildReport(contacts, [], [], [], '7', now);
    expect(report.sourceSummary.topName).toBe('Feira local');
    expect(report.sourceSummary.topValue).toBe(1);
  });

  it('mantém resumo zerado quando não há contatos', () => {
    const report = buildReport([], [], [], [], 'all', new Date('2026-07-12T12:00:00Z'));
    expect(report.sources).toEqual([]);
    expect(report.sourceSummary).toEqual({ total: 0, informed: 0, uninformed: 0, coverage: 0, topName: null, topValue: 0 });
  });

  it('normaliza nomes conhecidos e valores vazios', () => {
    expect(normalizeSourceKey(' WHATSAPP ')).toBe('whatsapp');
    expect(sourceDisplayName(' WHATSAPP ')).toBe('WhatsApp');
    expect(sourceDisplayName('  ')).toBe('Não informado');
  });
});
