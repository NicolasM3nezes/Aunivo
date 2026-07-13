import { describe, expect, it } from 'vitest';
import { normalizeError } from './normalize-error';

describe('normalizeError', () => {
  it('preserva detalhes seguros de erros PostgREST', () => {
    expect(normalizeError({ message: 'missing column', code: '42703', details: 'schema stale', hint: 'apply migration', status: 400 })).toMatchObject({
      message: 'missing column', code: '42703', details: 'schema stale', hint: 'apply migration', status: 400,
    });
  });
  it('normaliza Error', () => expect(normalizeError(new Error('falhou')).message).toBe('falhou'));
  it('normaliza erros PostgREST serializados', () => expect(normalizeError({ message: 'coluna ausente', code: '42703' })).toMatchObject({ message: 'coluna ausente', code: '42703' }));
  it('normaliza strings e valores desconhecidos', () => {
    expect(normalizeError('offline').message).toBe('offline');
    expect(normalizeError({}).message).toBe('Erro desconhecido.');
  });
});
