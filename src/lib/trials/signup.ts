export const TRIAL_DURATION_DAYS = 14
export const MARKETING_CONSENT_VERSION = '1.0-2026-07'

export const BUSINESS_SEGMENTS = [
  'Prestador de serviços', 'Consultoria', 'Imobiliária', 'Corretor', 'Consórcio',
  'Clínica ou saúde', 'Agência', 'Loja ou comércio', 'Tecnologia', 'Educação',
  'Construção', 'Serviços financeiros', 'Outro',
] as const

export const TEAM_SIZES = [
  'Apenas eu', '2 a 5 pessoas', '6 a 10 pessoas', '11 a 25 pessoas', 'Mais de 25 pessoas',
] as const

export const PRIMARY_GOALS = [
  'Organizar contatos', 'Controlar o funil de vendas', 'Acompanhar tarefas e follow-ups',
  'Melhorar relatórios', 'Substituir planilhas', 'Centralizar a operação comercial', 'Outro',
] as const

export function cleanText(value: unknown, maximum: number): string {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maximum)
    : ''
}

export function normalizeEmail(value: unknown): string {
  return cleanText(value, 254).toLocaleLowerCase('pt-BR')
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function normalizeBrazilianPhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '')
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return digits
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits
}

export function isValidBrazilianPhone(value: string): boolean {
  return /^55[1-9][0-9]{9,10}$/.test(value)
}

export function formatBrazilianPhone(value: string): string {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2)
  digits = digits.slice(0, 11)
  if (digits.length <= 2) return digits ? `(${digits}` : ''
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  const split = digits.length === 11 ? 7 : 6
  return `(${digits.slice(0, 2)}) ${digits.slice(2, split)}-${digits.slice(split)}`
}

export function validatePassword(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 8) return 'A senha deve ter pelo menos 8 caracteres.'
  if (!/[A-Za-zÀ-ÿ]/.test(value) || !/[0-9]/.test(value)) return 'Use pelo menos uma letra e um número na senha.'
  return null
}

export function isAllowedOption<T extends readonly string[]>(options: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}
