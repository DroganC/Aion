/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ChatFileRef } from '@/common/types/chatFile';
import { isOpenableFileRef } from './previewToolbarUtils';

/**
 * How HTML preview should be opened outside the in-app panel.
 *
 * WebUI must open on the *client* (blob tab). Electron opens the on-disk file
 * with the OS default app so it lands in the system browser — `openExternal`
 * rejects `file://`, so we use open-file / open-system instead.
 */
export type HtmlBrowserOpenPlan =
  | { kind: 'blob'; content: string }
  | { kind: 'file-path'; filePath: string }
  | { kind: 'file-ref'; fileRef: ChatFileRef }
  | { kind: 'unavailable' };

export type ResolveHtmlBrowserOpenPlanInput = {
  isElectronDesktop: boolean;
  content: string;
  filePath?: string;
  fileRef?: ChatFileRef;
};

/**
 * Decide how to open the current HTML preview outside the panel.
 *
 * Pure / sync so callers and tests can assert the plan without mocking IPC.
 */
export const resolveHtmlBrowserOpenPlan = (input: ResolveHtmlBrowserOpenPlanInput): HtmlBrowserOpenPlan => {
  // Remote WebUI: backend open-file would run on the server machine. Always hand
  // the current HTML to the client's browser instead.
  if (!input.isElectronDesktop) {
    if (input.content.length === 0) return { kind: 'unavailable' };
    return { kind: 'blob', content: input.content };
  }

  const fileRef = input.fileRef;
  if (fileRef && isOpenableFileRef(fileRef)) {
    return { kind: 'file-ref', fileRef };
  }

  const filePath = input.filePath?.trim();
  if (filePath) {
    return { kind: 'file-path', filePath };
  }

  // Electron has no addressable file and blob URLs stay inside the app window —
  // there is no honest path to the system default browser.
  return { kind: 'unavailable' };
};

/** Whether the toolbar should offer "open in browser" for this HTML tab. */
export const canOpenHtmlInBrowser = (input: ResolveHtmlBrowserOpenPlanInput): boolean =>
  resolveHtmlBrowserOpenPlan(input).kind !== 'unavailable';

export type HtmlBrowserOpenDeps = {
  openFilePath: (filePath: string) => Promise<void>;
  openFileRef: (fileRef: ChatFileRef) => Promise<void>;
  openBlobInNewTab: (content: string) => void;
};

/**
 * Execute a resolved open plan using injected side effects (testable).
 */
export const executeHtmlBrowserOpenPlan = async (
  plan: HtmlBrowserOpenPlan,
  deps: HtmlBrowserOpenDeps
): Promise<boolean> => {
  switch (plan.kind) {
    case 'blob':
      deps.openBlobInNewTab(plan.content);
      return true;
    case 'file-path':
      await deps.openFilePath(plan.filePath);
      return true;
    case 'file-ref':
      await deps.openFileRef(plan.fileRef);
      return true;
    case 'unavailable':
      return false;
  }
};

/** Open current HTML content in a new browser tab via a temporary blob URL. */
export const openHtmlBlobInNewTab = (content: string): void => {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  // Keep the blob alive long enough for the new tab to load, then release it.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};
