'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import { Action, ConfirmDelete, Field, Feedback, styles } from './AuthoringUI';
import { WorkspacePagination } from '../WorkspaceUI';

interface EventRow {
  id: number; title: string; slug: string; summary: string; description: string;
  event_type: string; event_type_label: string; starts_at: string; ends_at: string | null;
  location: string; is_online: boolean; meeting_url: string; registration_url: string;
  capacity: number | null; image_url: string; image: string; is_featured: boolean;
  is_published: boolean; seats_taken: number; registrations_count?: number;
}

interface Registration { id: number; name: string; email: string; phone: string; note: string; created_at: string; }

const EVENT_TYPES = [
  { value: 'open_day', label: 'Open Day' },
  { value: 'career_fair', label: 'Career Fair' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'networking', label: 'Networking' },
  { value: 'info_session', label: 'Info Session' },
  { value: 'hackathon', label: 'Hackathon' },
  { value: 'other', label: 'Other' },
];

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
};

const emptyDraft = () => ({
  title: '', summary: '', description: '', event_type: 'workshop',
  starts_at: '', ends_at: '', location: '', is_online: false, meeting_url: '',
  registration_url: '', capacity: '', image_url: '', is_featured: false, is_published: false,
});

export default function EventsManager() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<EventRow>>(`/website/events/?page=${page}${filter ? `&${filter}` : ''}`);
  const [draft, setDraft] = useState(emptyDraft());
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<EventRow | null>(null);
  const [roster, setRoster] = useState<{ event: EventRow; rows: Registration[] } | null>(null);
  const [rosterBusy, setRosterBusy] = useState(false);

  const reset = () => { setEditing(null); setDraft(emptyDraft()); setCover(null); setNotice(''); setError(''); };

  const edit = (row: EventRow) => {
    setEditing(row);
    setCover(null);
    setDraft({
      title: row.title, summary: row.summary, description: row.description, event_type: row.event_type,
      starts_at: toLocalInput(row.starts_at), ends_at: toLocalInput(row.ends_at), location: row.location,
      is_online: row.is_online, meeting_url: row.meeting_url || '', registration_url: row.registration_url,
      capacity: row.capacity === null ? '' : String(row.capacity), image_url: '',
      is_featured: row.is_featured, is_published: row.is_published,
    });
    setNotice(`Editing “${row.title}”. Saving keeps it ${row.is_published ? 'live on the website' : 'hidden as a draft'}.`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) { setError('Give the event a title.'); return; }
    if (!draft.starts_at) { setError('Every event needs a start date and time.'); return; }
    if (draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) { setError('The end time must be after the start time.'); return; }
    setBusy(true); setError(''); setNotice('');
    const body = new FormData();
    const fields: Record<string, string | boolean> = {
      title: draft.title.trim(), summary: draft.summary.trim(), description: draft.description.trim(),
      event_type: draft.event_type, starts_at: new Date(draft.starts_at).toISOString(),
      ends_at: draft.ends_at ? new Date(draft.ends_at).toISOString() : '',
      capacity: draft.capacity,
      location: draft.location.trim(), is_online: draft.is_online, registration_url: draft.registration_url.trim(),
      is_featured: draft.is_featured, is_published: draft.is_published,
    };
    if (draft.image_url) fields.image_url = draft.image_url.trim();
    Object.entries(fields).forEach(([key, value]) => body.append(key, String(value)));
    // Draft events keep no meeting link so it cannot leak before publication.
    body.append('meeting_url', draft.is_published ? draft.meeting_url.trim() : '');
    if (cover) body.append('cover_image', cover);
    try {
      if (editing) await api.request(`/website/events/${editing.slug}/`, { method: 'PATCH', body });
      else await api.request('/website/events/', { method: 'POST', body });
      setNotice(editing
        ? `“${draft.title}” was updated${draft.is_published ? ' and is live on the Events page.' : ' and stays hidden as a draft.'}`
        : draft.is_published
          ? `“${draft.title}” was created and published to the Events page.`
          : `“${draft.title}” was saved as a draft. Publish it when the details are final.`);
      reset();
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const setState = async (row: EventRow, is_published: boolean) => {
    setBusy(true); setError('');
    try {
      await api.request(`/website/events/${row.slug}/`, { method: 'PATCH', body: JSON.stringify({ is_published }) });
      setNotice(is_published ? `“${row.title}” is now on the public Events page.` : `“${row.title}” was moved back to draft and hidden from visitors.`);
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const openRoster = async (row: EventRow) => {
    setRosterBusy(true); setError('');
    try {
      const result = await api.request<{ count: number; results: Registration[] }>(`/website/events/${row.slug}/registrations/`);
      setRoster({ event: row, rows: result.results });
    } catch (err) { setError(failureMessage(err)); } finally { setRosterBusy(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true); setError('');
    try {
      await api.request(`/website/events/${confirm.slug}/`, { method: 'DELETE' });
      setNotice(`“${confirm.title}” was deleted along with its registrations.`);
      if (editing?.id === confirm.id) reset();
      setConfirm(null);
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  return <div className={`${styles.root} ${styles.stack}`}>
    <div className={styles.heading}>
      <h2>Website events</h2>
      <p className={styles.muted}>Create, edit, publish and delete events yourself. The public Events page shows published events only, and visitors register on that page.</p>
    </div>
    <Feedback error={error || resource.error} message={notice} />

    <form className={`${styles.panel} ${styles.stack}`} onSubmit={(event) => void submit(event)} aria-label={editing ? 'Edit event' : 'New event'}>
      <div className={styles.row}><h3>{editing ? `Editing “${editing.title}”` : 'Plan an event'}</h3>{editing && <Action disabled={busy} onClick={reset}>Cancel editing</Action>}</div>
      <Field label="Title"><input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} maxLength={200} required /></Field>
      <Field label="One-line summary"><input value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} maxLength={300} /></Field>
      <Field label="Full description"><textarea rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Field>
      <div className={styles.grid}>
        <Field label="Type"><select value={draft.event_type} onChange={(event) => setDraft({ ...draft, event_type: event.target.value })}>
          {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
        </select></Field>
        <Field label="Starts (your timezone)"><input type="datetime-local" value={draft.starts_at} onChange={(event) => setDraft({ ...draft, starts_at: event.target.value })} required /></Field>
        <Field label="Ends (optional)"><input type="datetime-local" value={draft.ends_at} onChange={(event) => setDraft({ ...draft, ends_at: event.target.value })} /></Field>
        <Field label="Seats (blank for unlimited)"><input type="number" min="1" value={draft.capacity} onChange={(event) => setDraft({ ...draft, capacity: event.target.value })} /></Field>
      </div>
      <div className={styles.grid}>
        <Field label="Venue"><input value={draft.location} onChange={(event) => setDraft({ ...draft, location: event.target.value })} maxLength={250} placeholder="669, Abeokuta Expressway, Lagos" /></Field>
        <Field label="Cover image URL (optional)"><input type="url" value={draft.image_url} onChange={(event) => setDraft({ ...draft, image_url: event.target.value })} placeholder="https://…" /></Field>
        <Field label="Or upload a cover"><input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] || null)} />{editing?.image && <span className={styles.muted}> Currently using the stored cover.</span>}</Field>
      </div>
      <div className={styles.row}>
        <label className={styles.check}><input type="checkbox" checked={draft.is_online} onChange={(event) => setDraft({ ...draft, is_online: event.target.checked })} />Online event</label>
        <label className={styles.check}><input type="checkbox" checked={draft.is_featured} onChange={(event) => setDraft({ ...draft, is_featured: event.target.checked })} />Feature at the top of the page</label>
        <label className={styles.check}><input type="checkbox" checked={draft.is_published} onChange={(event) => setDraft({ ...draft, is_published: event.target.checked })} />Publish to the website now</label>
      </div>
      {draft.is_online && <Field label="Joining link (only sent after the event is published)"><input type="url" value={draft.meeting_url} onChange={(event) => setDraft({ ...draft, meeting_url: event.target.value })} placeholder="https://meet.google.com/…" /></Field>}
      <Field label="Use an external sign-up page instead? (leave blank to collect RSVPs here)"><input type="url" value={draft.registration_url} onChange={(event) => setDraft({ ...draft, registration_url: event.target.value })} placeholder="https://…" /></Field>
      <p className={styles.muted}>With no external link, visitors register on the event card and you read their names, emails and notes under View registrations.</p>
      <div><Action type="submit" intent="primary" loading={busy}>{editing ? 'Save event' : draft.is_published ? 'Create and publish' : 'Save as draft'}</Action></div>
    </form>

    <div className={`${styles.row} ${styles.between}`}>
      <Field label="Show"><select value={filter} onChange={(event) => { setFilter(event.target.value); setPage(1); }}>
        <option value="">All events</option><option value="scope=upcoming">Upcoming</option><option value="scope=past">Past</option>
      </select></Field>
      <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
    </div>

    {resource.error && resource.data && <p className={styles.muted}>Showing the last events we could load.</p>}
    {resource.data && (resource.data.results.length
      ? <ul className={styles.list}>{resource.data.results.map((row) => <li className={`${styles.panel} ${styles.stack}`} key={row.id}>
        <div className={`${styles.row} ${styles.between}`}>
          <h3>{row.title}</h3>
          <span className={styles.badge}>{row.is_published ? (row.is_featured ? 'Published · featured' : 'Published') : 'Draft'}</span>
        </div>
        <p className={styles.muted}>{row.event_type_label} · {formatWorkspaceDate(row.starts_at, true)}{row.ends_at ? ` - ${formatWorkspaceDate(row.ends_at, true)}` : ''} · {row.is_online ? 'Online' : row.location || 'Venue not set'}</p>
        <p className={styles.muted}>
          {row.capacity === null ? `${row.seats_taken} registered, unlimited seats` : `${row.seats_taken}/${row.capacity} seats taken`}
          {row.registration_url ? ' · sign-ups go to an external page' : ''}{row.meeting_url ? ' · joining link stored' : ''}
        </p>
        {row.summary && <p className={styles.preview}>{row.summary}</p>}
        <div className={styles.row}>
          {row.is_published
            ? <Action disabled={busy} onClick={() => void setState(row, false)}>Move back to draft</Action>
            : <Action intent="primary" disabled={busy} onClick={() => void setState(row, true)}>Publish now</Action>}
          {!row.registration_url && <Action disabled={rosterBusy} onClick={() => void openRoster(row)}>View registrations</Action>}
          <Action disabled={busy} onClick={() => edit(row)}>Edit</Action>
          <Action intent="danger" disabled={busy} onClick={() => setConfirm(row)}>Delete</Action>
        </div>
      </li>)}</ul>
      : <div className={styles.empty}><h3>No events in this view</h3><p className={styles.muted}>Plan one above. Drafts stay invisible to visitors until you publish them.</p></div>)}
    {resource.data && <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} />}

    {roster && <div className={`${styles.panel} ${styles.stack}`} role="dialog" aria-label={`Registrations for ${roster.event.title}`}>
      <div className={`${styles.row} ${styles.between}`}>
        <h3>Registrations - {roster.event.title}</h3>
        <Action onClick={() => setRoster(null)}>Close</Action>
      </div>
      <p className={styles.muted}>{roster.rows.length} people{roster.event.capacity === null ? '' : ` of ${roster.event.capacity} seats`}.</p>
      {roster.rows.length
        ? <ul className={styles.list}>{roster.rows.map((row) => <li key={row.id} className={styles.panel}>
          <strong>{row.name}</strong> · <a href={`mailto:${row.email}`}>{row.email}</a>{row.phone ? ` · ${row.phone}` : ''}
          {row.note && <p className={styles.preview}>{row.note}</p>}
          <p className={styles.muted}>Signed up {formatWorkspaceDate(row.created_at, true)}</p>
        </li>)}</ul>
        : <p className={styles.muted}>Nobody has registered yet.</p>}
    </div>}

    {confirm && <ConfirmDelete title="Delete event" description={`“${confirm.title}” and its ${confirm.seats_taken} registration(s) will be removed permanently.`} confirmationName={confirm.title} error={error} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void remove()} />}
  </div>;
}
