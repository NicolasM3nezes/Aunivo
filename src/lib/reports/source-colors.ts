export const SOURCE_COLOR_PALETTE = [
  '#8B5CF6',
  '#14B8A6',
  '#3B82F6',
  '#D946EF',
  '#EAB308',
  '#0EA5E9',
] as const;

const SOURCE_COLOR_MAP: Record<string, string> = {
  whatsapp: '#22C55E',
  instagram: '#EC4899',
  facebook: '#2563EB',
  google: '#F59E0B',
  indicacao: '#7C3AED',
  site: '#06B6D4',
  outro: '#F97316',
  outras: '#F97316',
  'nao informado': '#94A3B8',
};

export function normalizeSourceColorKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function getSourceColor(sourceName: string) {
  const normalized = normalizeSourceColorKey(sourceName);
  const knownColor = SOURCE_COLOR_MAP[normalized];
  if (knownColor) return knownColor;

  let hash = 0;
  for (const character of normalized) {
    hash = (hash * 31 + (character.codePointAt(0) ?? 0)) | 0;
  }

  return SOURCE_COLOR_PALETTE[Math.abs(hash) % SOURCE_COLOR_PALETTE.length];
}
