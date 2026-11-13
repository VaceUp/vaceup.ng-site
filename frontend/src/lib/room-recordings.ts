import { api } from './api';

export type RecordingScope = { kind: 'class' | 'event' | 'meeting'; id: string; token?: string };
export type Replay = { id: string; title: string; created_at: string; size_bytes: number; url: string };

export const loadReplays = (scope: RecordingScope) => api.request<{ recordings: Replay[]; expires_in: number }>(
  '/room-recordings/replays/', { method: 'POST', body: JSON.stringify(scope) },
);

/** Upload bytes directly to private storage; publish only after the server verifies them. */
export async function publishRecording(scope: RecordingScope, blob: Blob, title: string, onProgress: (value: number) => void) {
  const contentType = blob.type.split(';')[0];
  const result = await api.request<{ id: string; upload_url: string; content_type: string }>('/room-recordings/', {
    method: 'POST', body: JSON.stringify({ ...scope, title: title.slice(0, 200), content_type: contentType, size_bytes: blob.size }),
  });
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', result.upload_url);
    // Storage URLs are already signed; never send the account's bearer token here.
    xhr.setRequestHeader('Content-Type', result.content_type);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onerror = () => reject(new Error('Recording upload could not reach storage. Keep the device copy and retry publishing.'));
    xhr.ontimeout = () => reject(new Error('Recording upload timed out. Keep the device copy and retry publishing.'));
    xhr.timeout = 60 * 60 * 1000;
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Storage refused the recording upload. Keep the device copy and retry publishing.'));
    xhr.send(blob);
  });
  await api.request(`/room-recordings/${result.id}/complete/`, { method: 'POST' });
}
