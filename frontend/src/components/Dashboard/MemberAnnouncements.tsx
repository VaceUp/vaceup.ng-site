'use client';

import { useState } from 'react';
import { Bell, Megaphone } from 'lucide-react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, type WorkspaceAnnouncement, type WorkspacePage } from '@/lib/workspace-api';
import { WorkspaceButton, WorkspaceEmpty, WorkspaceFeedback, WorkspaceHeading, WorkspacePagination, WorkspacePanel, WorkspaceRefresh, styles } from './WorkspaceUI';

interface AnnouncementPage extends WorkspacePage<WorkspaceAnnouncement> { unread_count?: number; }

export default function MemberAnnouncements() {
  const [page, setPage] = useState(1);
  const [read, setRead] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState('');
  const resource = useWorkspaceResource<AnnouncementPage>(`/announcements/?published=true&page=${page}`);
  const markRead = async (announcement: WorkspaceAnnouncement) => {
    setBusy(announcement.id); setError('');
    try {
      await api.request(`/announcements/${announcement.id}/read/`, { method: 'POST' });
      setRead(current => new Set(current).add(announcement.id));
    } catch {
      setError('This announcement could not be marked as read. Try again.');
    } finally { setBusy(null); }
  };
  const unread = resource.data ? Math.max(0, (resource.data.unread_count ?? 0) - read.size) : 0;
  return <>
    <WorkspaceHeading title="Announcements" description="Updates published by your academy and tutors for your courses."
      action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    {resource.data && <p className={styles.muted}>{unread ? `${unread} announcement${unread === 1 ? '' : 's'} not read yet.` : 'You are up to date with published announcements.'}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(item => {
      const isRead = item.has_read || read.has(item.id);
      return <li key={item.id}><details className={styles.record}>
        <summary className={styles.announcementSummary}><Megaphone aria-hidden="true" /><span><strong>{item.title}</strong>
          <span className={styles.agendaMeta}>{item.author_name} / {formatWorkspaceDate(item.publish_at || item.created_at)}<span className={styles.badge}>{isRead ? 'Read' : 'New'}</span><span className={styles.badge}>{item.priority}</span></span>
        </span></summary>
        <div className={styles.announcementBody}><p>{item.body}</p>
          {!isRead && <WorkspaceButton loading={busy === item.id} onClick={() => void markRead(item)}><Bell aria-hidden="true" />Mark as read</WorkspaceButton>}
        </div>
      </details></li>;
    })}</ul> : <WorkspacePanel><WorkspaceEmpty title="No announcements yet">Published academy and course announcements will appear here. Check back later.</WorkspaceEmpty></WorkspacePanel>}
      <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}
