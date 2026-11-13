import { isAppPage, normalisePath } from './app-routes';

/**
 * The Meta pixel that measures the academy's adverts. It is a public-site
 * instrument only: the dashboard, classroom, meeting and auth screens never
 * load it.
 */
const CONFIGURED_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID || '1541399604683741';

/**
 * The id is interpolated into a script and an image URL, so it may only ever
 * be digits. A malformed environment value falls back to the academy's pixel
 * instead of injecting anything into the page.
 */
export const META_PIXEL_ID = /^\d{6,20}$/.test(CONFIGURED_PIXEL_ID)
  ? CONFIGURED_PIXEL_ID
  : '1541399604683741';

type MetaValue = string | number | boolean | string[];
export type MetaParams = Record<string, MetaValue>;

declare global {
  interface Window {
    fbq?: {
      (...args: unknown[]): void;
      callMethod?: (...args: unknown[]) => void;
      queue?: unknown[];
      loaded?: boolean;
      version?: string;
    };
    _fbq?: unknown;
  }
}

const PRIVATE_PATHS = ['/login', '/register', '/verify', '/verify-email', '/challenge', '/challenges'];

/** Public marketing pages are measured; signed-in product screens are not. */
export function isTrackedPage(pathname: string) {
  const path = normalisePath(pathname);
  if (isAppPage(path)) return false;
  return !PRIVATE_PATHS.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Send one standard Meta event. The base snippet queues calls until
 * fbevents.js arrives, so this is safe before the script has loaded; if the
 * pixel never loaded (blocked, offline) it does nothing rather than throwing
 * into the registration flow.
 */
export function trackMeta(event: string, params?: MetaParams) {
  if (typeof window === 'undefined') return;
  const fbq = window.fbq;
  if (typeof fbq !== 'function') return;
  fbq('track', event, params ?? {});
}
