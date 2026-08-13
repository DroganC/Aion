/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { getBrandDisplayName, getBrandId, getBrandProductName } from '@/common/brand';

const require = createRequire(import.meta.url);
const { resolveBrand, resolveAndSyncBrand, repoRoot } = require('../../../brands/resolve.cjs') as {
  resolveBrand: () => {
    id: string;
    displayName: string;
    productName: string;
    icons: { icns: string; ico: string; png: string; devPng: string; login: string };
  };
  resolveAndSyncBrand: () => ReturnType<typeof resolveBrand>;
  repoRoot: string;
};

describe('brand config layer', () => {
  it('resolves the active brand from brands/export.js', () => {
    const brand = resolveBrand();
    expect(brand.id).toBeTruthy();
    expect(brand.displayName).toBeTruthy();
    expect(brand.productName).toBeTruthy();
    expect(fs.existsSync(brand.icons.png)).toBe(true);
    expect(fs.existsSync(brand.icons.login)).toBe(true);
  });

  it('injects the same brand into compile-time helpers', () => {
    const brand = resolveBrand();
    expect(getBrandId()).toBe(brand.id);
    expect(getBrandDisplayName()).toBe(brand.displayName);
    expect(getBrandProductName()).toBe(brand.productName);
  });

  it('syncs icons into resources/.brand for packaging and tray', () => {
    resolveAndSyncBrand();
    const brandDir = path.join(repoRoot, 'resources', '.brand');
    expect(fs.existsSync(path.join(brandDir, 'app.png'))).toBe(true);
    expect(fs.existsSync(path.join(brandDir, 'app.icns'))).toBe(true);
    expect(fs.existsSync(path.join(brandDir, 'app.ico'))).toBe(true);
  });
});
