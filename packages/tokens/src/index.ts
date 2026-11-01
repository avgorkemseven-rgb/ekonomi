/** KLEPS design tokens. Single source for web (CSS variables) and mobile (JS objects). */
export const palette = {
  background: '#F8F9FA',
  text: '#1E2329',
  accent: '#2563EB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  darkBackground: '#111827',
} as const;

export interface ColorScheme {
  background: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textMuted: string;
  border: string;
  accent: string;
  accentHover: string;
  accentContrast: string;
  accentSoft: string;
  success: string;
  warning: string;
  danger: string;
  focus: string;
}

export const colors: { light: ColorScheme; dark: ColorScheme } = {
  light: {
    background: palette.background,
    surface: palette.surface,
    surfaceMuted: '#F1F3F5',
    text: palette.text,
    textMuted: '#5B6470',
    border: palette.border,
    accent: palette.accent,
    accentHover: '#1D4ED8',
    accentContrast: '#FFFFFF',
    accentSoft: '#DBEAFE',
    success: '#15803D',
    warning: '#B45309',
    danger: '#B91C1C',
    focus: '#2563EB',
  },
  dark: {
    background: palette.darkBackground,
    surface: '#1A2232',
    surfaceMuted: '#222B3B',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    border: '#2D3748',
    accent: '#3B82F6',
    accentHover: '#60A5FA',
    accentContrast: '#FFFFFF',
    accentSoft: '#1E3A8A',
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#F87171',
    focus: '#60A5FA',
  },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;
export const fontSizes = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, display: 40 } as const;
export const fontWeights = { regular: '400', medium: '500', semibold: '600', bold: '700', black: '900' } as const;

/** Temporary typographic wordmark treatment (not a final trademark asset). */
export const wordmark = { text: 'KLEPS', letterSpacing: 4, weight: fontWeights.black } as const;

export const tokens = { palette, colors, spacing, radii, fontSizes, fontWeights, wordmark };
export default tokens;
