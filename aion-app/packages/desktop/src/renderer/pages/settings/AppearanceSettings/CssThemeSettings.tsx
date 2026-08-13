/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Theme } from '@/common/theme/types';
import { useThemeContext } from '@renderer/hooks/context/ThemeContext.tsx';
import { Message } from '@arco-design/web-react';
import { IconCheckCircleFill } from '@arco-design/web-react/icon';
import React, { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILTIN_THEMES } from './presets.ts';
import { DARK_THEME_ID, LIGHT_THEME_ID, SYSTEM_THEME_ID } from '@/common/theme/constants';

type ThemePreviewPalette = {
  appBg: string;
  headerBg: string;
  sideBg: string;
  mainBg: string;
  border: string;
  accent: string;
  textMuted: string;
  userBubble: string;
  aiBubble: string;
};

const fallbackThemePreviewPaletteByMode: Record<'light' | 'dark', ThemePreviewPalette> = {
  light: {
    appBg: '#f7f8fa',
    headerBg: '#eef1f5',
    sideBg: '#eef1f5',
    mainBg: '#f7f8fa',
    border: '#d9dde5',
    accent: '#3b82f6',
    textMuted: '#8b95a7',
    userBubble: '#dbeafe',
    aiBubble: '#e5e7eb',
  },
  dark: {
    appBg: '#171a1f',
    headerBg: '#1f242d',
    sideBg: '#1f242d',
    mainBg: '#171a1f',
    border: '#303744',
    accent: '#60a5fa',
    textMuted: '#8b95a7',
    userBubble: '#1e3a5f',
    aiBubble: '#2b313c',
  },
};

const ThemeLayoutPreview: React.FC<{ palette: ThemePreviewPalette }> = ({ palette }) => {
  return (
    <div className='absolute inset-0 pointer-events-none'>
      <div className='absolute inset-0' style={{ background: palette.appBg }} />
      <div
        className='absolute left-8px right-8px top-8px bottom-8px rounded-8px overflow-hidden border border-solid'
        style={{ borderColor: palette.border, background: palette.mainBg }}
      >
        <div
          className='h-14px border-b border-solid flex items-center px-6px gap-4px'
          style={{ borderColor: palette.border, background: palette.headerBg }}
        >
          <span className='block w-5px h-5px rounded-full' style={{ background: palette.accent, opacity: 0.9 }} />
          <span className='block w-18px h-4px rounded-full' style={{ background: palette.border, opacity: 0.45 }} />
          <span
            className='block w-12px h-4px rounded-full ml-auto'
            style={{ background: palette.border, opacity: 0.45 }}
          />
        </div>
        <div style={{ height: 'calc(100% - 14px)', display: 'flex' }}>
          <div
            className='border-r border-solid px-3px py-3px flex flex-col gap-3px'
            style={{ width: '23%', borderColor: palette.border, background: palette.sideBg }}
          >
            <span className='block h-3px rounded-full' style={{ background: palette.textMuted, opacity: 0.4 }} />
            <span
              className='block h-3px rounded-full w-4/5'
              style={{ background: palette.textMuted, opacity: 0.33 }}
            />
            <span
              className='block h-3px rounded-full w-3/5'
              style={{ background: palette.textMuted, opacity: 0.28 }}
            />
          </div>
          <div
            className='border-r border-solid px-4px py-4px flex flex-col gap-4px'
            style={{ width: '54%', borderColor: palette.border, background: palette.mainBg }}
          >
            <span className='block h-6px rounded-[6px] w-4/5' style={{ background: palette.aiBubble, opacity: 0.9 }} />
            <span
              className='block h-6px rounded-[6px] w-3/5 self-end'
              style={{ background: palette.userBubble, opacity: 0.95 }}
            />
            <span className='block h-6px rounded-[6px] w-2/3' style={{ background: palette.aiBubble, opacity: 0.82 }} />
          </div>
          <div className='px-3px py-3px flex flex-col gap-3px' style={{ width: '23%', background: palette.sideBg }}>
            <span className='block h-3px rounded-full' style={{ background: palette.textMuted, opacity: 0.36 }} />
            <span
              className='block h-3px rounded-full w-5/6'
              style={{ background: palette.textMuted, opacity: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/** Diagonal split preview for the "Follow System" card: light top-left, dark bottom-right. */
const SystemThemePreview: React.FC = () => (
  <div className='absolute inset-0 pointer-events-none'>
    <ThemeLayoutPreview palette={fallbackThemePreviewPaletteByMode.light} />
    <div className='absolute inset-0' style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }}>
      <ThemeLayoutPreview palette={fallbackThemePreviewPaletteByMode.dark} />
    </div>
  </div>
);

/**
 * Appearance theme picker: Light, Dark, Follow System only.
 */
const CssThemeSettings: React.FC = () => {
  const { t } = useTranslation();
  const { activeTheme, activeId, selectTheme } = useThemeContext();
  const activeThemeId = activeId ?? activeTheme?.id ?? LIGHT_THEME_ID;

  const displayThemes = useMemo((): Theme[] => {
    const byId = new Map(BUILTIN_THEMES.map((theme) => [theme.id, theme]));
    const light = byId.get(LIGHT_THEME_ID);
    const dark = byId.get(DARK_THEME_ID);
    if (!light || !dark) return BUILTIN_THEMES;

    return [
      { ...light, name: t('settings.lightMode') },
      { ...dark, name: t('settings.darkMode') },
      {
        id: SYSTEM_THEME_ID,
        name: t('settings.cssTheme.followSystem'),
        appearance: 'light',
        builtin: true,
        created_at: 0,
        updated_at: 0,
      },
    ];
  }, [t]);

  const handleSelectTheme = useCallback(
    async (theme: Theme) => {
      try {
        await selectTheme(theme.id);
        Message.success(t('settings.cssTheme.applied', { name: theme.name }));
      } catch {
        Message.error(t('settings.cssTheme.applyFailed'));
      }
    },
    [selectTheme, t]
  );

  return (
    <div
      className='grid w-full gap-12px'
      style={{
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      }}
    >
      {displayThemes.map((theme) => {
        const previewPalette =
          theme.id === DARK_THEME_ID
            ? fallbackThemePreviewPaletteByMode.dark
            : fallbackThemePreviewPaletteByMode.light;
        return (
          <div
            key={theme.id}
            data-testid={`theme-card-${theme.id}`}
            data-active={activeThemeId === theme.id}
            className={`relative cursor-pointer rounded-12px overflow-hidden border-2 transition-all duration-200 h-112px w-full ${activeThemeId === theme.id ? 'border-[var(--color-primary)]' : 'border-transparent hover:border-border-2'}`}
            style={{ backgroundColor: previewPalette.appBg }}
            onClick={() => void handleSelectTheme(theme)}
          >
            {theme.id === SYSTEM_THEME_ID ? (
              <SystemThemePreview />
            ) : (
              <ThemeLayoutPreview palette={previewPalette} />
            )}

            <div className='absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent flex items-end justify-between p-8px'>
              <span className='text-13px text-white truncate flex-1'>{theme.name}</span>
            </div>

            {activeThemeId === theme.id && (
              <IconCheckCircleFill
                className={`absolute top-8px right-8px text-20px ${
                  theme.id === LIGHT_THEME_ID ? 'text-#000000' : 'text-#ffffff'
                }`}
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default CssThemeSettings;
