import { describe, expect, it } from 'vitest';
import { normalizeError } from './normalize-error';

describe('normalizeError', () => {
  it('normaliza Error', () => expect(normalizeError(new Error('falhou')).message).toBe('falhou'));
  it('normaliza erros PostgREST serializados', () => expect(normalizeError({ message: 'coluna ausente', code: '42703' })).toMatchObject({ message: 'coluna ausente', code: '42703' }));
  it('normaliza strings e valores desconhecidos', () => {
    expect(normalizeError('offline').message).toBe('offline');
    expect(normalizeError({}).message).toBe('Erro desconhecido.');
  });
});
