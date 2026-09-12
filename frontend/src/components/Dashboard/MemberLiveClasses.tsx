'use client';

import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, webUrl, type WorkspaceClass, type WorkspaceCourse, type WorkspacePage } from '@/lib/workspace-api';
import { WorkspaceHeading, WorkspaceEmpty, WorkspaceFeedback, WorkspaceRefresh, WorkspacePanel, WorkspaceButton, WorkspacePagination, styles } from './WorkspaceUI';

function ScheduleClass({ onSaved }: { onSaved: () => void }) {
  const [page, setPage] = useState(1);
  const courses = useWorkspaceResource<WorkspacePage<WorkspaceCourse>>(`/dashboard/courses/?page=${page}`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const start = new Date(String(fields.get('start')));
    const url = webUrl(String(fields.get('url')));
    if (!url || !Number.isFinite(start.getTime()) || start.getTime() <= Date.now()) { setError('Enter a secure meeting URL and a start time in the future.'); return; }
    setBusy(true); setError('');
    try {
      await api.request('/live-classes/', { method: 'POST', body: JSON.stringify({ course: Number(fields.get('course')), title: fields.get('title'), scheduled_start: start.toISOString(), duration_minutes: Number(fields.get('duration')), provider: 'external', join_url: url }) });
      onSaved();
    } catch (failure) { setError(failure instanceof ApiError && failure.status === 400 ? failure.message : 'The class could not be confirmed. Check the class list before submitting again to avoid duplicates.'); }
    finally { setBusy(false); }
  };
  return <WorkspacePanel><h2>Schedule a live class</h2><p className={styles.muted}>Use a meeting you have created in Meet or Zoom. The time below uses this device’s timezone.</p>
    <WorkspaceFeedback {...courses} hasData={!!courses.data} onRetry={courses.refresh} />
    <form className={styles.stack} onSubmit={event => void submit(event)}>{error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.field}><label htmlFor="schedule-course">Course</label><select id="schedule-course" key={page} name="course" required defaultValue=""><option value="" disabled>Select your course</option>{courses.data?.results.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}</select></div>
      {courses.data && <WorkspacePagination page={page} count={courses.data.count} hasNext={!!courses.data.next} loading={courses.loading || busy} onPage={setPage} />}
      <label className={styles.field}>Session title<input name="title" required maxLength={200} /></label>
      <label className={styles.field}>Start date and time<input type="datetime-local" name="start" required /></label>
      <label className={styles.field}>Duration in minutes<input type="number" name="duration" min={1} max={480} defaultValue={60} required /></label>
      <label className={styles.field}>Meeting URL<input name="url" type="url" required placeholder="https://" /></label>
      <WorkspaceButton primary type="submit" loading={busy} disabled={!courses.data?.results.length}>Schedule class</WorkspaceButton>
    </form></WorkspacePanel>;
}
function Attendance({ id }: { id: number }) {
  const resource = useWorkspaceResource<{ id: number; student: { full_name: string }; joined_at: string }[]>(`/live-classes/${id}/attendance/`);
  return <><WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />{resource.data && <><p className={styles.muted}>These are recorded joins, not proof of attendance duration.</p><ul className={styles.list}>{resource.data.map(item => <li key={item.id}>{item.student.full_name}<p className={styles.muted}>{formatWorkspaceDate(item.joined_at, true)}</p></li>)}</ul>{!resource.data.length && <p>No joins recorded yet.</p>}</>}</>;
}
function Session({ item, instructor }: { item: WorkspaceClass; instructor: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const [showAttendance, setShowAttendance] = useState(false);
  const finished = ['ended', 'cancelled'].includes(item.status) || (!!item.scheduled_end && new Date(item.scheduled_end).getTime() < Date.now() && !item.joinable);
  const join = async () => {
    setBusy(true); setError(''); setJoinUrl(null);
    try {
      const result = await api.request<{ provider: string; url?: string }>(`/live-classes/${item.id}/join/`, { method: 'POST' });
      const url = result.provider === 'external' ? webUrl(result.url) : null;
      if (!url) throw new Error('Unavailable provider');
      setJoinUrl(url);
    } catch (failure) { setError(failure instanceof ApiError && failure.status < 500 ? failure.message : 'A usable meeting link is not available. Ask your tutor to check the meeting provider and link.'); }
    finally { setBusy(false); }
  };
  return <li className={styles.record}><div className={styles.stack}><div><h2>{item.title}</h2><p className={styles.muted}>{item.course_title}</p><span className={styles.badge}>{item.status}</span></div><p>{formatWorkspaceDate(item.scheduled_start, true)} / {item.duration_minutes} minutes</p>{item.description && <p className={styles.muted}>{item.description}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {showAttendance && <Attendance id={item.id} />}</div>
    <div className={styles.stack}><WorkspaceButton primary loading={busy} disabled={finished || (!instructor && !item.joinable)} onClick={() => void join()}>{instructor ? 'Open host access' : 'Join class'}</WorkspaceButton>
      {!instructor && !item.joinable && <p className={styles.muted}>{finished ? 'This session is no longer open.' : 'Joining opens near the scheduled start. Refresh to check availability.'}</p>}
      {joinUrl && !finished && <a className={styles.action} href={joinUrl} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">Enter meeting in a new tab</a>}
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
    {resource.data && <>{resource.data.results.length ? <ul className={styles.records}>{resource.data.results.map(item => <Session key={`${status}:${item.id}`} item={item} instructor={instructor} />)}</ul> : <WorkspaceEmpty title="No sessions found">Try another status filter. New sessions appear here when your tutor schedules them.</WorkspaceEmpty>}
      <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </>;
}
