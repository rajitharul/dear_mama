import { Platform } from 'react-native';

/**
 * DearMama design tokens — warm, calm, nurturing. Static neutral theme (no
 * dynamic theming yet), exposed via `useTheme()` so components have one source
 * of truth and we can add theming later without touching call sites.
 */
const colors = {
  background: '#FBF7F2', // warm cream
  surface: '#FFFFFF',
  surfaceMuted: '#F3EEE7',
  border: '#ECE4D9',

  text: '#2D2A32',
  textSecondary: '#6E6A75',
  textTertiary: '#9A95A0',

  accent: '#6B9080', // sage
  accentSoft: '#E4EEE8',
  accentOn: '#FFFFFF',

  success: '#5C9A6B',
  successSoft: '#E5F0E7',
  danger: '#D9685F',
  dangerSoft: '#FAE8E6',
} as const;

const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const;
const fontSize = { xs: 12, sm: 14, md: 16, lg: 18, xl: 22, xxl: 28, xxxl: 34 } as const;

const fonts = {
  display: 'VarelaRound_400Regular',
  body: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semibold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
} as const;

const shadow = {
  card: {
    shadowColor: '#3A2E2A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
} as const;

export const theme = { colors, spacing, radius, fontSize, fonts, shadow } as const;
export type AppTheme = typeof theme;

export function useTheme(): AppTheme {
  return theme;
}

/** Names passed to `useFonts` — kept here so the loader and tokens never drift. */
export const FONT_FAMILIES = fonts;
export const isWeb = Platform.OS === 'web';
