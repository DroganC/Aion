/**
 * @license
 * Copyright 2026 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';

const MCP_ERROR_KEYS = [
  'mcpErrorBunCommandNotFound',
  'mcpErrorUvCommandNotFound',
  'mcpErrorPythonCommandNotFound',
  'mcpErrorDenoCommandNotFound',
  'mcpErrorCommandPermissionDenied',
  'mcpErrorCommandStartFailed',
  'mcpErrorConnectionFailed',
  'mcpErrorProtocol',
] as const;

function localeRoot(): URL {
  return new URL('../../../packages/desktop/src/renderer/services/i18n/locales/', import.meta.url);
}

describe('product-name i18n leftovers', () => {
  it('uses {{productName}} in MCP error copy instead of AionUI/AionUi', () => {
    const languages = readdirSync(localeRoot(), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const language of languages) {
      const settings = JSON.parse(readFileSync(new URL(`${language}/settings.json`, localeRoot()), 'utf8')) as Record<
        string,
        string
      >;
      for (const key of MCP_ERROR_KEYS) {
        expect(settings[key], `${language}.${key}`).toContain('{{productName}}');
        expect(settings[key], `${language}.${key}`).not.toMatch(/AionUI|AionUi/);
      }
    }
  });
});
