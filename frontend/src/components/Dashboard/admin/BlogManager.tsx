'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, EmptyState, Field, FormGrid, LinkAction,
  Pager, Pill, Skeleton, StatusNote, TextInput, Toolbar, controlClass, useToast,
} from './AdminUI';

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

interface SourceForm { blog_id: string; api_key: string; label_filter: string; is_enabled: boolean }

export default function BlogManager() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<PostRow>>(`/website/posts/?page=${page}${hidden}`);
  const [source, setSource] = useState<SourceRow | null>(null);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [baseline, setBaseline] = useState('');
  const [form, setForm] = useState<SourceForm>({ blog_id: '', api_key: '', label_filter: '', is_enabled: true });
  const [sourceError, setSourceError] = useState('');
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;
    api.request<SourceRow>('/website/blog/source/')
      .then((data) => {
        if (!active) return;
        const next: SourceForm = { blog_id: data.blog_id, api_key: '', label_filter: data.label_filter, is_enabled: data.is_enabled };
        setSource(data);
        setForm(next);
        setBaseline(JSON.stringify(next));
        setSourceLoaded(true);
      })
      .catch((err) => { if (active) setSourceError(failureMessage(err)); });
    return () => { active = false; };
  }, []);

  const rows = useMemo(() => resource.data?.results ?? [], [resource.data]);
  const dirty = sourceLoaded && JSON.stringify(form) !== baseline;
  const configured = Boolean(source?.blog_id && source.is_enabled);

  const saveSource = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setSourceError('');
    try {
      const saved = await api.request<SourceRow>('/website/blog/source/', { method: 'PATCH', body: JSON.stringify(form) });
      const next: SourceForm = { blog_id: saved.blog_id, api_key: '', label_filter: saved.label_filter, is_enabled: saved.is_enabled };
      setSource(saved);
      setForm(next);
      setBaseline(JSON.stringify(next));
      toast.push('Blogger connection saved.', 'success');
    } catch (err) { setSourceError(failureMessage(err)); } finally { setBusy(false); }
  };

  const sync = async () => {
    setSyncing(true); setSourceError('');
    try {
      const result = await api.request<{ created: number; updated: number; skipped: number }>('/website/posts/sync/', { method: 'POST' });
      toast.push(`Synced ${result.created} new post(s), ${result.updated} refreshed and ${result.skipped} skipped.`, 'success');
      resource.refresh();
      setSource(await api.request<SourceRow>('/website/blog/source/'));
    } catch (err) { setSourceError(failureMessage(err)); } finally { setSyncing(false); }
  };

  const toggleVisible = async (row: PostRow) => {
    setBusy(true);
    try {
      await api.request(`/website/posts/${row.id}/`, { method: 'PATCH', body: JSON.stringify({ is_visible: !row.is_visible }) });
      toast.push(`“${row.title}” is now ${row.is_visible ? 'hidden from the website' : 'visible on the website'}.`, 'success');
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  return (
    <>
      <AdminSection
        title="Blogger connection"
        description="The website mirrors the academy's Blogger account. Every post you publish on Blogger is pulled in on a schedule and listed on the blog page."
        actions={<>
          <Action loading={syncing} disabled={!configured || busy} onClick={() => void sync()}>Sync now</Action>
          <Action type="submit" form="blogger-form" intent="primary" loading={busy} disabled={!sourceLoaded || !dirty}>Save connection</Action>
        </>}
      >
        {sourceError && <StatusNote tone="error">{sourceError}</StatusNote>}
        {!sourceLoaded && !sourceError && <Skeleton rows={2} />}
        {sourceLoaded && source && (
          <>
            <StatusNote tone={source.last_error ? 'error' : 'info'}>
              {source.last_error
                ? `The last sync failed: ${source.last_error}`
                : <>
                  {source.blog_id ? `Connected to blog ${source.blog_id}` : 'No blog ID saved yet'}
                  {source.last_synced_at ? ` · last synced ${formatWorkspaceDate(source.last_synced_at, true)}` : ' · never synced'}
                  {source.has_api_key ? ' · Google API key stored on the server' : ' · no Google API key stored'}
                </>}
            </StatusNote>
            <form id="blogger-form" onSubmit={(event) => void saveSource(event)}>
              <FormGrid columns={3}>
                <Field label="Blogger blog ID" hint="Open Blogger, then Settings. The blog ID is the long number in the address bar.">
                  <TextInput value={form.blog_id} onChange={(event) => setForm({ ...form, blog_id: event.target.value })} placeholder="5801234567890123456" />
                </Field>
                <Field label="Only import posts with this label" optional hint="Leave blank to import every published post.">
                  <TextInput value={form.label_filter} onChange={(event) => setForm({ ...form, label_filter: event.target.value })} />
                </Field>
                <Field
                  label="Google API key"
                  optional
                  hint={source.has_api_key ? 'A key is already stored. Leave this blank to keep it.' : 'Required before Blogger will return posts.'}
                >
                  <TextInput
                    type="password"
                    value={form.api_key}
                    onChange={(event) => setForm({ ...form, api_key: event.target.value })}
                    autoComplete="new-password"
                    placeholder={source.has_api_key ? 'Stored' : 'Paste the key'}
                  />
                </Field>
              </FormGrid>
              <CheckRow
                label="Sync automatically"
                hint="A scheduled pull keeps new Blogger posts arriving without you pressing Sync now."
                checked={form.is_enabled}
                onChange={(event) => setForm({ ...form, is_enabled: event.target.checked })}
              />
            </form>
            {!configured && <p className="text-sm">Sync becomes available once a blog ID is saved and syncing is enabled.</p>}
          </>
        )}
      </AdminSection>

      <AdminSection
        title="Posts from Blogger"
        description="Hide a post to keep it off the website without touching Blogger. Nothing here is deleted."
      >
        <Toolbar label="Post list controls">
          <Field label="Show">
            <select
              className={controlClass}
              value={hidden}
              onChange={(event) => { setHidden(event.target.value); setPage(1); }}
            >
              <option value="">All posts</option>
              <option value="&is_visible=false">Hidden from the website</option>
              <option value="&is_visible=true">Visible on the website</option>
            </select>
          </Field>
          <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
        </Toolbar>

        {resource.error && <StatusNote tone="error">{resource.error}</StatusNote>}
        {resource.error && resource.data && <p className="text-sm">Showing the last posts we could load.</p>}
        {resource.loading && !resource.data && <Skeleton rows={3} />}
        {resource.data && (rows.length
          ? <AdminList label="Blog posts">
            {rows.map((row) => (
              <AdminRow
                key={row.id}
                thumbnail={row.thumbnail_url || undefined}
                placeholder="bi-newspaper"
                title={row.title}
                badges={<Pill tone={row.is_visible ? 'live' : 'draft'}>{row.is_visible ? 'Visible on site' : 'Hidden'}</Pill>}
                meta={<>
                  {formatWorkspaceDate(row.published_at, true)}
                  {row.author_name ? ` · ${row.author_name}` : ''}
                  {row.labels.length ? ` · ${row.labels.join(', ')}` : ''}
                </>}
                description={row.summary}
                actions={<>
                  {row.url && <LinkAction href={row.url} external>Open on Blogger</LinkAction>}
                  <Action disabled={busy} onClick={() => void toggleVisible(row)}>{row.is_visible ? 'Hide from website' : 'Show on website'}</Action>
                </>}
              />
            ))}
          </AdminList>
          : <EmptyState
            icon="bi-journal-richtext"
            title={hidden ? 'No posts in this view' : 'No posts cached yet'}
            description={hidden
              ? 'Nothing matches this filter. Switch back to All posts to see everything that has been imported.'
              : 'Save the Blogger connection, then use Sync now. After that, anything you publish on Blogger arrives here on its own.'}
            action={hidden
              ? <Action onClick={() => { setHidden(''); setPage(1); }}>Show all posts</Action>
              : configured
                ? <Action intent="primary" loading={syncing} onClick={() => void sync()}>Sync now</Action>
                : undefined}
          />)}
        {resource.data && <Pager
          label="Blog posts"
          page={page}
          count={resource.data.count}
          hasNext={!!resource.data.next}
          busy={resource.loading}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />}
      </AdminSection>
    </>
  );
}
