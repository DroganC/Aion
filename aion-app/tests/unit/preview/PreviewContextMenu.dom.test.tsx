/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import PreviewContextMenu from '@/renderer/pages/conversation/Preview/components/PreviewPanel/PreviewContextMenu';

describe('PreviewContextMenu', () => {
  afterEach(() => {
    cleanup();
    document.getElementById('aion-preview-tab-context-menu-root')?.replaceChildren();
  });

  it('portals the menu outside overflow parents so it stays visible', () => {
    render(
      <div style={{ overflow: 'hidden', height: 20 }}>
        <PreviewContextMenu
          contextMenu={{ show: true, x: 40, y: 40, tabId: 'a' }}
          tabs={[
            { id: 'a', title: 'A' },
            { id: 'b', title: 'B' },
          ]}
          currentTheme='light'
          onClose={vi.fn()}
          onCloseLeft={vi.fn()}
          onCloseRight={vi.fn()}
          onCloseOthers={vi.fn()}
          onCloseAll={vi.fn()}
        />
      </div>
    );

    const menu = screen.getByTestId('preview-tab-context-menu');
    expect(menu.closest('#aion-preview-tab-context-menu-root')).toBeTruthy();
    expect(screen.getByText('preview.closeLeft')).toBeInTheDocument();
    expect(screen.getByText('preview.closeOthers')).toBeInTheDocument();
    expect(screen.queryByText('common.close')).toBeNull();
  });

  it('does not close immediately on the opening right-click mousedown', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();

    render(
      <PreviewContextMenu
        contextMenu={{ show: true, x: 10, y: 10, tabId: 'a' }}
        tabs={[{ id: 'a', title: 'A' }]}
        currentTheme='light'
        onClose={onClose}
        onCloseLeft={vi.fn()}
        onCloseRight={vi.fn()}
        onCloseOthers={vi.fn()}
        onCloseAll={vi.fn()}
      />
    );

    act(() => {
      fireEvent.mouseDown(document.body, { button: 2 });
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.runAllTimers();
    });

    act(() => {
      fireEvent.mouseDown(document.body, { button: 2 });
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      fireEvent.mouseDown(document.body, { button: 0 });
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });
});
