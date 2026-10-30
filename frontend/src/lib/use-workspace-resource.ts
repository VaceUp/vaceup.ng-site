'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth-context';

interface ResourceState<T> { key: string; data?: T; error: string; loading: boolean; updatedAt?: Date; }

const MAX_TRANSIENT_RETRIES = 2;

/** Delay before the next automatic attempt; 0 means "retrying will not help". */
function retryDelay(error: unknown): number {
  if (error instanceof ApiError) {
    if (error.status === 429) return 20000;
    if (error.status >= 500) return 4000;
    return 0;
  }
  // Aborted by our own timeout, or no response at all (offline, DNS, proxy).
  return 2500;
}

function failureMessage(error: unknown, willRetry: boolean): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Your session has expired. Sign in again to continue.';
    if (error.status === 403) return 'Your account does not have access to this section.';
    if (error.status === 404) return 'This page no longer exists at the academy. Open it again from the menu.';
    if (error.status === 429) return willRetry
      ? 'The academy is handling many requests. This page will retry automatically in a moment.'
      : 'The academy is handling many requests. Wait a minute, then try again.';
    if (error.status >= 500) return willRetry
      ? 'The academy server did not answer that request. This page will retry automatically.'
      : 'The academy server could not load this section. Try again shortly — if it continues, contact support with the time of the failure.';
    return error.message;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. This page reloads as soon as your connection returns.';
  }
  return willRetry
    ? 'We could not reach the academy. This page will retry automatically.'
    : 'We could not reach the academy. Check your connection and try again.';
}

/** Refresh visible, authenticated pages. Never manufacture data when a request fails. */
export function useWorkspaceResource<T>(path: string | null) {
  const { user } = useAuth();
  const key = `${user?.id ?? ''}:${path ?? ''}`;
  const [state, setState] = useState<ResourceState<T>>({ key, error: '', loading: true });
  const refreshRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!path || !user) return;
    let active = true;
    let pending = false;
    let lastAttempt = 0;
    let controller: AbortController | null = null;
    let retryTimer: number | undefined;
    const load = async (attempt = 0) => {
      if (pending || !active) return;
      pending = true; lastAttempt = Date.now(); controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      setState((current) => ({ ...(current.key === key ? current : { key }), loading: true, error: '' }));
      try {
        const data = await api.request<T>(path, { signal: controller.signal, cache: 'no-store' });
        if (active) setState({ key, data, error: '', loading: false, updatedAt: new Date() });
      } catch (error) {
        if (!active) return;
        const delay = retryDelay(error);
        const willRetry = delay > 0 && attempt < MAX_TRANSIENT_RETRIES;
        setState((current) => ({
          ...(current.key === key ? current : { key }),
          loading: willRetry,
          error: failureMessage(error, willRetry),
        }));
        if (willRetry) retryTimer = window.setTimeout(() => {
          if (active && navigator.onLine) void load(attempt + 1);
        }, delay);
      } finally { window.clearTimeout(timeout); pending = false; }
    };
    const visibleRefresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastAttempt > 15000) void load();
    };
    refreshRef.current = () => { window.clearTimeout(retryTimer); void load(); };
    void load();
    const interval = window.setInterval(visibleRefresh, 60000);
    window.addEventListener('focus', visibleRefresh);
    window.addEventListener('online', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => {
      active = false; controller?.abort(); window.clearInterval(interval); window.clearTimeout(retryTimer);
      refreshRef.current = () => undefined;
      window.removeEventListener('focus', visibleRefresh);
      window.removeEventListener('online', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
    };
  }, [key, path, user?.id]);
  const refresh = useCallback(() => refreshRef.current(), []);
  // `key` is internal cache identity; exposing it would be spread into JSX as
  // React's reserved `key` prop by `<WorkspaceFeedback {...resource} />`.
  const shown: ResourceState<T> = state.key === key ? state : { key, error: '', loading: Boolean(path) };
  return { data: shown.data, error: shown.error, loading: shown.loading, updatedAt: shown.updatedAt, refresh };
}
