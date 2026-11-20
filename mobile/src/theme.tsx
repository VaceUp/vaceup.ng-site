/** VaceUp design tokens for mobile, mapped from the repo's tokens/*.json and
 * the web workspace theme — in LIGHT and DARK, matching the website's themes. */
import { useColorScheme } from 'react-native';

export const light = {
  navy950: '#0A1128',
  navy900: '#0E1B3D',
  navy800: '#142552',
  navy700: '#1B3168',
  navy200: '#B9C4E0',
  navy100: '#E8EBF4',
  gold: '#FFC72C',
  goldDark: '#E5AE14',
  white: '#FFFFFF',
  page: '#F6F7FB',
  surface: '#FFFFFF',
  line: '#E3E7F0',
  text: '#0A1128',
  textMuted: '#5C6684',
  success: '#0E8A5F',
  successBg: '#E7F6EF',
  error: '#B4232C',
  errorBg: '#FCEBEC',
  focus: '#3B63C4',
  overlay: 'rgba(10, 17, 40, 0.55)',
} as const;

export const dark = {
  navy950: '#050B1E',
  navy900: '#0A1128',
  navy800: '#142552',
  navy700: '#1B3168',
  navy200: '#5A6B94',
  navy100: '#1A2440',
  gold: '#FFC72C',
  goldDark: '#FFC72C',
  white: '#FFFFFF',
  page: '#070D20',
  surface: '#101A36',
  line: '#22305C',
  text: '#EDF0F8',
  textMuted: '#9AA6C4',
  success: '#3BC492',
  successBg: '#12291F',
  error: '#E86A70',
  errorBg: '#2E1416',
  focus: '#7E9BF0',
  overlay: 'rgba(5, 11, 30, 0.65)',
} as const;

export type Palette = typeof light;

export function useTheme(): { colors: Palette; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: (isDark ? dark : light) as Palette, isDark };
}

export const spacing = (units: number) => units * 4;

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 999 } as const;

export const type = {
  title: { fontSize: 30, fontWeight: '800', lineHeight: 36, letterSpacing: -0.5 },
  heading: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  subheading: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 15, fontWeight: '600' },
} as const;

/** Minimum touch target per the design system's accessibility bar. */
export const TOUCH_TARGET = 44;
