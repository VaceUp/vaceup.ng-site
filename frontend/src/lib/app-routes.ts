/**
 * Routes that run the signed-in product rather than the public website.
 * AppShell hides the marketing header/footer here, and the Meta pixel stays
 * out of these screens: nobody's classroom, meeting, cart or dashboard should
 * be measured by an advertising network.
 */
export const APP_PREFIXES = [
  '/dashboard',
  '/messaging',
  '/notification',
  '/codeeditor',
  '/whiteboard',
  '/design',
  '/excel',
  '/liveclasses',
  '/live',
  '/classroom',
  '/meeting',
  '/forgot-password',
  '/reset-password',
  '/cart',
  '/checkout',
  '/payment',
];

/** Paths usePathname may report with a query string; compare only the path. */
export function normalisePath(pathname: string) {
  const path = (pathname.split('?')[0] || '/').split('#')[0];
  if (path.length > 1 && path.endsWith('/')) return path.replace(/\/+$/, '');
  return path || '/';
}

export function isAppPage(pathname: string) {
  const path = normalisePath(pathname);
  return APP_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}
