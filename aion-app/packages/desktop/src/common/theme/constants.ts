/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export const LIGHT_THEME_ID = 'light';
export const DARK_THEME_ID = 'dark';
/** Sentinel id stored in `theme.activeId`: resolve to Light/Dark from the OS appearance. */
export const SYSTEM_THEME_ID = 'system';

const PERSISTED_THEME_IDS = new Set([LIGHT_THEME_ID, DARK_THEME_ID, SYSTEM_THEME_ID]);

/**
 * Map legacy decorative / custom theme ids (and empty values) to a supported preference.
 * Unknown ids become Follow System.
 */
export function normalizeActiveThemeId(activeId: string | undefined | null): string {
  if (activeId && PERSISTED_THEME_IDS.has(activeId)) return activeId;
  return SYSTEM_THEME_ID;
}
