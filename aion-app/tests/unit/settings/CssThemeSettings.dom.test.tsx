import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';

const selectTheme = vi.fn().mockResolvedValue(undefined);

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@renderer/hooks/context/ThemeContext.tsx', () => ({
  useThemeContext: () => ({
    activeTheme: { id: 'light', appearance: 'light' },
    activeId: 'light',
    selectTheme,
  }),
}));

vi.mock('@arco-design/web-react', () => ({
  Message: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('@arco-design/web-react/icon', () => ({
  IconCheckCircleFill: () => null,
}));

import CssThemeSettings from '@/renderer/pages/settings/AppearanceSettings/CssThemeSettings';

describe('CssThemeSettings', () => {
  beforeEach(() => {
    selectTheme.mockClear();
  });

  it('renders only light, dark, and follow-system cards without an add control', () => {
    render(<CssThemeSettings />);

    expect(screen.getByTestId('theme-card-light')).toBeTruthy();
    expect(screen.getByTestId('theme-card-dark')).toBeTruthy();
    expect(screen.getByTestId('theme-card-system')).toBeTruthy();
    expect(screen.queryByText('settings.cssTheme.addManually')).toBeNull();
    expect(screen.queryByText('settings.cssTheme.selectOrCustomize')).toBeNull();
  });
});
