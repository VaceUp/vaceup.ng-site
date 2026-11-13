'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Play, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api, ApiError } from '@/lib/api';
import { loadReplays, type RecordingScope, type Replay } from '@/lib/room-recordings';
import styles from './RoomRecordings.module.css';

export default function ReplayList({ scope, legacyClassId, autoLoad = false }: {
  scope: RecordingScope; legacyClassId?: number; autoLoad?: boolean;
}) {
  const [rows, setRows] = useState<Replay[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { kind, id, token } = scope;
  const open = useCallback(async () => {
    setBusy(true); setError('');
    try {
      let recordings: Replay[] = [];
      try { recordings = (await loadReplays({ kind, id, token })).recordings; }
      catch (failure) {
        // Keep existing class replays working while the cPanel overlay is installed.
        if (!(legacyClassId && failure instanceof ApiError && failure.status === 404)) throw failure;
      }
      if (!recordings.length && legacyClassId) {
        const legacy = await api.request<{ url: string }>(`/live-classes/${legacyClassId}/recording-url/`);
        recordings.push({ id: 'legacy', title: 'Class recording', created_at: '', size_bytes: 0, url: legacy.url });
      }
      setRows(recordings);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Recordings could not be loaded. Try again.'); }
    finally { setBusy(false); }
  }, [kind, id, token, legacyClassId]);
  useEffect(() => { if (autoLoad) void open(); }, [autoLoad, open]);
  return <section className={styles.replays} aria-label="Session recordings">
    <Button className={styles.secondary} leftIcon={rows ? <RefreshCw /> : <Play />} loading={busy} onClick={() => void open()}>{rows ? 'Refresh recordings' : 'Watch recordings'}</Button>
    {error && <p role="alert">{error}</p>}
    {rows?.length === 0 && <div className={styles.empty}><Play aria-hidden="true" /><p>No recordings yet</p><span>Your tutor&apos;s saved sessions will appear here.</span></div>}
    {rows?.map(row => <article key={row.id} className={styles.replay}>
      <div className={styles.replayHeading}><h3>{row.title}</h3>{row.created_at && <p>{new Date(row.created_at).toLocaleString()}</p>}</div>
      <video controls preload="none" src={row.url} aria-label={row.title} />
      <a className={styles.textLink} href={row.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer"><ExternalLink aria-hidden="true" />Open recording</a>
    </article>)}
  </section>;
}
