/**
 * VaceUp Design System
 * Glassmorphism Design System with professional brand color scheme
 * 
 * BRAND COLORS:
 * - Primary Navy: #00088A (Core brand navy)
 * - Brand Teal: #008B8B (Logo teal, accents)
 * - Brand Gold: #FFC72C (Primary CTA, highlights)
 * - Dark Navy BG: #000459 (Dark sections)
 * - Light Navy BG: #0A1128 (Dark text base)
 */

export const colors = {
  // Primary brand colors - VaceUp Navy
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',    // Indigo-500 (for UI components)
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
    // VaceUp Brand Navy
    brand: {
      50: '#e8ebfc',
      100: '#d1d5f9',
      200: '#a3a8f3',
      300: '#757af0',
      400: '#474ded',
      500: '#1921e7',
      600: '#0f16c4',
      700: '#0b11a1',
      800: '#070c7e',
      900: '#00088A',   // VaceUp Brand Navy - PRIMARY
      950: '#000459',   // Dark Navy BG
    },
  },

  // Brand Teal (Logo, accents)
  teal: {
    50: '#f0fdfa',
    100: '#ccfbf1',
    200: '#99f6e4',
    300: '#5eead4',
    400: '#2dd4bf',
    500: '#14b8a6',
    600: '#0d9488',
    700: '#0f766e',
    800: '#115e59',
    900: '#134e4a',
    950: '#042f2e',
    brand: '#008B8B',  // VaceUp Brand Teal - LOGO/ACCENTS
  },

  // Brand Gold (CTAs, highlights)
  gold: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    brand: '#FFC72C',  // VaceUp Brand Gold - PRIMARY CTA
    hover: '#e8b428',
    light: '#fff9e6',
  },

  // Success colors
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#15803d',
    900: '#14532d',
    brand: '#10b981',
  },

  // Warning colors
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // Error colors
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
    brand: '#ef4444',
  },

  // Neutral colors
  neutral: {
    0: '#ffffff',
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },

  // Dark mode background
  dark: {
    bg: '#0A0A0F',
    bgSecondary: '#11131A',
    bgTerciary: '#1A1D26',
    card: 'rgba(20, 24, 34, 0.7)',
    cardHover: 'rgba(25, 30, 42, 0.8)',
    border: 'rgba(100, 116, 139, 0.2)',
    borderHover: 'rgba(100, 116, 139, 0.4)',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
  },

  // Light mode background
  light: {
    bg: '#FFFFFF',
    bgSecondary: '#F8FAFC',
    bgTerciary: '#F1F5F9',
    card: 'rgba(255, 255, 255, 0.9)',
    cardHover: 'rgba(255, 255, 255, 0.95)',
    border: 'rgba(148, 163, 184, 0.15)',
    borderHover: 'rgba(148, 163, 184, 0.3)',
    text: '#0A1128',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
  },
};

// Brand color shortcuts for easy access
export const brand = {
  navy: '#00088A',
  navyDark: '#000459',
  navyLight: '#0A1128',
  teal: '#008B8B',
  gold: '#FFC72C',
  goldHover: '#e8b428',
  goldLight: '#fff9e6',
};

// Glassmorphism utilities
export const glassmorphism = {
  light: {
    background: 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)',
  },
  lightStrong: {
    background: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.15)',
  },
  dark: {
    background: 'rgba(10, 17, 40, 0.7)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(100, 116, 139, 0.2)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
  },
  darkStrong: {
    background: 'rgba(10, 17, 40, 0.85)',
    backdropFilter: 'blur(30px)',
    border: '1px solid rgba(100, 116, 139, 0.3)',
    boxShadow: '0 12px 40px 0 rgba(0, 0, 0, 0.4)',
  },
  primary: {
    background: 'rgba(0, 8, 138, 0.15)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(0, 8, 138, 0.3)',
    boxShadow: '0 8px 32px 0 rgba(0, 8, 138, 0.2)',
  },
  gold: {
    background: 'rgba(255, 199, 44, 0.15)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 199, 44, 0.3)',
    boxShadow: '0 8px 32px 0 rgba(255, 199, 44, 0.2)',
  },
  classes: {
    light: 'bg-white/70 backdrop-blur-xl border-white/30 shadow-glass',
    lightStrong: 'bg-white/85 backdrop-blur-2xl border-white/40 shadow-glass-lg',
    dark: 'bg-navy-950/70 backdrop-blur-xl border-slate-700/20 shadow-glass-dark',
    darkStrong: 'bg-navy-950/85 backdrop-blur-2xl border-slate-700/30 shadow-glass-xl',
    primary: 'bg-navy-900/10 backdrop-blur-xl border-navy-900/30 shadow-glass-primary',
    gold: 'bg-gold-500/10 backdrop-blur-xl border-gold-500/30 shadow-glass-gold',
  },
};

// Typography
export const typography = {
  fontFamilies: {
    sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
    mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'Consolas', 'monospace'],
    display: ['Cal Sans', 'Inter', 'system-ui', 'sans-serif'],
  },
  fontSizes: {
    xs: '0.75rem',      // 12px
    sm: '0.875rem',     // 14px
    base: '1rem',       // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '1.875rem',  // 30px
    '4xl': '2.25rem',   // 36px
    '5xl': '3rem',      // 48px
    '6xl': '3.75rem',   // 60px
    '7xl': '3.75rem',   // 60px
    '8xl': '4.5rem',    // 72px
    '9xl': '6rem',      // 96px
  },
  fontWeights: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900,
  },
  lineHeights: {
    none: 1,
    tight: 1.1,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  letterSpacings: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
    widest: '0.1em',
  },
};

// Spacing
export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  7: '1.75rem',   // 28px
  8: '2rem',      // 32px
  9: '2.25rem',   // 36px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  14: '3.5rem',   // 56px
  16: '4rem',     // 64px
  20: '5rem',     // 80px
  24: '6rem',     // 96px
  28: '7rem',     // 112px
  32: '8rem',     // 128px
  36: '9rem',     // 144px
  40: '10rem',    // 160px
  44: '11rem',    // 176px
  48: '12rem',    // 192px
  52: '13rem',    // 208px
  56: '14rem',    // 224px
  60: '15rem',    // 240px
  64: '16rem',    // 256px
  72: '18rem',    // 288px
  80: '20rem',    // 320px
  96: '24rem',    // 384px
};

// Border radius
export const borderRadius = {
  none: '0',
  sm: '0.125rem',   // 2px
  DEFAULT: '0.25rem',  // 4px
  md: '0.375rem',   // 6px
  lg: '0.5rem',     // 8px
  xl: '0.75rem',    // 12px
  '2xl': '1rem',    // 16px
  '3xl': '1.5rem',  // 24px
  full: '9999px',
};

// Shadows
export const shadows = {
  xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  sm: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  smBrand: '0 1px 3px 0 rgb(0 8 138 / 0.2)',
  DEFAULT: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 1px 2px -2px rgb(0 0 0 / 0.1)',
  DEFAULTBrand: '0 4px 6px -1px rgb(0 8 138 / 0.2), 0 2px 4px -2px rgb(0 8 138 / 0.1)',
  md: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  mdBrand: '0 10px 15px -3px rgb(0 8 138 / 0.2), 0 4px 6px -4px rgb(0 8 138 / 0.1)',
  lg: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  lgBrand: '0 20px 25px -5px rgb(0 8 138 / 0.2), 0 8px 10px -6px rgb(0 8 138 / 0.1)',
  xl: '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  xlBrand: '0 25px 50px -12px rgb(0 8 138 / 0.3)',
  '2xl': '0 50px 100px -20px rgb(0 0 0 / 0.25)',
  inner: 'inset 0 2px 4px 0 rgb(0 0 0 / 0.05)',
  glow: '0 0 20px 5px rgb(0 8 138 / 0.4)',
  glowStrong: '0 0 40px 10px rgb(0 8 138 / 0.5)',
  glowGold: '0 0 20px 5px rgb(255 199 44 / 0.5)',
  glowTeal: '0 0 20px 5px rgb(0 139 139 / 0.5)',
  glowSuccess: '0 0 20px 5px rgb(34 197 94 / 0.4)',
  glowError: '0 0 20px 5px rgb(239 68 68 / 0.4)',
};

// Transitions
export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  normal: '200ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '300ms cubic-bezier(0.4, 0, 0.2, 1)',
  slower: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  spring: '400ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: '600ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
};

// Z-index
export const zIndex = {
  auto: 'auto',
  0: '0',
  10: '10',
  20: '20',
  30: '30',
  40: '40',
  50: '50',
  60: '60',
  70: '70',
  80: '80',
  90: '90',
  100: '100',
  dropdown: '1000',
  sticky: '1100',
  modal: '1300',
  popover: '1400',
  tooltip: '1500',
  toast: '1700',
  tooltipHover: '1800',
};

// Breakpoints
export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
};

// Animation keyframes
export const animations = {
  fadeIn: {
    '0%': { opacity: '0' },
    '100%': { opacity: '1' },
  },
  fadeOut: {
    '0%': { opacity: '1' },
    '100%': { opacity: '0' },
  },
  slideUp: {
    '0%': { opacity: '0', transform: 'translateY(20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  slideDown: {
    '0%': { opacity: '0', transform: 'translateY(-20px)' },
    '100%': { opacity: '1', transform: 'translateY(0)' },
  },
  slideLeft: {
    '0%': { opacity: '0', transform: 'translateX(20px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },
  slideRight: {
    '0%': { opacity: '0', transform: 'translateX(-20px)' },
    '100%': { opacity: '1', transform: 'translateX(0)' },
  },
  scaleIn: {
    '0%': { opacity: '0', transform: 'scale(0.95)' },
    '100%': { opacity: '1', transform: 'scale(1)' },
  },
  scaleOut: {
    '0%': { opacity: '1', transform: 'scale(1)' },
    '100%': { opacity: '0', transform: 'scale(0.95)' },
  },
  spin: {
    '0%': { transform: 'rotate(0deg)' },
    '100%': { transform: 'rotate(360deg)' },
  },
  pulse: {
    '0%, 100%': { opacity: '1' },
    '50%': { opacity: '0.5' },
  },
  bounce: {
    '0%, 100%': { transform: 'translateY(-5%)' },
    '50%': { transform: 'translateY(0)' },
  },
  shimmer: {
    '0%': { backgroundPosition: '-200% 0' },
    '100%': { backgroundPosition: '200% 0' },
  },
};

// Motion presets
export const motion = {
  enter: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  enterSlow: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.5, ease: [0.4, 0, 0.2, 1] },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
  scaleSpring: {
    initial: { opacity: 0, scale: 0.9 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: 'spring', stiffness: 300, damping: 30 },
  },
  slideUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
  slideDown: {
    initial: { opacity: 0, y: -30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 30 },
    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
  },
  slideLeft: {
    initial: { opacity: 0, x: 30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -30 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  slideRight: {
    initial: { opacity: 0, x: -30 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 30 },
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2, ease: 'easeInOut' },
  },
};

// Tailwind CSS custom properties for CSS variables
export const cssVariables = {
  light: {
    '--color-primary': '#00088A',
    '--color-primary-hover': '#000459',
    '--color-primary-light': '#e8ebfc',
    '--color-teal': '#008B8B',
    '--color-gold': '#FFC72C',
    '--color-gold-hover': '#e8b428',
    '--color-success': '#10b981',
    '--color-warning': '#f59e0b',
    '--color-error': '#ef4444',
    '--bg-primary': '#FFFFFF',
    '--bg-secondary': '#F8FAFC',
    '--bg-tertiary': '#F1F5F9',
    '--text-primary': '#0A1128',
    '--text-secondary': '#475569',
    '--text-muted': '#94A3B8',
    '--border-color': '#E2E8F0',
    '--border-hover': '#CBD5E1',
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '--radius-sm': '0.25rem',
    '--radius-md': '0.375rem',
    '--radius-lg': '0.5rem',
    '--radius-xl': '0.75rem',
    '--radius-2xl': '1rem',
    '--radius-full': '9999px',
  },
  dark: {
    '--color-primary': '#7D9AFF',
    '--color-primary-hover': '#A3B8FF',
    '--color-primary-light': '#1E1E3F',
    '--color-teal': '#008B8B',
    '--color-gold': '#FFC72C',
    '--color-gold-hover': '#e8b428',
    '--color-success': '#4ADE80',
    '--color-warning': '#FBBF24',
    '--color-error': '#F87171',
    '--bg-primary': '#0A0A0F',
    '--bg-secondary': '#11131A',
    '--bg-tertiary': '#1A1D26',
    '--text-primary': '#F1F5F9',
    '--text-secondary': '#94A3B8',
    '--text-muted': '#64748B',
    '--border-color': '#1E293B',
    '--border-hover': '#334155',
    '--shadow-sm': '0 1px 2px 0 rgb(0 0 0 / 0.3)',
    '--shadow-md': '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
    '--shadow-lg': '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
    '--shadow-xl': '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
    '--radius-sm': '0.25rem',
    '--radius-md': '0.375rem',
    '--radius-lg': '0.5rem',
    '--radius-xl': '0.75rem',
    '--radius-2xl': '1rem',
    '--radius-full': '9999px',
  },
};

// Component sizes
export const componentSizes = {
  button: {
    xs: { height: '28px', padding: '0 10px', fontSize: '0.75rem', gap: '6px', iconSize: 14 },
    sm: { height: '36px', padding: '0 14px', fontSize: '0.875rem', gap: '8px', iconSize: 16 },
    md: { height: '44px', padding: '0 20px', fontSize: '1rem', gap: '10px', iconSize: 18 },
    lg: { height: '52px', padding: '0 28px', fontSize: '1.125rem', gap: '12px', iconSize: 20 },
    xl: { height: '60px', padding: '0 36px', fontSize: '1.125rem', gap: '12px', iconSize: 20 },
    iconOnly: { width: '44px', height: '44px', iconSize: 20 },
    iconOnlySm: { width: '36px', height: '36px', iconSize: 16 },
    iconOnlyLg: { width: '52px', height: '52px', iconSize: 22 },
  },
  input: {
    xs: { height: '28px', padding: '0 10px', fontSize: '0.75rem' },
    sm: { height: '36px', padding: '0 12px', fontSize: '0.875rem' },
    md: { height: '44px', padding: '0 16px', fontSize: '1rem' },
    lg: { height: '52px', padding: '0 20px', fontSize: '1.125rem' },
  },
  card: {
    sm: { padding: '16px', gap: '12px' },
    md: { padding: '24px', gap: '16px' },
    lg: { padding: '32px', gap: '24px' },
    xl: { padding: '40px', gap: '32px' },
  },
  modal: {
    sm: { maxWidth: '320px' },
    md: { maxWidth: '440px' },
    lg: { maxWidth: '560px' },
    xl: { maxWidth: '720px' },
    full: { maxWidth: '100vw', margin: 0, borderRadius: 0 },
  },
  tooltip: {
    maxWidth: '280px',
    padding: '8px 12px',
    fontSize: '0.75rem',
  },
  tooltipDelay: {
    show: 200,
    hide: 100,
  },
  dropdown: {
    minWidth: '200px',
    maxWidth: '360px',
    padding: '8px',
    gap: '4px',
  },
};

// Utility functions
export const utils = {
  // Generate CSS variable string
  cssVar: (name: string, fallback?: string) => `var(--${name}${fallback ? `, ${fallback}` : ''})`,

  // Generate glassmorphism CSS
  glass: (variant: 'light' | 'dark' | 'primary' | 'gold' = 'light') => {
    const variants = {
      light: 'bg-white/70 backdrop-blur-xl border-white/30 shadow-glass',
      dark: 'bg-navy-950/70 backdrop-blur-xl border-slate-700/20 shadow-glass-dark',
      primary: 'bg-navy-900/10 backdrop-blur-xl border-navy-900/30 shadow-glass-primary',
      gold: 'bg-gold-500/10 backdrop-blur-xl border-gold-500/30 shadow-glass-gold',
    };
    return variants[variant];
  },

  // Generate focus ring
  focusRing: (color: string = 'primary') => {
    const colors = {
      primary: 'focus:ring-2 focus:ring-navy-900/50 focus:ring-offset-2 focus:ring-offset-white',
      dark: 'focus:ring-2 focus:ring-primary-400/50 focus:ring-offset-2 focus:ring-offset-slate-950',
      error: 'focus:ring-2 focus:ring-red-500/50 focus:ring-offset-2 focus:ring-offset-white',
      success: 'focus:ring-2 focus:ring-green-500/50 focus:ring-offset-2 focus:ring-offset-white',
      gold: 'focus:ring-2 focus:ring-gold-500/50 focus:ring-offset-2 focus:ring-offset-white',
    };
    return colors[color as keyof typeof colors] || colors.primary;
  },

  // Generate transition
  transition: (properties: string | string[] = 'all', duration: string = 'normal') => {
    const durations = {
      fast: '150ms',
      normal: '200ms',
      slow: '300ms',
    };
    const props = Array.isArray(properties) ? properties.join(', ') : properties;
    return `transition: ${props} ${durations[duration as keyof typeof durations] || duration} cubic-bezier(0.4, 0, 0.2, 1)`;
  },

  // Generate container
  container: (size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' = 'lg') => {
    const sizes = {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1400px',
      full: '100%',
    };
    return `max-width: ${sizes[size]}; margin-left: auto; margin-right: auto; padding-left: 1rem; padding-right: 1rem;`;
  },

  // Media queries
  media: {
    xs: '(min-width: 320px)',
    sm: '(min-width: 640px)',
    md: '(min-width: 768px)',
    lg: '(min-width: 1024px)',
    xl: '(min-width: 1280px)',
    '2xl': '(min-width: 1536px)',
    dark: '(prefers-color-scheme: dark)',
    reducedMotion: '(prefers-reduced-motion: reduce)',
    hover: '(hover: hover)',
  },
};

// Export everything
export default {
  colors,
  brand,
  glassmorphism,
  typography,
  spacing,
  borderRadius,
  shadows,
  transitions,
  zIndex,
  breakpoints,
  animations,
  motion,
  cssVariables,
  componentSizes,
  utils,
};