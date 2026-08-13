/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Build-time brand identity (injected via electron.vite.config.ts `define`).
 * Source of truth: aion-app/brands/export.js → brands/<id>/brand.json
 */

declare const __BRAND_ID__: string | undefined;
declare const __BRAND_DISPLAY_NAME__: string | undefined;
declare const __BRAND_PRODUCT_NAME__: string | undefined;

const FALLBACK_ID = 'aionui';
const FALLBACK_DISPLAY_NAME = 'AionUi';

export function getBrandId(): string {
  if (typeof __BRAND_ID__ === 'string' && __BRAND_ID__.length > 0) {
    return __BRAND_ID__;
  }
  return FALLBACK_ID;
}

/** User-visible product name (UI, i18n {{productName}}, notifications, window title). */
export function getBrandDisplayName(): string {
  if (typeof __BRAND_DISPLAY_NAME__ === 'string' && __BRAND_DISPLAY_NAME__.length > 0) {
    return __BRAND_DISPLAY_NAME__;
  }
  return FALLBACK_DISPLAY_NAME;
}

/** Packaged app / shortcut display name (same as displayName for current brands). */
export function getBrandProductName(): string {
  if (typeof __BRAND_PRODUCT_NAME__ === 'string' && __BRAND_PRODUCT_NAME__.length > 0) {
    return __BRAND_PRODUCT_NAME__;
  }
  return getBrandDisplayName();
}
