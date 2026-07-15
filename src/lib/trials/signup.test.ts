import { describe, expect, it } from 'vitest'
import { formatBrazilianPhone, isValidBrazilianPhone, isValidEmail, normalizeBrazilianPhone, normalizeEmail, validatePassword } from './signup'

describe('trial signup normalization', () => {
  it('normalizes e-mail and Brazilian phones', () => {
    expect(normalizeEmail('  Pessoa@Empresa.COM ')).toBe('pessoa@empresa.com')
    expect(normalizeBrazilianPhone('(11) 99999-9999')).toBe('5511999999999')
    expect(normalizeBrazilianPhone('+55 11 3333-4444')).toBe('551133334444')
  })
  it('validates contact data', () => {
    expect(isValidEmail('pessoa@empresa.com')).toBe(true)
    expect(isValidEmail('pessoa@')).toBe(false)
    expect(isValidBrazilianPhone('5511999999999')).toBe(true)
    expect(isValidBrazilianPhone('5511999')).toBe(false)
  })
  it('formats phone input without blocking partial values', () => {
    expect(formatBrazilianPhone('11999999999')).toBe('(11) 99999-9999')
    expect(formatBrazilianPhone('11')).toBe('(11')
  })
  it('requires a useful password', () => {
    expect(validatePassword('abcdefg')).toBeTruthy()
    expect(validatePassword('abcdefgh')).toBeTruthy()
    expect(validatePassword('abc12345')).toBeNull()
  })
})
