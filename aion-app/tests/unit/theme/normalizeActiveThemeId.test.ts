import { describe, expect, it } from 'vitest';
import {
  DARK_THEME_ID,
  LIGHT_THEME_ID,
  SYSTEM_THEME_ID,
  normalizeActiveThemeId,
} from '@/common/theme/constants';

describe('normalizeActiveThemeId', () => {
  it('keeps light, dark, and system', () => {
    expect(normalizeActiveThemeId(LIGHT_THEME_ID)).toBe(LIGHT_THEME_ID);
    expect(normalizeActiveThemeId(DARK_THEME_ID)).toBe(DARK_THEME_ID);
    expect(normalizeActiveThemeId(SYSTEM_THEME_ID)).toBe(SYSTEM_THEME_ID);
  });

  it('maps unknown and empty values to system', () => {
    expect(normalizeActiveThemeId('misaka-mikoto-theme')).toBe(SYSTEM_THEME_ID);
    expect(normalizeActiveThemeId('')).toBe(SYSTEM_THEME_ID);
    expect(normalizeActiveThemeId(undefined)).toBe(SYSTEM_THEME_ID);
    expect(normalizeActiveThemeId(null)).toBe(SYSTEM_THEME_ID);
  });
});
