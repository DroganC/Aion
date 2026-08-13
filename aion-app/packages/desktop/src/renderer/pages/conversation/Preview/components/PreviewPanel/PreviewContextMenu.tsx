/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { PreviewTab } from './PreviewTabs';

/**
 * 上下文菜单状态
 * Context menu state
 */
export interface ContextMenuState {
  /**
   * 是否显示菜单
   * Whether to show menu
   */
  show: boolean;

  /**
   * 菜单 X 坐标
   * Menu X coordinate
   */
  x: number;

  /**
   * 菜单 Y 坐标
   * Menu Y coordinate
   */
  y: number;

  /**
   * 关联的 Tab ID
   * Associated tab ID
   */
  tabId: string | null;
}

/**
 * PreviewContextMenu 组件属性
 * PreviewContextMenu component props
 */
interface PreviewContextMenuProps {
  /**
   * 上下文菜单状态
   * Context menu state
   */
  contextMenu: ContextMenuState;

  /**
   * Tabs 列表
   * Tabs list
   */
  tabs: PreviewTab[];

  /**
   * 当前主题
   * Current theme
   */
  currentTheme: 'light' | 'dark';

  /**
   * 关闭菜单回调
   * Close menu callback
   */
  onClose: () => void;

  /**
   * 关闭左侧 Tabs
   * Close tabs to the left
   */
  onCloseLeft: (tabId: string) => void;

  /**
   * 关闭右侧 Tabs
   * Close tabs to the right
   */
  onCloseRight: (tabId: string) => void;

  /**
   * 关闭其他 Tabs
   * Close other tabs
   */
  onCloseOthers: (tabId: string) => void;

  /**
   * 关闭所有 Tabs
   * Close all tabs
   */
  onCloseAll: () => void;
}

/**
 * Stable mount node outside the preview panel's overflow:hidden wrappers.
 * Avoids portal-to-document.body conflicts with test cleanups.
 */
function getMenuMountNode(): HTMLElement {
  const id = 'aion-preview-tab-context-menu-root';
  let node = document.getElementById(id);
  if (!node) {
    node = document.createElement('div');
    node.id = id;
    document.body.appendChild(node);
  }
  return node;
}

/**
 * 预览面板右键菜单组件
 * Preview panel context menu component
 *
 * 提供关闭左侧/右侧/其他/所有 Tab 的功能
 * Provides functions to close left/right/other/all tabs
 *
 * Portaled out of the preview panel so ChatLayout/Layout overflow:hidden
 * wrappers cannot clip it. Outside-click listening is deferred and ignores
 * right-button events so the opening Electron/macOS gesture does not dismiss
 * the menu immediately.
 */
const PreviewContextMenu: React.FC<PreviewContextMenuProps> = ({
  contextMenu,
  tabs,
  currentTheme,
  onClose,
  onCloseLeft,
  onCloseRight,
  onCloseOthers,
  onCloseAll,
}) => {
  const { t } = useTranslation();
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭上下文菜单 / Close context menu when clicking outside
  useEffect(() => {
    if (!contextMenu.show) return;

    const handleClickOutside = (e: MouseEvent) => {
      // Opening right-click must not dismiss the menu. Electron/macOS can deliver
      // mousedown after contextmenu for the same gesture.
      if (e.button === 2) return;
      // 如果点击的是菜单内部，不关闭 / Don't close if clicking inside menu
      if (contextMenuRef.current && contextMenuRef.current.contains(e.target as Node)) {
        return;
      }
      onClose();
    };

    // 延迟绑定，避免打开菜单的同一次右键手势立刻触发关闭
    // Defer so the opening gesture cannot hit this listener.
    // 使用 mousedown 而不是 click,避免与右键菜单的 onClick 冲突
    // Use mousedown instead of click to avoid conflicts with context menu onClick
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside, { capture: true, passive: true });
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [contextMenu.show, onClose]);

  if (!contextMenu.show || !contextMenu.tabId) {
    return null;
  }

  const currentIndex = tabs.findIndex((t) => t.id === contextMenu.tabId);
  const hasLeftTabs = currentIndex > 0;
  const hasRightTabs = currentIndex >= 0 && currentIndex < tabs.length - 1;
  const hasOtherTabs = tabs.length > 1;

  const menu = (
    <div
      ref={contextMenuRef}
      data-testid='preview-tab-context-menu'
      className='fixed shadow-lg rd-8px py-4px z-9999'
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        backgroundColor: currentTheme === 'dark' ? '#1d1d1f' : '#ffffff',
        border: '1px solid var(--border-base, #e5e6eb)',
        minWidth: '140px',
      }}
    >
      {/* 关闭左侧 / Close tabs to the left */}
      <div
        className={`px-12px py-8px text-12px transition-colors ${hasLeftTabs ? 'cursor-pointer text-t-primary hover:bg-bg-3' : 'opacity-50 cursor-not-allowed text-t-tertiary'}`}
        onClick={() => hasLeftTabs && onCloseLeft(contextMenu.tabId!)}
      >
        {t('preview.closeLeft')}
      </div>

      {/* 关闭右侧 / Close tabs to the right */}
      <div
        className={`px-12px py-8px text-12px transition-colors ${hasRightTabs ? 'cursor-pointer text-t-primary hover:bg-bg-3' : 'opacity-50 cursor-not-allowed text-t-tertiary'}`}
        onClick={() => hasRightTabs && onCloseRight(contextMenu.tabId!)}
      >
        {t('preview.closeRight')}
      </div>

      {/* 关闭其他 / Close other tabs */}
      <div
        className={`px-12px py-8px text-12px transition-colors ${hasOtherTabs ? 'cursor-pointer text-t-primary hover:bg-bg-3' : 'opacity-50 cursor-not-allowed text-t-tertiary'}`}
        onClick={() => hasOtherTabs && onCloseOthers(contextMenu.tabId!)}
      >
        {t('preview.closeOthers')}
      </div>

      {/* 分隔线 / Divider */}
      <div className='h-1px bg-border-1 my-4px mx-8px' />

      {/* 全部关闭 / Close all tabs */}
      <div
        className='px-12px py-8px text-12px text-t-primary cursor-pointer hover:bg-bg-3 transition-colors'
        onClick={onCloseAll}
      >
        {t('preview.closeAll')}
      </div>
    </div>
  );

  return createPortal(menu, getMenuMountNode());
};

export default PreviewContextMenu;
