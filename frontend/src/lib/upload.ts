/**
 * Browser uploads with real progress.
 *
 * `fetch` cannot report how many bytes have left the browser, so a large video
 * looks frozen for minutes and a failure arrives without any clue where it
 * happened. XHR exposes upload progress and a distinct error for a connection
 * that died, which is the difference between "the bucket refused this" and
 * "your connection dropped".
 */

export interface UploadSnapshot {
  loaded: number;
  total: number;
  percent: number;
  bytesPerSecond: number;
  secondsLeft: number | null;
}

export type UploadFailure = 'network' | 'http' | 'aborted' | 'timeout';

export class UploadError extends Error {
  constructor(message: string, readonly kind: UploadFailure, readonly status?: number) {
    super(message);
    this.name = 'UploadError';
  }
}

export interface UploadHandle {
  promise: Promise<void>;
  abort: () => void;
}

/** No progress for this long means the connection has quietly given up. */
const STALL_AFTER_MS = 20_000;

export function putFileWithProgress(
  url: string,
  file: Blob,
  headers: Record<string, string>,
  onProgress: (snapshot: UploadSnapshot) => void,
  onStall: () => void,
): UploadHandle {
  const xhr = new XMLHttpRequest();
  const total = file.size;
  const startedAt = Date.now();
  let lastLoaded = 0;
  let lastLoadedAt = startedAt;
  let stallTimer: ReturnType<typeof setTimeout> | undefined;

  const armStallWatch = () => {
    clearTimeout(stallTimer);
    stallTimer = setTimeout(() => {
      if (xhr.readyState < 4 && lastLoaded < total) onStall();
    }, STALL_AFTER_MS);
  };

  const report = (loaded: number) => {
    const now = Date.now();
    const elapsed = Math.max(now - startedAt, 1);
    const sinceLastReport = now - lastLoadedAt;
    const recent = sinceLastReport > 0 ? ((loaded - lastLoaded) * 1000) / sinceLastReport : 0;
    const average = (loaded * 1000) / elapsed;
    const speed = Math.max(recent, average);
    lastLoaded = loaded;
    lastLoadedAt = now;
    onProgress({
      loaded,
      total,
      percent: total ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      bytesPerSecond: Math.round(speed),
      secondsLeft: speed > 0 && total > loaded ? Math.ceil((total - loaded) / speed) : null,
    });
    armStallWatch();
  };

  const promise = new Promise<void>((resolve, reject) => {
    xhr.open('PUT', url, true);
    Object.entries(headers).forEach(([name, value]) => xhr.setRequestHeader(name, value));
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) report(event.loaded);
    };
    xhr.onload = () => {
      clearTimeout(stallTimer);
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new UploadError(`The storage bucket answered HTTP ${xhr.status}.`, 'http', xhr.status));
    };
    xhr.onerror = () => {
      clearTimeout(stallTimer);
      // Browser CORS rules and a dropped connection both land here.
      reject(new UploadError('The browser could not reach the storage bucket.', 'network'));
    };
    xhr.ontimeout = () => {
      clearTimeout(stallTimer);
      reject(new UploadError('The upload timed out.', 'timeout'));
    };
    xhr.onabort = () => {
      clearTimeout(stallTimer);
      reject(new UploadError('The upload was cancelled.', 'aborted'));
    };
    report(0);
    xhr.send(file);
  });

  // The caller always sees the rejection; this only stops an unhandled-rejection
  // warning when a cancel races a page close.
  promise.catch(() => undefined);

  return { promise, abort: () => xhr.abort() };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'less than a second';
  if (seconds < 60) return `about ${Math.ceil(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `about ${minutes} min` : `about ${Math.round(minutes / 60)} hr`;
}
