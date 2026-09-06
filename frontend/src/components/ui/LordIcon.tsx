'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * VaceUp icon system
 * ------------------
 * Primary: Lordicon animated icons (official <lord-icon> web component,
 *          https://cdn.lordicon.com/lordicon.js) — System Outline style.
 * Fallback: Bootstrap Icons glyph, shown instantly and ALWAYS when the
 *          lordicon JSON is missing/404 — so no icon ever renders blank.
 *
 * To give any key its animation: paste a real icon id from
 * https://lordicon.com/free-icons (System Outline) into `src` below.
 * The component validates the URL and upgrades to the animation
 * automatically — no other code changes needed.
 */

export interface LordIconSpec {
  /** lordicon CDN json url ('' = fallback only, no animation yet) */
  src: string;
  /** Bootstrap Icons class name used as the guaranteed fallback */
  bi: string;
}

// Every src marked ✅ was verified to resolve; all other srcs are
// placeholders that 404 today and render the bootstrap glyph instead.
// Curate real System Outline ids at https://lordicon.com/free-icons.
const SPECS = {
  // Navigation
  menu: { src: '', bi: 'list' },
  close: { src: '', bi: 'x-lg' },
  arrowRight: { src: '', bi: 'arrow-right' },
  arrowLeft: { src: '', bi: 'arrow-left' },
  arrowUp: { src: '', bi: 'arrow-up' },
  arrowDown: { src: '', bi: 'arrow-down' },
  chevronRight: { src: '', bi: 'chevron-right' },
  chevronLeft: { src: '', bi: 'chevron-left' },
  chevronDown: { src: '', bi: 'chevron-down' },
  chevronUp: { src: '', bi: 'chevron-up' },

  // User & Auth
  user: { src: '', bi: 'person' },
  userPlus: { src: '', bi: 'person-plus' },
  userCheck: { src: '', bi: 'person-check' },
  login: { src: '', bi: 'box-arrow-in-right' },
  logout: { src: '', bi: 'box-arrow-right' },
  logOut: { src: '', bi: 'box-arrow-right' },
  userCircle: { src: '', bi: 'person-circle' },
  userSettings: { src: '', bi: 'person-gear' },
  userGroup: { src: '', bi: 'people' },

  // Actions
  search: { src: '', bi: 'search' },
  filter: { src: '', bi: 'funnel' },
  sort: { src: '', bi: 'sort-down' },
  settings: { src: '', bi: 'gear' },
  edit: { src: '', bi: 'pencil-square' },
  delete: { src: '', bi: 'trash' },
  add: { src: '', bi: 'plus-lg' },
  download: { src: '', bi: 'download' },
  upload: { src: '', bi: 'upload' },
  share: { src: '', bi: 'share' },
  copy: { src: '', bi: 'clipboard' },
  refresh: { src: '', bi: 'arrow-repeat' },
  save: { src: '', bi: 'save' },
  send: { src: '', bi: 'send' },
  undo: { src: '', bi: 'arrow-counterclockwise' },
  redo: { src: '', bi: 'arrow-clockwise' },
  trash2: { src: '', bi: 'trash' },
  paperclip: { src: '', bi: 'paperclip' },

  // Navigation & Location
  home: { src: '', bi: 'house' },
  dashboard: { src: '', bi: 'grid-1x2' },
  courses: { src: '', bi: 'book-half' },
  calendar: { src: '', bi: 'calendar' },
  bell: { src: '', bi: 'bell' },
  mail: { src: '', bi: 'envelope' },
  chat: { src: '', bi: 'chat-dots' },
  messageSquare: { src: '', bi: 'chat-left-text' },
  location: { src: '', bi: 'geo-alt' },
  phone: { src: '', bi: 'telephone' },
  mapPin: { src: '', bi: 'geo' },

  // Course related
  play: { src: '', bi: 'play' },
  pause: { src: '', bi: 'pause' },
  book: { src: '', bi: 'book' },
  code: { src: '', bi: 'code-slash' },
  certificate: { src: '', bi: 'award' },
  award: { src: '', bi: 'trophy' },
  star: { src: '', bi: 'star' },
  heart: { src: '', bi: 'heart' },
  bookmark: { src: '', bi: 'bookmark' },
  clock: { src: '', bi: 'clock' },
  video: { src: '', bi: 'film' },
  videoCall: { src: '', bi: 'camera-video' },
  document: { src: '', bi: 'file-text' },
  folder: { src: '', bi: 'folder' },
  file: { src: '', bi: 'file-earmark' },
  stickyNote: { src: '', bi: 'sticky' },
  quote: { src: '', bi: 'quote' },
  image: { src: '', bi: 'image' },
  camera: { src: '', bi: 'camera' },
  mic: { src: '', bi: 'mic' },
  brain: { src: '', bi: 'robot' },
  laptop: { src: '', bi: 'laptop' },
  palette: { src: '', bi: 'palette' },
  penTool: { src: '', bi: 'vector-pen' },
  pen: { src: '', bi: 'pencil' },
  eraser: { src: '', bi: 'eraser' },
  shape: { src: '', bi: 'shapes' },
  mousePointer: { src: '', bi: 'cursor' },
  type: { src: '', bi: 'type' },
  eye: { src: '', bi: 'eye' },
  loader: { src: '', bi: 'loader' },
  smile: { src: '', bi: 'emoji-smile' },

  // UI States
  success: { src: '', bi: 'check-circle' },
  error: { src: '', bi: 'x-circle' },
  warning: { src: '', bi: 'exclamation-triangle' },
  info: { src: '', bi: 'info-circle' },
  check: { src: '', bi: 'check-lg' },
  checkCircle: { src: '', bi: 'check-circle' },
  xCircle: { src: '', bi: 'x-circle' },
  helpCircle: { src: '', bi: 'question-circle' },

  // Payments & Commerce
  creditCard: { src: '', bi: 'credit-card' },
  wallet: { src: '', bi: 'wallet' },
  coin: { src: '', bi: 'coin' },
  receipt: { src: '', bi: 'receipt' },
  shoppingCart: { src: '', bi: 'cart' },
  briefcase: { src: '', bi: 'briefcase' },
  target: { src: '', bi: 'bullseye' },
  trendingUp: { src: '', bi: 'graph-up-arrow' },
  barChart: { src: '', bi: 'bar-chart' },
  pieChart: { src: '', bi: 'pie-chart' },
  activity: { src: '', bi: 'activity' },

  // Social
  facebook: { src: '', bi: 'facebook' },
  twitter: { src: '', bi: 'twitter-x' },
  instagram: { src: '', bi: 'instagram' },
  linkedin: { src: '', bi: 'linkedin' },
  youtube: { src: '', bi: 'youtube' },
  github: { src: '', bi: 'github' },
  google: { src: '', bi: 'google' },
  whatsapp: { src: '', bi: 'whatsapp' },

  // UI Elements
  dropdown: { src: '', bi: 'chevron-down' },
  expand: { src: '', bi: 'arrows-angle-expand' },
  minimize: { src: '', bi: 'arrows-angle-contract' },
  maximize: { src: '', bi: 'arrows-fullscreen' },
  collapse: { src: '', bi: 'arrows-angle-contract' },
  grid: { src: '', bi: 'grid' },
  list: { src: '', bi: 'list-ul' },
  layout: { src: '', bi: 'layout-sidebar' },
  plus: { src: '', bi: 'plus' },
  minus: { src: '', bi: 'dash' },
  arrowRightCircle: { src: '', bi: 'arrow-right-circle' },
  checkSquare: { src: '', bi: 'check2-square' },
  xSquare: { src: '', bi: 'x-square' },
  shield: { src: '', bi: 'shield-check' },
  globe: { src: '', bi: 'globe' },

  // ✅ VERIFIED animation (renders the alert triangle) — proof the upgrade
  // path works. Curate real System Outline ids at lordicon.com/free-icons
  // and paste them into each key's src.
  alert: { src: 'https://cdn.lordicon.com/tdrtiskw.json', bi: 'exclamation-triangle' },
} satisfies Record<string, LordIconSpec>;

export type LordIconKey = keyof typeof SPECS;

/**
 * Exported as spec objects ({src, bi}) — pass straight into
 * <LordIconComponent src={LordIcons.mail} …/>. The component resolves
 * the animation url and the bootstrap fallback from the same value.
 */
export const LordIcons: Record<LordIconKey, LordIconSpec> = SPECS;

/** Bootstrap fallback name for a key. */
export function fallbackFor(key: LordIconKey): string {
  return SPECS[key]?.bi ?? 'circle';
}

const SCRIPT_URL = 'https://cdn.lordicon.com/lordicon.js';
const validationCache = new Map<string, Promise<boolean>>();
let scriptInjected = false;

function ensureLordIconScript() {
  if (typeof window === 'undefined' || scriptInjected) return;
  scriptInjected = true;
  const script = document.createElement('script');
  script.src = SCRIPT_URL;
  script.async = true;
  document.head.appendChild(script);
}

function validateSrc(src: string): Promise<boolean> {
  let cached = validationCache.get(src);
  if (!cached) {
    cached = fetch(src, { mode: 'cors' })
      .then((res) => res.ok)
      .catch(() => false);
    validationCache.set(src, cached);
  }
  return cached;
}

function firstColor(colors?: string): string {
  return colors?.split(',')[0]?.split(':')[1]?.trim() || '#00088A';
}

export interface LordIconProps {
  /** Lordicon json url (LordIcons.* values) or a full LordIconSpec. */
  src?: string | LordIconSpec;
  trigger?: 'hover' | 'click' | 'loop' | 'morph';
  colors?: string;
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
}

export const LordIconComponent: React.FC<LordIconProps> = ({
  src,
  trigger = 'hover',
  colors,
  size = 48,
  className = '',
  style,
}) => {
  const spec: LordIconSpec =
    typeof src === 'string' ? { src, bi: 'circle' } : src ?? { src: '', bi: 'circle' };
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    if (!spec.src) return;
    ensureLordIconScript();
    let cancelled = false;
    validateSrc(spec.src).then((ok) => {
      if (!cancelled && ok) setAnimated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [spec.src]);

  const px = typeof size === 'number' ? `${size}px` : size;

  // Guaranteed bootstrap glyph — correct icon, shown immediately.
  if (!animated) {
    return (
      <i
        className={cn('bi', `bi-${spec.bi}`, className)}
        style={{
          color: firstColor(colors),
          fontSize: px,
          lineHeight: 1,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          ...style,
        }}
        aria-hidden="true"
      />
    );
  }

  // Validated lordicon — animate it.
  const webComponentProps: Record<string, unknown> = {
    src: spec.src,
    trigger: trigger === 'morph' ? 'hover' : trigger,
    colors,
    style: { width: px, height: px },
  };
  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      style={{ width: px, height: px, flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      {React.createElement('lord-icon', webComponentProps)}
    </span>
  );
};

export default LordIconComponent;
