'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import { Action, Field, Feedback, styles } from './AuthoringUI';
import { WorkspacePagination } from '../WorkspaceUI';

interface PostRow {
  id: number; blogger_id: string; title: string; url: string; summary: string;
  author_name: string; labels: string[]; thumbnail_url: string; published_at: string;
  is_visible: boolean;
}

interface SourceRow {
  id: number | null;
  blog_id: string;
  has_api_key: boolean;
  label_filter: string;
  is_enabled: boolean;
  last_synced_at: string | null;
  last_error: string;
}

export default function BlogManager() {
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<PostRow>>(`/website/posts/?page=${page}${hidden}`);
  const [source, setSource] = useState<SourceRow | null>(null);
  const [form, setForm] = useState({ blog_id: '', api_key: '', label_filter: '', is_enabled: true });
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    api.request<SourceRow>('/website/blog/source/')
      .then((data) => {
        if (!active) return;
        setSource(data);
        setForm({ blog_id: data.blog_id, api_key: '', label_filter: data.label_filter, is_enabled: data.is_enabled });
      })
      .catch((err) => { if (active) setError(failureMessage(err)); });
    return () => { active = false; };
  }, []);

  const saveSource = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await api.request<SourceRow>('/website/blog/source/', {
        method: 'PATCH',
        body: JSON.stringify(form),
      });
      setSource(saved);
      setForm((current) => ({ ...current, api_key: '', blog_id: saved.blog_id, label_filter: saved.label_filter, is_enabled: saved.is_enabled }));
      setNotice('Blogger connection saved.');
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const sync = async () => {
    setSyncing(true); setError(''); setNotice('');
    try {
      const result = await api.request<{ created: number; updated: number; skipped: number }>('/website/posts/sync/', { method: 'POST' });
      setNotice(`Synced: ${result.created} new post(s), ${result.updated} refreshed, ${result.skipped} skipped. New posts appear on the blog listing automatically.`);
      resource.refresh();
      const refreshed = await api.request<SourceRow>('/website/blog/source/');
      setSource(refreshed);
    } catch (err) { setError(failureMessage(err)); } finally { setSyncing(false); }
  };

  const toggleVisible = async (row: PostRow) => {
    setBusy(true); setError('');
    try {
      await api.request(`/website/posts/${row.id}/`, { method: 'PATCH', body: JSON.stringify({ is_visible: !row.is_visible }) });
      setNotice(`“${row.title}” is now ${row.is_visible ? 'hidden from the website' : 'visible on the website'}.`);
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const configured = Boolean(source?.blog_id && source.is_enabled);

  return <div className={`${styles.root} ${styles.stack}`}>
    <div className={styles.heading}>
      <h2>Blog &amp; Blogger</h2>
      <p className={styles.muted}>The website mirrors the academy&apos;s Blogger account. Every post you publish on Blogger is pulled in on a schedule and listed on the blog page.</p>
    </div>
    <Feedback error={error || resource.error} message={notice} />

    <form className={`${styles.panel} ${styles.stack}`} onSubmit={(event) => void saveSource(event)} aria-label="Blogger connection">
      <h3>Blogger connection</h3>
      {!source && <p className={styles.muted}>Loading the stored connection…</p>}
      {source && <p className={styles.muted}>
        {source.blog_id ? `Blog ID ${source.blog_id}` : 'No blog ID saved yet.'}
        {source.last_synced_at ? ` · last synced ${formatWorkspaceDate(source.last_synced_at, true)}` : ' · never synced'}
        {source.has_api_key ? ' · API key stored' : ''}
      </p>}
      {source?.last_error && <p className={`${styles.status} ${styles.error}`}>{source.last_error}</p>}
      <div className={styles.grid}>
        <Field label="Blogger blog ID"><input value={form.blog_id} onChange={(event) => setForm({ ...form, blog_id: event.target.value })} placeholder="e.g. 5801234567890123456" /></Field>
        <Field label="Only import posts with this label (optional)"><input value={form.label_filter} onChange={(event) => setForm({ ...form, label_filter: event.target.value })} /></Field>
        <Field label="Google API key (optional, leave blank to keep the stored key)"><input type="password" value={form.api_key} onChange={(event) => setForm({ ...form, api_key: event.target.value })} autoComplete="new-password" /></Field>
      </div>
      <label className={styles.check}><input type="checkbox" checked={form.is_enabled} onChange={(event) => setForm({ ...form, is_enabled: event.target.checked })} />Sync automatically</label>
      <p className={styles.muted}>Find the blog ID in Blogger under Settings — it is the number in the address bar of the Blogger dashboard.</p>
      <div className={styles.row}>
        <Action type="submit" intent="primary" loading={busy}>Save connection</Action>
        <Action loading={syncing} disabled={!configured} onClick={() => void sync()}>Sync now</Action>
      </div>
      {!configured && <p className={styles.muted}>Sync is available once a blog ID is saved and syncing is enabled.</p>}
    </form>

    <div className={`${styles.row} ${styles.between}`}>
      <Field label="Show"><select value={hidden} onChange={(event) => { setHidden(event.target.value); setPage(1); }}>
        <option value="">All posts</option><option value="&is_visible=false">Hidden from the website</option><option value="&is_visible=true">Visible on the website</option>
      </select></Field>
      <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
    </div>

    {resource.error && resource.data && <p className={styles.muted}>Showing the last posts we could load.</p>}
    {resource.data && (resource.data.results.length
      ? <ul className={styles.list}>{resource.data.results.map((row) => <li className={`${styles.panel} ${styles.stack}`} key={row.id}>
        <div className={`${styles.row} ${styles.between}`}>
          <h3>{row.title}</h3>
          <span className={styles.badge}>{row.is_visible ? 'Visible' : 'Hidden'}</span>
        </div>
        <p className={styles.muted}>
          {formatWorkspaceDate(row.published_at, true)}
          {row.author_name ? ` · ${row.author_name}` : ''}
          {row.labels.length ? ` · ${row.labels.join(', ')}` : ''}
        </p>
        {row.summary && <p className={styles.preview}>{row.summary}</p>}
        <div className={styles.row}>
          <a href={row.url} target="_blank" rel="noopener noreferrer" className={styles.action}>Open on Blogger</a>
          <Action disabled={busy} onClick={() => void toggleVisible(row)}>{row.is_visible ? 'Hide from website' : 'Show on website'}</Action>
        </div>
      </li>)}</ul>
      : <div className={styles.empty}><h3>No posts cached yet</h3><p className={styles.muted}>Save the Blogger connection and use Sync now. After that, anything you publish on Blogger arrives here on its own.</p></div>)}
    {resource.data && <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} />}
  </div>;
}
