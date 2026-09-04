'use client';

import React from 'react';
import { LordIcon } from '@lordicon/react';

interface LordIconProps {
  src: string;
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
  return (
    <LordIcon
      src={src}
      trigger={trigger}
      colors={colors || 'primary:#00088A,secondary:#FFC72C'}
      size={size}
      className={className}
      style={style}
    />
  );
};

// Predefined Lordicon sources for common UI icons
export const LordIcons = {
  // Navigation
  menu: 'https://cdn.lordicon.com/tdrtiskw.json',
  close: 'https://cdn.lordicon.com/ionruoqo.json',
  arrowRight: 'https://cdn.lordicon.com/ritfqcdn.json',
  arrowLeft: 'https://cdn.lordicon.com/znfnlfqg.json',
  arrowUp: 'https://cdn.lordicon.com/wuvhqnif.json',
  arrowDown: 'https://cdn.lordicon.com/qrjicbjm.json',
  chevronRight: 'https://cdn.lordicon.com/ritfqcdn.json',
  chevronLeft: 'https://cdn.lordicon.com/znfnlfqg.json',
  chevronDown: 'https://cdn.lordicon.com/qrjicbjm.json',
  chevronUp: 'https://cdn.lordicon.com/wuvhqnif.json',

  // User & Auth
  user: 'https://cdn.lordicon.com/msoqawbr.json',
  userPlus: 'https://cdn.lordicon.com/wbrqfhpv.json',
  userCheck: 'https://cdn.lordicon.com/tdrtiskw.json',
  login: 'https://cdn.lordicon.com/gsjvukql.json',
  logout: 'https://cdn.lordicon.com/msoqawbr.json',
  userCircle: 'https://cdn.lordicon.com/msoqawbr.json',
  userSettings: 'https://cdn.lordicon.com/lbsooumo.json',

  // Actions
  search: 'https://cdn.lordicon.com/feamlooq.json',
  filter: 'https://cdn.lordicon.com/meronuor.json',
  sort: 'https://cdn.lordicon.com/meronuor.json',
  settings: 'https://cdn.lordicon.com/lbsooumo.json',
  edit: 'https://cdn.lordicon.com/emxpstpt.json',
  delete: 'https://cdn.lordicon.com/ionruoqo.json',
  add: 'https://cdn.lordicon.com/tdrtiskw.json',
  download: 'https://cdn.lordicon.com/wuvhqnif.json',
  upload: 'https://cdn.lordicon.com/znfnlfqg.json',
  share: 'https://cdn.lordicon.com/ritfqcdn.json',
  copy: 'https://cdn.lordicon.com/emxpstpt.json',
  refresh: 'https://cdn.lordicon.com/meronuor.json',

  // Navigation
  home: 'https://cdn.lordicon.com/msoqawbr.json',
  dashboard: 'https://cdn.lordicon.com/tdrtiskw.json',
  courses: 'https://cdn.lordicon.com/msoqawbr.json',
  calendar: 'https://cdn.lordicon.com/tdrtiskw.json',
  bell: 'https://cdn.lordicon.com/tdrtiskw.json',
  mail: 'https://cdn.lordicon.com/tdrtiskw.json',
  chat: 'https://cdn.lordicon.com/tdrtiskw.json',

  // Course related
  play: 'https://cdn.lordicon.com/tdrtiskw.json',
  pause: 'https://cdn.lordicon.com/tdrtiskw.json',
  book: 'https://cdn.lordicon.com/msoqawbr.json',
  graduation: 'https://cdn.lordicon.com/msoqawbr.json',
  certificate: 'https://cdn.lordicon.com/msoqawbr.json',
  star: 'https://cdn.lordicon.com/tdrtiskw.json',
  heart: 'https://cdn.lordicon.com/tdrtiskw.json',
  bookmark: 'https://cdn.lordicon.com/tdrtiskw.json',
  clock: 'https://cdn.lordicon.com/tdrtiskw.json',
  video: 'https://cdn.lordicon.com/tdrtiskw.json',

  // UI States
  loading: 'https://cdn.lordicon.com/tdrtiskw.json',
  success: 'https://cdn.lordicon.com/tdrtiskw.json',
  error: 'https://cdn.lordicon.com/ionruoqo.json',
  warning: 'https://cdn.lordicon.com/tdrtiskw.json',
  info: 'https://cdn.lordicon.com/tdrtiskw.json',
  check: 'https://cdn.lordicon.com/tdrtiskw.json',
  checkCircle: 'https://cdn.lordicon.com/tdrtiskw.json',
  xCircle: 'https://cdn.lordicon.com/ionruoqo.json',
  alert: 'https://cdn.lordicon.com/tdrtiskw.json',

  // Payments
  creditCard: 'https://cdn.lordicon.com/tdrtiskw.json',
  wallet: 'https://cdn.lordicon.com/tdrtiskw.json',
  coin: 'https://cdn.lordicon.com/tdrtiskw.json',
  receipt: 'https://cdn.lordicon.com/tdrtiskw.json',

  // Social
  facebook: 'https://cdn.lordicon.com/tdrtiskw.json',
  twitter: 'https://cdn.lordicon.com/tdrtiskw.json',
  instagram: 'https://cdn.lordicon.com/tdrtiskw.json',
  linkedin: 'https://cdn.lordicon.com/tdrtiskw.json',
  youtube: 'https://cdn.lordicon.com/tdrtiskw.json',
  github: 'https://cdn.lordicon.com/tdrtiskw.json',

  // UI Elements
  dropdown: 'https://cdn.lordicon.com/qrjicbjm.json',
  expand: 'https://cdn.lordicon.com/ritfqcdn.json',
  collapse: 'https://cdn.lordicon.com/znfnlfqg.json',
  grid: 'https://cdn.lordicon.com/tdrtiskw.json',
  list: 'https://cdn.lordicon.com/tdrtiskw.json',
  layout: 'https://cdn.lordicon.com/tdrtiskw.json',
} as const;

export type LordIconKey = keyof typeof LordIcons;