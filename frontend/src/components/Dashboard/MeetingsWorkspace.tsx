'use client';

import { useState, type FormEvent } from 'react';
import { Video } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import type { PaginatedResponse } from '@/lib/api';
import {
  bookMeeting, cancelMeeting, changeMeeting, endMeeting,
  type Meeting, type MeetingBooking, type MeetingPerson, type MeetingWriteResult,
} from '@/lib/meetings-api';
import {
  WorkspaceButton, WorkspaceEmpty, WorkspaceFeedback, WorkspaceHeading,
  WorkspaceLink, WorkspacePagination, WorkspacePanel, WorkspaceRefresh, styles,
} from './WorkspaceUI';
import { Action, Field, Feedback, styles as editStyles } from './admin/AuthoringUI';

const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** The time a colleague can actually walk in: the room opens 15 minutes before. */
const windowLine = (item: Meeting) =>
  `${formatWorkspaceDate(item.starts_at, true)} to ${formatWorkspaceDate(item.ends_at, true)}`;

function ColleaguePicker({ people, selected, onChange, disabled }: {
  people: MeetingPerson[];
  selected: number[];
  onChange: (ids: number[]) => void;
  disabled: boolean;
}) {
  const toggle = (id: number) =>
    onChange(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  if (!people.length) {
    return <p className={styles.muted}>There is no other staff account to invite yet. Ask the academy to create one under Users.</p>;
  }
  return <fieldset className={editStyles.stack} disabled={disabled} aria-label="Colleagues to invite">
    <legend className={styles.muted}>Who is in the room ({selected.length} chosen)</legend>
    <div className={editStyles.picker}>
      {people.map((person) => <label key={person.id} className={editStyles.check}>
        <input type="checkbox" checked={selected.includes(person.id)} onChange={() => toggle(person.id)} />
        <span>{person.full_name || 'A colleague'}</span>
        <span className={styles.badge}>{person.role === 'admin' ? 'Administrator' : 'Tutor'}</span>
      </label>)}
    </div>
  </fieldset>;
}

function BookMeeting({ onBooked }: { onBooked: (notice: string) => void }) {
  const colleagues = useWorkspaceResource<MeetingPerson[]>('/meetings/colleagues/');
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [duration, setDuration] = useState('30');
  const [invitees, setInvitees] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const starts = new Date(startsAt);
    if (!Number.isFinite(starts.getTime())) {
      setError('Pick the day and time the meeting starts.');
      return;
    }
    if (starts.getTime() < Date.now() - 60000) {
      setError('That time has already passed. Meetings are booked for the future.');
      return;
    }
    const body: MeetingBooking = {
      title: title.trim(),
      agenda: agenda.trim(),
      starts_at: starts.toISOString(),
      duration_minutes: Number(duration),
      invitees,
    };
    setBusy(true);
    setError('');
    try {
      const result = await bookMeeting(body);
      onBooked(mailReport(result, 'Booked.'));
    } catch (failure) {
      setError(failure instanceof Error && failure.message
        ? failure.message
        : 'The meeting could not be booked. Check the details and try again.');
    } finally {
      setBusy(false);
    }
  };

  return <WorkspacePanel>
    <h2>Book a staff meeting</h2>
    <p className={styles.muted}>
      Everyone you choose gets an email and a meeting in their own dashboard. Nobody
      needs an outside link, and the room address is never sent to anyone.
    </p>
    <WorkspaceFeedback {...colleagues} hasData={!!colleagues.data} onRetry={colleagues.refresh} />
    <form className={styles.stack} onSubmit={(event) => void submit(event)}>
      <Field label="What is the meeting called"><input value={title} maxLength={150}
        onChange={(event) => setTitle(event.target.value)} placeholder="Weekly tutor check-in" required /></Field>
      <Field label="What you want to cover (optional)"><textarea value={agenda} maxLength={2000} rows={3}
        onChange={(event) => setAgenda(event.target.value)}
        placeholder="How the Virtual Assistant cohort is going." /></Field>
      <div className={editStyles.grid}>
        <Field label="Starts (your timezone)"><input type="datetime-local" value={startsAt}
          onChange={(event) => setStartsAt(event.target.value)} required /></Field>
        <Field label="How long, in minutes"><input type="number" min={5} max={480} step={5} value={duration}
          onChange={(event) => setDuration(event.target.value)} required /></Field>
      </div>
      {colleagues.data && <ColleaguePicker people={colleagues.data} selected={invitees}
        onChange={setInvitees} disabled={busy} />}
      {colleagues.data && !invitees.length && <p className={styles.muted}>
        Choose at least one colleague. The booking and the invitations go out together.
      </p>}
      <Feedback error={error} />
      <Action type="submit" intent="primary" loading={busy} disabled={!colleagues.data || !invitees.length}>
        Book it and mail the invitations
      </Action>
    </form>
  </WorkspacePanel>;
}

/** What the mail relay actually accepted, said plainly. */
function mailReport(result: MeetingWriteResult, opening: string): string {
  const parts = [opening];
  if (result.invited?.length) parts.push(`Mailed: ${result.invited.join(', ')}.`);
  if (result.invitation_email_failed?.length) {
    parts.push(
      `Could not mail: ${result.invitation_email_failed.join(', ')} — they still see the meeting in their dashboard.`,
    );
  }
  return parts.join(' ');
}

function MeetingEditor({ item, onSaved }: { item: Meeting; onSaved: (notice: string) => void }) {
  const colleagues = useWorkspaceResource<MeetingPerson[]>('/meetings/colleagues/');
  const [title, setTitle] = useState(item.title);
  const [agenda, setAgenda] = useState(item.agenda);
  const [startsAt, setStartsAt] = useState(localInput(new Date(item.starts_at)));
  const [duration, setDuration] = useState(String(item.duration_minutes));
  const [invitees, setInvitees] = useState<number[]>(item.participants.map((row) => row.person.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const starts = new Date(startsAt);
    if (!Number.isFinite(starts.getTime())) { setError('Pick the day and time the meeting starts.'); return; }
    setBusy(true);
    setError('');
    try {
      const result = await changeMeeting(item.id, {
        title: title.trim(),
        agenda: agenda.trim(),
        starts_at: starts.toISOString(),
        duration_minutes: Number(duration),
        invitees,
      });
      onSaved(mailReport(result, 'Saved.'));
    } catch (failure) {
      setError(failure instanceof Error && failure.message
        ? failure.message
        : 'The change could not be saved. Refresh and try again.');
    } finally {
      setBusy(false);
    }
  };

  // Anyone already invited stays on the list even if their account changed
  // since, so saving cannot quietly drop them out of a meeting they are in.
  const pickerPeople = (): MeetingPerson[] => {
    const known = colleagues.data ?? [];
    return [...known, ...item.participants
      .map((row) => row.person)
      .filter((person) => !known.some((found) => found.id === person.id))];
  };

  return <details className={editStyles.root}>
    <summary>Change the details or the people invited</summary>
    <WorkspaceFeedback {...colleagues} hasData={!!colleagues.data} onRetry={colleagues.refresh} />
    <form className={editStyles.stack} onSubmit={(event) => void save(event)} aria-label={`Manage ${item.title}`}>
      <fieldset disabled={busy} className={editStyles.stack}>
        <Field label="What the meeting is called"><input value={title} maxLength={150}
          onChange={(event) => setTitle(event.target.value)} required /></Field>
        <Field label="What you want to cover"><textarea value={agenda} maxLength={2000} rows={3}
          onChange={(event) => setAgenda(event.target.value)} /></Field>
        <div className={editStyles.grid}>
          <Field label="Starts (your timezone)"><input type="datetime-local" value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)} required /></Field>
          <Field label="How long, in minutes"><input type="number" min={5} max={480} step={5} value={duration}
            onChange={(event) => setDuration(event.target.value)} required /></Field>
        </div>
        {colleagues.data && <ColleaguePicker people={pickerPeople()}
          selected={invitees} onChange={setInvitees} disabled={busy} />}
      </fieldset>
      <Feedback error={error} />
      <Action type="submit" loading={busy}>Save changes</Action>
    </form>
  </details>;
}

function MeetingRow({ item, onSaved }: { item: Meeting; onSaved: (notice: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const host = item.my_role === 'host';
  const closed = item.status !== 'scheduled';

  const close = async (kind: 'end' | 'cancel') => {
    setBusy(true);
    setError('');
    try {
      const result = kind === 'end' ? await endMeeting(item.id) : await cancelMeeting(item.id);
      if (kind === 'cancel') {
        const missed = result.cancellation_email_failed?.length
          ? ` Could not mail: ${result.cancellation_email_failed.join(', ')}.`
          : '';
        onSaved(`Called off. Everyone invited was emailed.${missed}`);
      } else {
        onSaved('The meeting is closed and nobody can walk back in.');
      }
    } catch (failure) {
      setError(failure instanceof Error && failure.message
        ? failure.message
        : 'The meeting could not be closed. Refresh the list before trying again.');
    } finally {
      setBusy(false);
    }
  };

  return <li className={styles.record}>
    <div className={styles.stack}>
      <div>
        <h2>{item.title}</h2>
        <p className={styles.muted}>
          Booked by {item.host.full_name || 'a colleague'}
          {host ? ' (you)' : ''} · {item.duration_minutes} minutes
        </p>
        <span className={styles.badge}>{item.status === 'scheduled' && item.is_open ? 'Open now' : item.status}</span>
      </div>
      <p>{windowLine(item)}</p>
      {item.agenda && <p className={styles.muted}>{item.agenda}</p>}
      {!closed && !item.can_enter && <p className={styles.muted}>{item.entry_reason}</p>}

      <ul className={styles.list} aria-label="Who was invited">
        {item.participants.map((row) => <li key={row.person.id}>
          <p>{row.person.full_name || 'A colleague'}</p>
          <p className={styles.muted}>
            {row.opened_room
              ? `Walked in ${formatWorkspaceDate(row.joined_at, true)}`
              : row.invited_at
                ? 'Invited, not in yet'
                : 'In the meeting, but the invitation email did not go out'}
          </p>
        </li>)}
        {!item.participants.length && <li><p className={styles.muted}>Nobody is on the list.</p></li>}
      </ul>

      {error && <p role="alert" className={styles.error}>{error}</p>}
      {host && !closed && <MeetingEditor item={item} onSaved={onSaved} />}
    </div>

    <div className={styles.stack}>
      {!closed && (
        <WorkspaceLink primary href={`/meeting/?meeting=${item.id}`}>
          <Video aria-hidden="true" />{item.can_enter ? 'Open the room' : 'Open the meeting page'}
        </WorkspaceLink>
      )}
      {host && !closed && <>
        <WorkspaceButton loading={busy} onClick={() => void close('end')}>End the meeting</WorkspaceButton>
        <Action intent="danger" disabled={busy} onClick={() => void close('cancel')}>Call it off</Action>
        <p className={styles.muted}>Calling it off emails everyone invited. Ending it just closes the door.</p>
      </>}
    </div>
  </li>;
}

export function MeetingsWorkspace() {
  const { user } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'instructor';
  const [page, setPage] = useState(1);
  const [booking, setBooking] = useState(false);
  const [notice, setNotice] = useState('');
  const readiness = useWorkspaceResource<{ ready: boolean; detail: string }>(staff ? '/meetings/readiness/' : null);
  const meetings = useWorkspaceResource<PaginatedResponse<Meeting>>(staff ? `/meetings/?page=${page}` : null);

  if (!staff) {
    return <>
      <WorkspaceHeading title="Staff meetings" description="Meetings are for the academy's own people." />
      <WorkspacePanel><p>Staff meetings connect an administrator with the tutors. Learners join
        their live classes from My courses instead.</p></WorkspacePanel>
    </>;
  }

  return <>
    <WorkspaceHeading title="Staff meetings"
      description="Call a tutor into the platform instead of sending an outside link. Times below use this device's timezone."
      action={<WorkspaceRefresh loading={meetings.loading} onRefresh={meetings.refresh} />} />

    {readiness.data && !readiness.data.ready && <WorkspacePanel>
      <p role="alert" className={styles.error}>{readiness.data.detail}</p>
      <p className={styles.muted}>Bookings still work: your colleague sees the meeting in their
        dashboard and the invitation goes out by email as soon as the room is switched on.</p>
    </WorkspacePanel>}

    <div className={styles.row}>
      <WorkspaceButton aria-expanded={booking} onClick={() => setBooking((value) => !value)}>
        {booking ? 'Close the booking form' : 'Book a meeting'}
      </WorkspaceButton>
    </div>

    {booking && <BookMeeting onBooked={(message) => {
      setBooking(false);
      setPage(1);
      setNotice(message);
      meetings.refresh();
    }} />}

    <Feedback message={notice} />
    <WorkspaceFeedback {...meetings} hasData={!!meetings.data} onRetry={meetings.refresh} />
    {meetings.data && <>
      {meetings.data.results.length
        ? <ul className={styles.records}>
          {meetings.data.results.map((item) => <MeetingRow key={item.id} item={item}
            onSaved={(message) => { setNotice(message); meetings.refresh(); }} />)}
        </ul>
        : <WorkspaceEmpty title="No meetings yet">
          Book a call with a tutor above. The invitation lands in their email and in their own
          dashboard, and the room opens from either.
        </WorkspaceEmpty>}
      <WorkspacePagination page={page} count={meetings.data.count} hasNext={!!meetings.data.next}
        loading={meetings.loading} onPage={setPage} />
    </>}
  </>;
}

export default MeetingsWorkspace;
