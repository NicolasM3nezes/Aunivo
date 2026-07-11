import { describe, expect, it } from 'vitest';
import { RAIL_GROUPS, SETTINGS_SECTIONS, resolveSection } from './settings-sections';

describe('settings information architecture', () => {
  it('exposes every implemented settings surface exactly once', () => {
    expect(new Set(SETTINGS_SECTIONS).size).toBe(SETTINGS_SECTIONS.length);
    expect(SETTINGS_SECTIONS).toContain('ai');
    expect(SETTINGS_SECTIONS).toContain('knowledge');
  });

  it('keeps legacy deep links working', () => {
    expect(resolveSection('custom-fields')).toBe('fields');
    expect(resolveSection('ai-config')).toBe('ai');
    expect(resolveSection('knowledge-base')).toBe('knowledge');
    expect(resolveSection('unknown')).toBe('overview');
  });

  it('uses the expected premium navigation groups', () => {
    expect(RAIL_GROUPS.map(({ group }) => group)).toEqual([
      'top', 'account', 'service', 'team', 'integrations', 'billing',
    ]);
  });
});
