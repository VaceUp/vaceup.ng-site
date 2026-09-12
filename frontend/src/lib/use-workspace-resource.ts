'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './api';
import { useAuth } from './auth-context';

interface ResourceState<T> { key: string; data?: T; error: string; loading: boolean; updatedAt?: Date; }

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
    const load = async () => {
      if (pending || !active) return;
      pending = true; lastAttempt = Date.now(); controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 20000);
      setState((current) => ({ ...(current.key === key ? current : { key }), loading: true, error: '' }));
      try {
        const data = await api.request<T>(path, { signal: controller.signal, cache: 'no-store' });
        if (active) setState({ key, data, error: '', loading: false, updatedAt: new Date() });
      } catch (error) {
        if (active) {
          const message = error instanceof ApiError && error.status === 401
            ? 'Your session has expired. Sign in again to continue.'
            : error instanceof ApiError && error.status === 403
              ? 'Your account does not have access to this section.'
              : 'We could not load the latest information. Check your connection and try again.';
          setState((current) => ({ ...(current.key === key ? current : { key }), loading: false, error: message }));
        }
      } finally { window.clearTimeout(timeout); pending = false; }
    };
    const visibleRefresh = () => {
      if (document.visibilityState === 'visible' && navigator.onLine && Date.now() - lastAttempt > 15000) void load();
    };
    refreshRef.current = () => { void load(); };
    void load();
    const interval = window.setInterval(visibleRefresh, 60000);
    window.addEventListener('focus', visibleRefresh);
    window.addEventListener('online', visibleRefresh);
    document.addEventListener('visibilitychange', visibleRefresh);
    return () => {
      active = false; controller?.abort(); window.clearInterval(interval);
      refreshRef.current = () => undefined;
      window.removeEventListener('focus', visibleRefresh);
      window.removeEventListener('online', visibleRefresh);
      document.removeEventListener('visibilitychange', visibleRefresh);
    };
  }, [key, path, user?.id]);
  const refresh = useCallback(() => refreshRef.current(), []);
  return { ...(state.key === key ? state : { key, error: '', loading: Boolean(path) }), refresh };
}
