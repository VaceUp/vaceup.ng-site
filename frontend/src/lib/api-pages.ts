import { api } from './api';
import { apiErrorMessage } from './api-errors';

export type ApiPage<T> = { results: T[]; next: string | null; count?: number };

/** Follow pagination only within our configured API; never forward tokens elsewhere. */
export function apiPagePath(next: string): string {
  const base = new URL(api.baseUrl);
  const url = new URL(next, `${api.baseUrl}/`);
  const prefix = `${base.pathname.replace(/\/$/, '')}/`;
  if (url.origin !== base.origin || !url.pathname.startsWith(prefix)) {
    throw new Error('The server returned an invalid pagination link. Please refresh.');
  }
  return `/${url.pathname.slice(prefix.length)}${url.search}`;
}

export async function getApiPage<T>(path: string): Promise<ApiPage<T>> {
  const data = await api.request<ApiPage<T> | T[]>(path);
  if (Array.isArray(data)) return { results: data, next: null, count: data.length };
  if (!data || !Array.isArray(data.results)) throw new Error('The server returned an unexpected response. Please refresh.');
  return data;
}

/** Authenticated binary download, with the same one-time token refresh as JSON. */
export async function downloadApiFile(path: string, filename: string): Promise<void> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Invalid download path.');
  const fetchFile = () => fetch(`${api.baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${api.getToken() || ''}` },
    redirect: 'error',
    cache: 'no-store',
  });
  let response = await fetchFile();
  if (response.status === 401 && api.getToken()) { await api.refreshToken(); response = await fetchFile(); }
  if (!response.ok) throw new Error(apiErrorMessage(await response.json().catch(() => ({})), response.status));
  const objectUrl = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}
