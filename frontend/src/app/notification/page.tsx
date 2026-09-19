'use client';

import { useEffect, useState } from 'react';
import { api, type Notification, type PaginatedResponse } from '@/lib/api';
import MemberAccess from '@/components/Dashboard/MemberAccess';
import { WorkspaceHeading, WorkspacePagination } from '@/components/Dashboard/WorkspaceUI';
import { Action, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';

function Notifications() {
  const [data, setData] = useState<PaginatedResponse<Notification> | null>(null);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false, running = false;
    async function load() {
      if (running || document.visibilityState !== 'visible') return;
      running = true; setLoading(true);
      try { const result = await api.getNotifications({ page }); if (!cancelled) { setData(result); setError(''); } }
      catch (err) { if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load notifications. Try again.'); }
      finally { running = false; if (!cancelled) setLoading(false); }
    }
    void load();
    const timer = window.setInterval(load, 30000);
    document.addEventListener('visibilitychange', load);
    return () => { cancelled = true; clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, [page, revision]);
  async function read(item: Notification) {
    setMarking(item.id); setError('');
    try {
      await api.markNotificationRead(String(item.id));
      setData(current => current ? { ...current, results: current.results.map(row => row.id === item.id ? { ...row, is_read: true } : row) } : current);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not mark the notification read. Try again.'); }
    finally { setMarking(null); }
  }
  return <div className={styles.root + ' ' + styles.stack}>
    <WorkspaceHeading title="Notifications" description="Updates sent to your account. Fetching this page does not mark anything read." action={<Action loading={loading} onClick={() => setRevision(value => value + 1)}>Refresh notifications</Action>} />
    <Feedback error={error} />
    {loading && !data && <p role="status">Loading notifications...</p>}
    {data?.count === 0 && <div className={styles.empty}><h2>You are up to date</h2><p>There are no notifications for your account yet.</p></div>}
    <ul className={styles.list}>{data?.results.map(item => <li key={item.id} className={styles.panel + ' ' + styles.stack}>
      <h2>{item.title}</h2><p>{item.body}</p><time dateTime={item.created_at} className={styles.muted}>{new Date(item.created_at).toLocaleString()}</time>
      {item.is_read ? <span className={styles.badge}>Read</span> : <Action disabled={marking !== null} loading={marking === item.id} onClick={() => read(item)}>Mark read</Action>}
    </li>)}</ul>
    {data && <WorkspacePagination page={page} count={data.count} hasNext={Boolean(data.next)} loading={loading} onPage={setPage} />}
  </div>;
}
export default function NotificationPage() { return <MemberAccess><Notifications /></MemberAccess>; }
