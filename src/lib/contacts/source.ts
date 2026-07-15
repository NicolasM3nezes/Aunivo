export const CONTACT_SOURCE_EMPTY_VALUE = '__none__';
export const UNINFORMED_CONTACT_SOURCE_KEY = '__uninformed__';
export const UNINFORMED_CONTACT_SOURCE_LABEL = 'Não informado';

export const CONTACT_SOURCE_OPTIONS = [
  { value: 'WhatsApp', label: 'WhatsApp' },
  { value: 'Instagram', label: 'Instagram' },
  { value: 'Facebook', label: 'Facebook' },
  { value: 'Google', label: 'Google' },
  { value: 'Site', label: 'Site' },
  { value: 'Indicação', label: 'Indicação' },
  { value: 'Anúncio pago', label: 'Anúncio pago' },
  { value: 'Evento', label: 'Evento' },
  { value: 'Ligação', label: 'Ligação' },
  { value: 'Outro', label: 'Outro' },
] as const;

const EMPTY_SOURCE_SENTINELS = new Set([
  CONTACT_SOURCE_EMPTY_VALUE,
  'none',
  'null',
  'undefined',
]);

export function normalizeContactSourceForDatabase(
  value: string | null | undefined,
): string | null {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return null;
  if (EMPTY_SOURCE_SENTINELS.has(trimmed.toLocaleLowerCase('pt-BR'))) return null;
  return trimmed;
}

export function normalizeContactSourceKey(value: string | null | undefined): string {
  return normalizeContactSourceForDatabase(value)?.toLocaleLowerCase('pt-BR') ?? UNINFORMED_CONTACT_SOURCE_KEY;
}

export function getContactSourceLabel(value: string | null | undefined): string {
  const normalized = normalizeContactSourceForDatabase(value);
  if (!normalized) return UNINFORMED_CONTACT_SOURCE_LABEL;
  const key = normalized.toLocaleLowerCase('pt-BR');
  return CONTACT_SOURCE_OPTIONS.find((option) => option.value.toLocaleLowerCase('pt-BR') === key)?.label ?? normalized;
}

