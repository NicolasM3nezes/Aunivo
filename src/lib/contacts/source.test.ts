import { describe, expect, it } from 'vitest';
import {
  getContactSourceLabel,
  normalizeContactSourceForDatabase,
  normalizeContactSourceKey,
  UNINFORMED_CONTACT_SOURCE_KEY,
} from './source';

describe('contact source normalization', () => {
  it.each([null, undefined, '', '  ', '__none__', 'NONE', 'null', 'undefined'])(
    'normaliza %s como SQL null',
    (value) => expect(normalizeContactSourceForDatabase(value)).toBeNull(),
  );

  it('preserva e limpa origens válidas ou personalizadas', () => {
    expect(normalizeContactSourceForDatabase('  Feira local  ')).toBe('Feira local');
    expect(getContactSourceLabel(' whatsapp ')).toBe('WhatsApp');
    expect(getContactSourceLabel('Feira local')).toBe('Feira local');
  });

  it('usa rótulo e chave próprios para ausência de origem', () => {
    expect(getContactSourceLabel('__none__')).toBe('Não informado');
    expect(normalizeContactSourceKey('null')).toBe(UNINFORMED_CONTACT_SOURCE_KEY);
  });
});

