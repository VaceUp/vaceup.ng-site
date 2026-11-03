'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { downloadApiFile } from '@/lib/api-pages';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, Drawer, EmptyState, Field, FileField,
  FormGrid, Pager, Pill, Skeleton, StatusNote, TextInput, Toolbar, controlClass, useToast,
} from './AdminUI';

interface EventRow {
  id: number; title: string; slug: string; summary: string; description: string;
  event_type: string; event_type_label: string; starts_at: string; ends_at: string | null;
  location: string; is_online: boolean; meeting_url: string; registration_url: string;
  live_platform: 'external' | 'livekit' | 'jitsi'; room_name: string; join_ready?: boolean;
  capacity: number | null; image_url: string; image: string; is_featured: boolean;
  is_published: boolean; seats_taken: number; registrations_count?: number;
}

interface Registration {
  id: number; name: string; email: string; phone: string; note: string;
  consent_marketing: boolean; join_link_sent_at: string | null;
  broadcast_sent_at: string | null; created_at: string;
}

interface BroadcastResult {
  detail: string; sent: number; failed: number; remaining: number;
  total: number; done: boolean;
}

// The server mails in bounded batches so one request cannot outlive the
// server's timeout; the panel asks for the next batch until it reports done.
const MAIL_BATCH = 25;

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
  starts_at: '', ends_at: '', location: '', is_online: false,
  live_platform: 'external' as 'external' | 'livekit' | 'jitsi', meeting_url: '', room_name: '',
  registration_url: '', capacity: '', image_url: '', is_featured: false, is_published: false,
});

type Draft = ReturnType<typeof emptyDraft>;
type FieldErrors = Partial<Record<'title' | 'starts_at' | 'ends_at', string>>;

type Platform = EventRow['live_platform'];

// Both built-in rooms are "our own room" to the academy; only the server behind
// them differs, so every label the staff reads treats them as one family.
const isBuiltInRoom = (platform: Platform) => platform === 'livekit' || platform === 'jitsi';

const JOIN_HINTS: Record<Platform, string> = {
  external: 'Attendees click Join on the event page and are sent to this link.',
  jitsi: 'Attendees click Join and land in our own room, run on the free Jitsi server. '
    + 'Nothing to set up, but that server now cuts a meeting off at 95 minutes.',
  livekit: 'Attendees click Join and land in our own room, run on our LiveKit project. '
    + 'Needs the LiveKit keys and the LiveKit server address on the server.',
};

const venueOf = (row: EventRow) => {
  if (!row.is_online) return row.location || 'Venue not set';
  return isBuiltInRoom(row.live_platform) ? 'Online · VaceUp Live Room' : 'Online';
};

const isOver = (row: Pick<EventRow, 'starts_at' | 'ends_at'>) =>
  new Date(row.ends_at || row.starts_at).getTime() < Date.now();

const whenOf = (row: EventRow) =>
  `${formatWorkspaceDate(row.starts_at, true)}${row.ends_at ? ` to ${formatWorkspaceDate(row.ends_at, true)}` : ''}`;

const seatsOf = (row: EventRow) =>
  row.capacity === null
    ? `${row.seats_taken} registered, unlimited seats`
    : `${row.seats_taken} of ${row.capacity} seats taken`;

export default function EventsManager() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<EventRow>>(`/website/events/?page=${page}${filter ? `&${filter}` : ''}`);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirm, setConfirm] = useState<EventRow | null>(null);
  const [roster, setRoster] = useState<{ event: EventRow; rows: Registration[] } | null>(null);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterDrop, setRosterDrop] = useState<Registration | null>(null);
  const [mail, setMail] = useState<{ subject: string; message: string; include_link: boolean } | null>(null);
  const [mailRun, setMailRun] = useState<{ sent: number; failed: number; total: number; running: boolean; error: string } | null>(null);
  const mailHalt = useRef(false);

  const rows = useMemo(() => resource.data?.results ?? [], [resource.data]);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const closeForm = () => { setFormOpen(false); setEditing(null); setFormError(''); setFieldErrors({}); };

  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setCover(null); setFormError(''); setFieldErrors({}); setFormOpen(true); };

  const openEdit = (row: EventRow) => {
    setEditing(row);
    setCover(null);
    setDraft({
      title: row.title, summary: row.summary, description: row.description, event_type: row.event_type,
      starts_at: toLocalInput(row.starts_at), ends_at: toLocalInput(row.ends_at), location: row.location,
      is_online: row.is_online, meeting_url: row.meeting_url || '', registration_url: row.registration_url,
      live_platform: row.live_platform || 'external', room_name: row.room_name || '',
      capacity: row.capacity === null ? '' : String(row.capacity), image_url: '',
      is_featured: row.is_featured, is_published: row.is_published,
    });
    setFormError(''); setFieldErrors({}); setFormOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors: FieldErrors = {};
    if (!draft.title.trim()) errors.title = 'Give the event a title.';
    if (!draft.starts_at) errors.starts_at = 'Every event needs a start date and time.';
    else if (draft.ends_at && new Date(draft.ends_at) <= new Date(draft.starts_at)) errors.ends_at = 'The end time must be after the start time.';
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setBusy(true); setFormError('');
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
    const builtInRoom = draft.is_online && isBuiltInRoom(draft.live_platform);
    body.append('live_platform', draft.is_online ? draft.live_platform : 'external');
    // A blank room name is not a mistake here: the server names the room after
    // the event slug, so choosing the built-in room never leaves a dead link.
    body.append('room_name', builtInRoom ? draft.room_name.trim() : '');
    // Draft events keep no meeting link so it cannot leak before publication.
    body.append('meeting_url', !builtInRoom && draft.is_published ? draft.meeting_url.trim() : '');
    if (cover) body.append('cover_image', cover);
    try {
      if (editing) await api.request(`/website/events/${editing.slug}/`, { method: 'PATCH', body });
      else await api.request('/website/events/', { method: 'POST', body });
      toast.push(editing
        ? `“${draft.title}” was updated${draft.is_published ? ' and is live on the Events page.' : ' and stays hidden as a draft.'}`
        : draft.is_published
          ? `“${draft.title}” was created and published to the Events page.`
          : `“${draft.title}” was saved as a draft. Publish it when the details are final.`, 'success');
      closeForm();
      resource.refresh();
    } catch (err) { setFormError(failureMessage(err)); } finally { setBusy(false); }
  };

  const setState = async (row: EventRow, is_published: boolean) => {
    setBusy(true);
    try {
      await api.request(`/website/events/${row.slug}/`, { method: 'PATCH', body: JSON.stringify({ is_published }) });
      toast.push(is_published ? `“${row.title}” is now on the public Events page.` : `“${row.title}” was moved back to draft and hidden from visitors.`, 'success');
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const openRoster = async (row: EventRow) => {
    setRosterBusy(true);
    try {
      const result = await api.request<{ count: number; results: Registration[] }>(`/website/events/${row.slug}/registrations/`);
      setRoster({ event: row, rows: result.results });
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setRosterBusy(false); }
  };

  const exportRoster = async () => {
    if (!roster) return;
    setRosterBusy(true);
    try {
      await downloadApiFile(
        `/website/events/${roster.event.slug}/registrations/export/`,
        `${roster.event.slug}-registrations.csv`,
      );
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setRosterBusy(false); }
  };

  const sendLinks = async () => {
    if (!roster) return;
    setRosterBusy(true);
    try {
      const result = await api.request<{ detail: string }>(
        `/website/events/${roster.event.slug}/send-link/`, { method: 'POST', body: '{}' },
      );
      toast.push(result.detail, 'success');
      await openRoster(roster.event);
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setRosterBusy(false); }
  };

  const closeRoster = () => {
    mailHalt.current = true;
    setRoster(null); setRosterDrop(null); setMail(null); setMailRun(null);
  };

  const startMail = () => {
    if (!roster) return;
    setMail({ subject: '', message: '', include_link: !!roster.event.join_ready });
    setMailRun(null);
  };

  const sendMail = async () => {
    if (!roster || !mail) return;
    const subject = mail.subject.trim();
    const message = mail.message.trim();
    const total = roster.rows.filter((row) => !row.broadcast_sent_at).length;
    if (!subject || !message) {
      setMailRun({ sent: 0, failed: 0, total, running: false, error: 'Write both a subject and a message.' });
      return;
    }
    mailHalt.current = false;
    setMailRun({ sent: 0, failed: 0, total, running: true, error: '' });
    const passes = Math.ceil(total / MAIL_BATCH);
    let sent = 0;
    let failed = 0;
    let problem = '';
    try {
      // One pass per batch, then the loop gives up rather than spinning on a
      // relay that keeps answering with the same unstamped rows.
      for (let pass = 1; pass <= passes; pass += 1) {
        if (mailHalt.current) {
          problem = 'Stopped. Everyone already emailed is marked, so sending again continues from here.';
          break;
        }
        const result = await api.request<BroadcastResult>(
          `/website/events/${roster.event.slug}/broadcast/`,
          {
            method: 'POST',
            body: JSON.stringify({ subject, message, include_link: mail.include_link, batch: MAIL_BATCH }),
          },
        );
        sent += result.sent;
        failed += result.failed;
        setMailRun({ sent, failed, total, running: !result.done, error: '' });
        if (result.done) break;
        if (!result.sent && result.failed) {
          problem = 'The mail server refused these, so the rest were left unsent. Fix the email setup, '
            + 'then send again: the addresses that already received it are not mailed twice.';
          break;
        }
        if (pass === passes) problem = 'This run reached its limit. Send again to finish the roster.';
      }
      if (problem) {
        setMailRun({ sent, failed, total, running: false, error: problem });
        toast.push(problem, 'error');
      } else {
        const note = `${sent} ${sent === 1 ? 'registrant' : 'registrants'} were emailed`
          + (failed ? `, ${failed} could not be reached` : '');
        toast.push(note, failed ? 'error' : 'success');
        setMail(null);
      }
      await openRoster(roster.event);
      resource.refresh();
    } catch (err) {
      const detail = failureMessage(err);
      setMailRun({ sent, failed, total, running: false, error: detail });
      toast.push(detail, 'error');
    } finally {
      setMailRun((current) => (current ? { ...current, running: false } : current));
    }
  };

  const dropRegistration = async () => {
    if (!roster || !rosterDrop) return;
    setRosterBusy(true);
    try {
      await api.request(`/website/events/${roster.event.slug}/registrations/${rosterDrop.id}/`, { method: 'DELETE' });
      setRoster({ ...roster, rows: roster.rows.filter((row) => row.id !== rosterDrop.id) });
      toast.push(`${rosterDrop.name} was removed and their seat is free again.`, 'success');
      setRosterDrop(null);
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setRosterBusy(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.request(`/website/events/${confirm.slug}/`, { method: 'DELETE' });
      toast.push(`“${confirm.title}” was deleted along with its registrations.`, 'success');
      if (editing?.id === confirm.id) closeForm();
      setConfirm(null);
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const submitLabel = editing ? 'Save event' : draft.is_published ? 'Create and publish' : 'Save as draft';

  // The server never mails an address this panel has already reached, so the
  // button counts only the people this click will actually send to.
  const mailPending = roster?.rows.filter((row) => !row.broadcast_sent_at).length ?? 0;

  return (
    <>
      <AdminSection
        title="Events on the website"
        description="Visitors see published events only, and register on the public Events page. Drafts stay invisible until you publish them."
        actions={<Action intent="primary" onClick={openCreate}>Plan an event</Action>}
      >
        <Toolbar label="Event list controls">
          <Field label="Show">
            <select
              className={controlClass}
              value={filter}
              onChange={(event) => { setFilter(event.target.value); setPage(1); }}
            >
              <option value="">All events</option>
              <option value="scope=upcoming">Upcoming</option>
              <option value="scope=past">Past</option>
            </select>
          </Field>
          <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
        </Toolbar>

        {resource.error && <StatusNote tone="error">{resource.error}</StatusNote>}
        {resource.error && resource.data && <p className="text-sm">Showing the last events we could load.</p>}
        {resource.loading && !resource.data && <Skeleton rows={3} />}
        {resource.data && (rows.length
          ? <AdminList label="Website events">
            {rows.map((row) => (
              <AdminRow
                key={row.id}
                thumbnail={row.image || undefined}
                placeholder="bi-calendar-event"
                title={row.title}
                badges={<>
                  <Pill tone={row.is_published ? 'live' : 'draft'}>{row.is_published ? 'Published' : 'Draft'}</Pill>
                  {row.is_featured && <Pill tone="muted">Featured</Pill>}
                  {row.is_online && <Pill tone={row.join_ready ? 'muted' : 'danger'}>
                    {row.join_ready ? (isBuiltInRoom(row.live_platform) ? 'Live Room' : 'Online') : 'Nothing to join yet'}
                  </Pill>}
                </>}
                meta={<>
                  <span>{row.event_type_label} · {whenOf(row)} · {venueOf(row)}</span>
                  <span className="block">
                    {seatsOf(row)}
                    {row.registration_url ? ' · sign-ups go to an external page' : ''}
                  </span>
                  {row.is_online && row.join_ready && isBuiltInRoom(row.live_platform) && (
                    // The room is opened from here rather than from a seat link,
                    // because the academy's own host has no registration.
                    <a
                      href={`/live/?event=${encodeURIComponent(row.slug)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block font-semibold text-navy-700 underline hover:text-navy-900"
                    >
                      Open the live room
                    </a>
                  )}
                </>}
                description={row.summary}
                actions={<>
                  {row.is_published
                    ? <Action disabled={busy} onClick={() => void setState(row, false)}>Move back to draft</Action>
                    : <Action intent="primary" disabled={busy} onClick={() => void setState(row, true)}>Publish now</Action>}
                  {!row.registration_url && <Action loading={rosterBusy} disabled={busy} onClick={() => void openRoster(row)}>Registrations</Action>}
                  <Action disabled={busy} onClick={() => openEdit(row)}>Edit</Action>
                  <Action intent="danger" disabled={busy} onClick={() => setConfirm(row)}>Delete</Action>
                </>}
              />
            ))}
          </AdminList>
          : <EmptyState
            icon="bi-calendar-plus"
            title={filter ? 'No events in this view' : 'No events yet'}
            description={filter
              ? 'Nothing matches this date filter. Switch back to All events to see the rest of the calendar.'
              : 'Plan the first event above. It stays a draft, hidden from visitors, until you publish it.'}
            action={filter
              ? <Action onClick={() => { setFilter(''); setPage(1); }}>Show all events</Action>
              : <Action intent="primary" onClick={openCreate}>Plan the first event</Action>}
          />)}
        {resource.data && <Pager
          label="Website events"
          page={page}
          count={resource.data.count}
          hasNext={!!resource.data.next}
          busy={resource.loading}
          onPrev={() => setPage((current) => Math.max(1, current - 1))}
          onNext={() => setPage((current) => current + 1)}
        />}
      </AdminSection>

      <Drawer
        open={formOpen}
        title={editing ? `Editing “${editing.title}”` : 'Plan an event'}
        description="Times use your timezone. Publish when the date, venue and sign-up details are final."
        onClose={closeForm}
        footer={<>
          <Action disabled={busy} onClick={closeForm}>Cancel</Action>
          <Action type="submit" form="event-form" intent="primary" loading={busy}>{submitLabel}</Action>
        </>}
      >
        <form id="event-form" onSubmit={(event) => void submit(event)}>
          {formError && <StatusNote tone="error">{formError}</StatusNote>}
          <Field label="Title" required error={fieldErrors.title}>
            <TextInput
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              maxLength={200}
              invalid={!!fieldErrors.title}
              required
              autoFocus
            />
          </Field>
          <FormGrid>
            <Field label="Type">
              <select className={controlClass} value={draft.event_type} onChange={(event) => set('event_type', event.target.value)}>
                {EVENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </Field>
            <Field label="Seats">
              <TextInput type="number" min="1" inputMode="numeric" value={draft.capacity} onChange={(event) => set('capacity', event.target.value)} placeholder="Unlimited" />
            </Field>
          </FormGrid>
          <FormGrid>
            <Field label="Starts" required error={fieldErrors.starts_at}>
              <TextInput type="datetime-local" value={draft.starts_at} onChange={(event) => set('starts_at', event.target.value)} invalid={!!fieldErrors.starts_at} required />
            </Field>
            <Field label="Ends" optional error={fieldErrors.ends_at}>
              <TextInput type="datetime-local" value={draft.ends_at} onChange={(event) => set('ends_at', event.target.value)} invalid={!!fieldErrors.ends_at} />
            </Field>
          </FormGrid>
          <Field label="Venue" optional hint="Ignored while the event is marked Online.">
            <TextInput value={draft.location} onChange={(event) => set('location', event.target.value)} maxLength={250} placeholder="669, Abeokuta Expressway, Lagos" />
          </Field>
          <FormGrid columns={1}>
            <Field label="One-line summary" optional>
              <TextInput value={draft.summary} onChange={(event) => set('summary', event.target.value)} maxLength={300} />
            </Field>
            <Field label="Full description" optional>
              <textarea className={controlClass} rows={5} value={draft.description} onChange={(event) => set('description', event.target.value)} />
            </Field>
          </FormGrid>
          <FileField
            label="Cover image"
            hint="A wide photo reads best. Leave this empty to keep the stored cover."
            accept="image/*"
            file={cover}
            currentUrl={editing?.image}
            onFile={setCover}
          />
          <Field label="Or a cover image URL" optional>
            <TextInput type="url" placeholder="https://…" value={draft.image_url} onChange={(event) => set('image_url', event.target.value)} />
          </Field>
          <FormGrid columns={1}>
            <CheckRow label="Online event" hint="Hides the venue and lets you choose where attendees join." checked={draft.is_online} onChange={(event) => set('is_online', event.target.checked)} />
            <CheckRow label="Feature at the top of the Events page" checked={draft.is_featured} onChange={(event) => set('is_featured', event.target.checked)} />
            <CheckRow
              label="Publish on the website"
              hint="Unpublished events are drafts. Visitors cannot see them or register."
              checked={draft.is_published}
              onChange={(event) => set('is_published', event.target.checked)}
            />
          </FormGrid>
          {draft.is_online && (
            <FormGrid columns={1}>
              <Field label="Where attendees join" hint={JOIN_HINTS[draft.live_platform]}>
                <select
                  className={controlClass}
                  value={draft.live_platform}
                  onChange={(event) => set('live_platform', event.target.value as Draft['live_platform'])}
                >
                  <option value="external">External link (Google Meet / Zoom)</option>
                  <option value="jitsi">VaceUp Live Room — Jitsi (nothing to set up)</option>
                  <option value="livekit">VaceUp Live Room — LiveKit (needs our keys)</option>
                </select>
              </Field>
              {draft.live_platform === 'external' && (
                <Field label="Joining link" optional hint="Everyone who registered is sent the same link.">
                  <TextInput type="url" value={draft.meeting_url} onChange={(event) => set('meeting_url', event.target.value)} placeholder="https://meet.google.com/…" />
                </Field>
              )}
              {isBuiltInRoom(draft.live_platform) && (
                <Field
                  label="Room name"
                  optional
                  hint={draft.live_platform === 'jitsi'
                    ? `Blank uses ${editing ? `“event-${editing.slug}”` : 'the event slug'}. Jitsi guards a room by its name alone, so a private code this event keeps is always added to it.`
                    : `Blank uses ${editing ? `“event-${editing.slug}”` : 'the event slug'} — one room per event, shared by every attendee.`}
                >
                  <TextInput value={draft.room_name} onChange={(event) => set('room_name', event.target.value)} maxLength={120} placeholder="event-open-day" />
                </Field>
              )}
            </FormGrid>
          )}
          <Field label="External sign-up link" optional hint="Leave blank to collect registrations here and read them under Registrations.">
            <TextInput type="url" value={draft.registration_url} onChange={(event) => set('registration_url', event.target.value)} placeholder="https://…" />
          </Field>
        </form>
      </Drawer>

      <Drawer
        open={!!roster}
        title={roster ? `Registrations: ${roster.event.title}` : 'Registrations'}
        description={roster ? `${roster.rows.length} ${roster.rows.length === 1 ? 'person' : 'people'}${roster.event.capacity === null ? '' : ` of ${roster.event.capacity} seats`} · ${whenOf(roster.event)}` : undefined}
        onClose={closeRoster}
        footer={roster?.rows.length ? <>
          <Action onClick={closeRoster}>Close</Action>
          <Action loading={rosterBusy} onClick={() => void exportRoster()}>Export CSV</Action>
          <Action disabled={rosterBusy || !!mailRun?.running} onClick={() => (mail ? setMail(null) : startMail())}>
            {mail ? 'Cancel mail' : 'Mail everyone'}
          </Action>
          {roster.event.is_online && !isOver(roster.event) && !mail && (
            <Action intent="primary" loading={rosterBusy} disabled={rosterBusy} onClick={() => void sendLinks()}>
              Send joining link
            </Action>
          )}
        </> : undefined}
      >
        {roster && (roster.rows.length
          ? <>
            {mail && (
              <form
                className="mb-4 space-y-3 rounded-xl border border-ink-200 p-4"
                onSubmit={(event) => { event.preventDefault(); void sendMail(); }}
              >
                <Field label="Subject" required>
                  <TextInput
                    value={mail.subject}
                    onChange={(event) => setMail({ ...mail, subject: event.target.value })}
                    maxLength={150}
                    placeholder="What the attendees need to know"
                  />
                </Field>
                <Field label="Message" required hint="Each person gets their own email, greeted by name. An empty line starts a new paragraph.">
                  <textarea
                    className={controlClass}
                    rows={5}
                    maxLength={4000}
                    value={mail.message}
                    onChange={(event) => setMail({ ...mail, message: event.target.value })}
                    placeholder="The session starts 30 minutes earlier than planned…"
                  />
                </Field>
                {roster.event.is_online && roster.event.join_ready && (
                  <CheckRow
                    label="Add each person's own joining link"
                    checked={mail.include_link}
                    onChange={(event) => setMail({ ...mail, include_link: event.target.checked })}
                  />
                )}
                {mailRun && (
                  <StatusNote tone={mailRun.error ? 'error' : 'info'}>
                    {mailRun.error
                      || `${mailRun.sent} of ${mailRun.total} emailed${mailRun.failed ? `, ${mailRun.failed} refused` : ''}.`}
                  </StatusNote>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {mailRun?.running ? (
                    <Action onClick={() => { mailHalt.current = true; }}>Stop after this batch</Action>
                  ) : mailPending === 0 ? (
                    <StatusNote tone="ok">Everyone on this list has already been mailed from here.</StatusNote>
                  ) : (
                    <Action type="submit" intent="primary" disabled={rosterBusy}>
                      {mailPending === roster.rows.length
                        ? `Send to ${mailPending} registrant${mailPending === 1 ? '' : 's'}`
                        : `Send to the ${mailPending} not yet emailed`}
                    </Action>
                  )}
                  <Action onClick={() => setMail(null)}>Discard the draft</Action>
                </div>
              </form>
            )}
            {roster.event.is_online && !roster.event.join_ready && (
              <StatusNote tone="error">
                There is nothing behind the joining link yet. Set the link, or switch the
                event to the VaceUp Live Room, before sending it.
              </StatusNote>
            )}
            <AdminList label="Event registrations">
            {roster.rows.map((row) => (
              <AdminRow
                key={row.id}
                placeholder="bi-person"
                round
                title={row.name}
                badges={<>{row.consent_marketing && <Pill tone="muted">Open to event emails</Pill>}</>}
                meta={<>
                  <a href={`mailto:${row.email}`} className="underline">{row.email}</a>
                  {row.phone ? ` · ${row.phone}` : ''} · signed up {formatWorkspaceDate(row.created_at, true)}
                  {roster.event.is_online && (
                    <span className="block">
                      {row.join_link_sent_at
                        ? `Joining link emailed ${formatWorkspaceDate(row.join_link_sent_at, true)}`
                        : 'No joining link has reached them yet'}
                    </span>
                  )}
                  {row.broadcast_sent_at && (
                    <span className="block">
                      Academy note emailed {formatWorkspaceDate(row.broadcast_sent_at, true)}
                    </span>
                  )}
                </>}
                description={row.note}
                actions={<>
                  <Action
                    intent="danger"
                    disabled={rosterBusy}
                    onClick={() => setRosterDrop(row)}
                  >
                    Remove
                  </Action>
                </>}
              />
            ))}
            </AdminList>
          </>
          : <EmptyState
            icon="bi-person-x"
            title="Nobody has registered yet"
            description="Registrations land here as soon as visitors sign up on the public Events page."
          />)}
      </Drawer>

      {roster && rosterDrop && <ConfirmDelete
        title="Remove registration"
        description={`${rosterDrop.name} (${rosterDrop.email}) will be deleted from “${roster.event.title}” and one seat will be released.`}
        error=""
        busy={rosterBusy}
        onCancel={() => setRosterDrop(null)}
        onConfirm={() => void dropRegistration()}
      />}

      {confirm && <ConfirmDelete
        title="Delete event"
        description={`“${confirm.title}” and its ${confirm.seats_taken} registration(s) will be removed permanently.`}
        confirmationName={confirm.title}
        error=""
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />}
    </>
  );
}
