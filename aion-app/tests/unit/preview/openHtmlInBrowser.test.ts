/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import {
  canOpenHtmlInBrowser,
  executeHtmlBrowserOpenPlan,
  resolveHtmlBrowserOpenPlan,
} from '@renderer/pages/conversation/Preview/components/PreviewPanel/openHtmlInBrowser';

const projectRef = (relative_path: string) => ({
  kind: 'project' as const,
  pe_id: 'peA',
  relative_path,
});

describe('resolveHtmlBrowserOpenPlan', () => {
  it('opens current content via blob in WebUI', () => {
    expect(
      resolveHtmlBrowserOpenPlan({
        isElectronDesktop: false,
        content: '<html></html>',
        filePath: '/tmp/page.html',
      })
    ).toEqual({ kind: 'blob', content: '<html></html>' });
  });

  it('refuses empty content in WebUI', () => {
    expect(
      resolveHtmlBrowserOpenPlan({
        isElectronDesktop: false,
        content: '',
      })
    ).toEqual({ kind: 'unavailable' });
  });

  it('prefers fileRef over filePath in Electron', () => {
    const fileRef = projectRef('index.html');
    expect(
      resolveHtmlBrowserOpenPlan({
        isElectronDesktop: true,
        content: '<html></html>',
        filePath: '/abs/index.html',
        fileRef,
      })
    ).toEqual({ kind: 'file-ref', fileRef });
  });

  it('falls back to filePath in Electron when there is no openable ref', () => {
    expect(
      resolveHtmlBrowserOpenPlan({
        isElectronDesktop: true,
        content: '<html></html>',
        filePath: '/abs/index.html',
        fileRef: projectRef(''),
      })
    ).toEqual({ kind: 'file-path', filePath: '/abs/index.html' });
  });

  it('is unavailable in Electron without an addressable file', () => {
    expect(
      resolveHtmlBrowserOpenPlan({
        isElectronDesktop: true,
        content: '<html></html>',
      })
    ).toEqual({ kind: 'unavailable' });
  });
});

describe('canOpenHtmlInBrowser', () => {
  it('matches plan availability', () => {
    expect(
      canOpenHtmlInBrowser({
        isElectronDesktop: false,
        content: '<p>hi</p>',
      })
    ).toBe(true);
    expect(
      canOpenHtmlInBrowser({
        isElectronDesktop: true,
        content: '<p>hi</p>',
      })
    ).toBe(false);
  });
});

describe('executeHtmlBrowserOpenPlan', () => {
  it('dispatches to the matching side effect', async () => {
    const openFilePath = vi.fn(async () => undefined);
    const openFileRef = vi.fn(async () => undefined);
    const openBlobInNewTab = vi.fn();
    const deps = { openFilePath, openFileRef, openBlobInNewTab };

    await expect(executeHtmlBrowserOpenPlan({ kind: 'blob', content: '<p/>' }, deps)).resolves.toBe(true);
    expect(openBlobInNewTab).toHaveBeenCalledWith('<p/>');

    await expect(executeHtmlBrowserOpenPlan({ kind: 'file-path', filePath: '/a.html' }, deps)).resolves.toBe(true);
    expect(openFilePath).toHaveBeenCalledWith('/a.html');

    const fileRef = projectRef('a.html');
    await expect(executeHtmlBrowserOpenPlan({ kind: 'file-ref', fileRef }, deps)).resolves.toBe(true);
    expect(openFileRef).toHaveBeenCalledWith(fileRef);

    await expect(executeHtmlBrowserOpenPlan({ kind: 'unavailable' }, deps)).resolves.toBe(false);
  });
});
