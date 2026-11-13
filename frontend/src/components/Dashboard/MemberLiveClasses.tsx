'use client';

import { useState, type FormEvent } from 'react';
import { CalendarPlus } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, webUrl, type WorkspaceClass, type WorkspaceCourse, type WorkspacePage } from '@/lib/workspace-api';
import { WorkspaceHeading, WorkspaceEmpty, WorkspaceFeedback, WorkspaceRefresh, WorkspacePanel, WorkspaceButton, WorkspacePagination, styles } from './WorkspaceUI';
import { Action, Field, Feedback, ConfirmDelete, styles as editStyles } from './admin/AuthoringUI';
import ReplayList from '@/components/live/ReplayList';

function ScheduleClass({ onSaved }: { onSaved: () => void }) {
  const [page, setPage] = useState(1);
  const courses = useWorkspaceResource<WorkspacePage<WorkspaceCourse>>(`/dashboard/courses/?page=${page}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [provider, setProvider] = useState<'livekit' | 'external'>('livekit');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const start = new Date(String(fields.get('start')));
    const url = webUrl(String(fields.get('url')));
    if ((provider === 'external' && !url) || !Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) { setError('Enter a future start time and, for an external meeting, a secure meeting URL.'); return; }
    setBusy(true); setError('');
    try {
      await api.request('/live-classes/', { method: 'POST', body: JSON.stringify({ course: Number(fields.get('course')), title: fields.get('title'), scheduled_start: start.toISOString(), duration_minutes: Number(fields.get('duration')), provider, join_url: provider === 'external' ? url : '' }) });
      onSaved();
    } catch (failure) { setError(failure instanceof ApiError && failure.status === 400 ? failure.message : 'The class could not be confirmed. Check the class list before submitting again to avoid duplicates.'); }
    finally { setBusy(false); }
  };
  return <WorkspacePanel><h2>Schedule a live class</h2><p className={styles.muted}>Use the VaceUp classroom for shared tools and tutor recordings. Times use this device’s timezone.</p>
    <WorkspaceFeedback {...courses} hasData={!!courses.data} onRetry={courses.refresh} />
    <form className={styles.stack} onSubmit={event => void submit(event)}>{error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.field}><label htmlFor="schedule-course">Course</label><select id="schedule-course" key={page} name="course" required defaultValue=""><option value="" disabled>Select your course</option>{courses.data?.results.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></div>
      {courses.data && <WorkspacePagination page={page} count={courses.data.count} hasNext={!!courses.data.next} loading={courses.loading || busy} onPage={setPage} />}
      <label className={styles.field}>Session title<input name="title" required maxLength={200} /></label>
      <label className={styles.field}>Start date and time<input type="datetime-local" name="start" required /></label>
      <label className={styles.field}>Duration in minutes<input type="number" name="duration" min={1} max={480} defaultValue={60} required /></label>
      <label className={styles.field}>Classroom<select value={provider} onChange={event => setProvider(event.target.value as typeof provider)}><option value="livekit">VaceUp classroom (with recording)</option><option value="external">External meeting (Meet / Zoom)</option></select></label>
      {provider === 'external' && <label className={styles.field}>Meeting URL<input name="url" type="url" required placeholder="https://" /></label>}
      <WorkspaceButton primary type="submit" loading={busy} disabled={!courses.data?.results.length}>Schedule class</WorkspaceButton>
    </form></WorkspacePanel>;
}
function Attendance({ id }: { id: number }) {
  const resource = useWorkspaceResource<{ id: number; student: { full_name: string }; joined_at: string }[]>(`/live-classes/${id}/attendance/`);
  return <><WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />{resource.data && <><p className={styles.muted}>These are recorded joins, not proof of attendance duration.</p><ul className={styles.list}>{resource.data.map(item => <li key={item.id}>{item.student.full_name}<p className={styles.muted}>{formatWorkspaceDate(item.joined_at, true)}</p></li>)}</ul>{!resource.data.length && <p>No joins recorded yet.</p>}</>}</>;
}
const icsDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const icsText = (value: string) => value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
function downloadCalendar(item: WorkspaceClass) {
  const start = new Date(item.scheduled_start);
  const end = item.scheduled_end ? new Date(item.scheduled_end) : new Date(start.getTime() + item.duration_minutes * 60000);
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//VaceUp//Live classes//EN', 'BEGIN:VEVENT',
    `UID:vaceup-${item.id}@vaceup.ng`, `DTSTAMP:${icsDate(new Date())}`, `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(item.title)}`, `DESCRIPTION:${icsText(`${item.course_title}. ${item.description || 'VaceUp live class'}`)}`,
    `LOCATION:${icsText(item.join_url || 'VaceUp live class')}`, 'END:VEVENT', 'END:VCALENDAR',
  ];
  const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `VaceUp-${item.title.replace(/[^a-z0-9]+/gi, '-')}.ics`; link.click();
  URL.revokeObjectURL(url);
}
function Recording({ id }: { id: number }) {
  return <ReplayList scope={{ kind: 'class', id: String(id) }} legacyClassId={id} />;
}
function SessionEditor({ item, onSaved }: { item: WorkspaceClass; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [cancel, setCancel] = useState(false);
  const [provider, setProvider] = useState(item.provider);
  async function update(values: Record<string, unknown>) {
    setBusy(true); setError(''); setNotice('');
    try { await api.request(`/live-classes/${item.id}/`, { method: 'PATCH', body: JSON.stringify(values) }); setCancel(false); setNotice('Session updated. VaceUp classrooms include the shared room tools and tutor recording controls.'); onSaved(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Session could not be saved. Refresh and try again.'); } finally { setBusy(false); }
  }
  const localStart = new Date(new Date(item.scheduled_start).getTime() - new Date(item.scheduled_start).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  return <details className={editStyles.root}><summary>Manage this session</summary><form className={editStyles.stack} aria-label={`Manage ${item.title}`} onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); void update({ title: data.get('title'), description: data.get('description'), scheduled_start: new Date(String(data.get('start'))).toISOString(), duration_minutes: Number(data.get('duration')), provider, join_url: provider === 'external' ? data.get('url') : '' }); }}>
    <fieldset disabled={busy} className={editStyles.stack}><Field label="Session title"><input name="title" defaultValue={item.title} maxLength={200} required /></Field><Field label="Session description"><textarea name="description" defaultValue={item.description} maxLength={20000} /></Field><Field label="Session start (your timezone)"><input name="start" type="datetime-local" defaultValue={localStart} required /></Field><Field label="Session duration (minutes)"><input name="duration" type="number" min="1" max="480" defaultValue={item.duration_minutes} required /></Field>
    <Field label="Classroom"><select value={provider} onChange={event => setProvider(event.target.value as typeof provider)}><option value="livekit">VaceUp classroom (with recording)</option><option value="external">External meeting (Meet / Zoom)</option></select></Field>
    {provider === 'external' && <Field label="Meeting URL"><input name="url" type="url" defaultValue={item.join_url} required /></Field>}</fieldset>
    <Feedback error={error} message={notice} /><div className={editStyles.row}><Action type="submit" loading={busy}>Save session</Action>
      {item.status === 'scheduled' && <Action disabled={busy} onClick={() => void update({ status: 'live' })}>Mark session live</Action>}
      {item.status === 'live' && <Action disabled={busy} onClick={() => void update({ status: 'ended' })}>Mark session ended</Action>}
      {!['ended', 'cancelled'].includes(item.status) && <Action intent="danger" disabled={busy} onClick={() => setCancel(true)}>Cancel session</Action>}</div>
    <p className={editStyles.muted}>These controls update the academy schedule. They do not start, end or cancel your Meet/Zoom meeting.</p>
  </form>{cancel && <ConfirmDelete title="Cancel session" description="Learners will no longer be able to join through the academy. Cancel the meeting with your external provider separately." confirmationName={item.title} error={error} busy={busy} onCancel={() => setCancel(false)} onConfirm={() => void update({ status: 'cancelled' })} />}</details>;
}
function Session({ item, instructor, onSaved }: { item: WorkspaceClass; instructor: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const finished = ['ended', 'cancelled'].includes(item.status) || (!!item.scheduled_end && new Date(item.scheduled_end).getTime() < Date.now() && !item.joinable);
  const join = async () => {
    // The in-app room opens on its own page so the class, the staff meeting and
    // the event all use the same room screen and the same controls.
    if (item.provider === 'livekit') {
      window.location.assign(`/classroom/?class=${item.id}`);
      return;
    }
    setBusy(true); setError(''); setJoinUrl(null);
    try {
      const result = await api.request<{ provider: string; url?: string }>(`/live-classes/${item.id}/join/`, { method: 'POST' });
      const url = result.provider === 'external' ? webUrl(result.url) : null;
      if (!url) {
        setError('This session’s in-app room is not switched on yet. Ask the academy to check the live-room settings.');
        return;
      }
      setJoinUrl(url);
    } catch (failure) { setError(failure instanceof ApiError && failure.status < 500 ? failure.message : 'A usable meeting link is not available. Ask your tutor to check the meeting provider and link.'); }
    finally { setBusy(false); }
  };
  return <li className={styles.record}><div className={styles.stack}><div><h2>{item.title}</h2><p className={styles.muted}>{item.course_title}</p><span className={styles.badge}>{item.status}</span>{!instructor && item.attended && <span className={styles.badge}>Attended</span>}</div><p>{formatWorkspaceDate(item.scheduled_start, true)} / {item.duration_minutes} minutes</p>{item.description && <p className={styles.muted}>{item.description}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {showAttendance && <Attendance id={item.id} />}{instructor && <SessionEditor item={item} onSaved={onSaved} />}</div>
    <div className={styles.stack}><WorkspaceButton primary loading={busy} disabled={finished || (!instructor && !item.joinable)} onClick={() => void join()}>{instructor ? 'Open host access' : 'Join class'}</WorkspaceButton>
      {!instructor && !item.joinable && <p className={styles.muted}>{finished ? 'This session is no longer open.' : 'Joining opens near the scheduled start. Refresh to check availability.'}</p>}
      {joinUrl && !finished && <a className={styles.action} href={joinUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Enter meeting in a new tab</a>}
      {item.recording_available && <Recording id={item.id} />}
      {!item.recording_available && item.recording_status === 'processing' && <p className={styles.muted}>The recording is still processing.</p>}
      {item.status !== 'cancelled' && <WorkspaceButton onClick={() => downloadCalendar(item)}><CalendarPlus aria-hidden="true" />Add to calendar</WorkspaceButton>}
      {instructor && <WorkspaceButton aria-expanded={showAttendance} onClick={() => setShowAttendance(value => !value)}>{showAttendance ? 'Hide' : 'View'} recorded attendance</WorkspaceButton>}
    </div></li>;
}
export default function MemberLiveClasses() {
  const { user } = useAuth();
  const instructor = user?.role === 'instructor';
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('scheduled');
  const [schedule, setSchedule] = useState(false);
  const [notice, setNotice] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<WorkspaceClass>>(`/live-classes/?page=${page}&status=${status}&ordering=${status === 'ended' ? '-scheduled_start' : 'scheduled_start'}`);
  return <><WorkspaceHeading title="Live classes" description={instructor ? 'Schedule sessions for your own courses and review recorded joins.' : 'Join sessions arranged by your tutors. Times use your device timezone.'} action={<WorkspaceRefresh loading={resource.loading} onRefresh={resource.refresh} />} />
    <div className={styles.filters}><label className={styles.field}>Show sessions<select value={status} onChange={event => { setPage(1); setStatus(event.target.value); }}><option value="scheduled">Scheduled</option><option value="live">Live</option><option value="ended">Ended</option><option value="cancelled">Cancelled</option><option value="">All sessions</option></select></label>{instructor && <WorkspaceButton aria-expanded={schedule} onClick={() => setSchedule(value => !value)}>{schedule ? 'Close scheduling form' : 'Schedule a class'}</WorkspaceButton>}</div>
    {schedule && instructor && <ScheduleClass onSaved={() => { setSchedule(false); setStatus('scheduled'); setPage(1); setNotice('Class scheduled. Learners enrolled in this course can now see it.'); resource.refresh(); }} />}
    {notice && <p role="status">{notice}</p>}<WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(item => <Session key={`${status}:${item.id}`} item={item} instructor={instructor} onSaved={resource.refresh} />)}</ul> : <WorkspaceEmpty title="No sessions found">Try another status filter. New sessions appear here when your tutor schedules them.</WorkspaceEmpty>}
      <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}
