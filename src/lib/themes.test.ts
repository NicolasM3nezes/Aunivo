import { describe, expect, it } from 'vitest';

import { DEFAULT_MODE, resolveMode } from '@/lib/themes';

describe('theme mode defaults', () => {
  it('defaults to light when no preference exists', () => {
    expect(DEFAULT_MODE).toBe('light');
    expect(resolveMode(null)).toBe('light');
  });

  it('keeps explicit light and dark preferences', () => {
    expect(resolveMode('light')).toBe('light');
    expect(resolveMode('dark')).toBe('dark');
  });

  it('migrates the legacy system value to light', () => {
    expect(resolveMode('system')).toBe('light');
  });
});
