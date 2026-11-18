/** VaceUp design tokens for mobile, mapped from the repo's tokens/*.json and
 * the web workspace theme. One source of visual truth for every screen. */
export const colors = {
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
