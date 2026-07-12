import { describe, expect, it } from 'vitest';
import { formatBrazilianPhone, isValidBrazilianPhone, normalizePhone } from './phone';

describe('telefone brasileiro', () => {
  it.each([['11987654321','(11) 98765-4321'],['1134567890','(11) 3456-7890'],['+5511987654321','+55 (11) 98765-4321']])('formata %s', (input, expected) => expect(formatBrazilianPhone(input)).toBe(expected));
  it('normaliza máscara e DDI para DDD + número', () => expect(normalizePhone('+55 (11) 98765-4321')).toBe('11987654321'));
  it('valida fixo e celular e rejeita inválidos', () => {
    expect(isValidBrazilianPhone('1134567890')).toBe(true);
    expect(isValidBrazilianPhone('11987654321')).toBe(true);
    expect(isValidBrazilianPhone('123')).toBe(false);
  });
});
