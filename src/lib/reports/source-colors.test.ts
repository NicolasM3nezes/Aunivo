import { describe, expect, it } from 'vitest';
import { getSourceColor, normalizeSourceColorKey, SOURCE_COLOR_PALETTE } from './source-colors';

describe('source chart colors', () => {
  it.each([
    ['WhatsApp', '#22C55E'],
    ['Instagram', '#EC4899'],
    ['Facebook', '#2563EB'],
    ['Indicação', '#7C3AED'],
    ['Não informado', '#94A3B8'],
  ])('uses the known color for %s', (source, color) => {
    expect(getSourceColor(source)).toBe(color);
  });

  it('normalizes spaces, capitalization and accents', () => {
    expect(normalizeSourceColorKey('  INDICAÇÃO ')).toBe('indicacao');
    expect(getSourceColor('  WHATSAPP ')).toBe('#22C55E');
  });

  it('assigns a stable fallback color to a custom source', () => {
    const first = getSourceColor('Feira local');
    expect(SOURCE_COLOR_PALETTE).toContain(first);
    expect(getSourceColor('Feira local')).toBe(first);
  });
});
