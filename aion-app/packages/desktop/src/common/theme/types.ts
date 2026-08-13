/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeAppearance = 'light' | 'dark';

/**
 * Unified theme. `appearance` drives data-theme + arco-theme.
 * Optional `css` / `tokens` remain for injection helpers; product themes are Light/Dark only.
 */
export type Theme = {
  id: string;
  name: string;
  cover?: string;
  appearance: ThemeAppearance;
  tokens?: Record<string, string>;
  css?: string;
  builtin: boolean;
  created_at: number;
  updated_at: number;
};
