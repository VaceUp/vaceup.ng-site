'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { formatWorkspaceDate, webUrl } from '@/lib/workspace-api';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action,
  AdminList,
  AdminRow,
  AdminSection,
  Drawer,
  EmptyState,
  Field,
  FormGrid,
  FormGroup,
  LinkAction,
  Pill,
  Skeleton,
  StatusNote,
  TextInput,
  Toolbar,
  adminStyles,
  controlClass,
  formClass,
  useToast,
} from './AdminUI';

/**
 * Live classes: schedule a session on a course, hand students a join link,
 * mark a session live or cancelled, and see who attended. Wired to the same
 * live-classes API students use, so a change shows up on their dashboard.
 */

interface LiveClass {
  id: number;
  course: number;
  course_title: string;
  title: string;
  description: string;
  scheduled_start: string;
  scheduled_end: string;
  duration_minutes: number;
  provider: 'external' | 'livekit';
  join_url?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  joinable: boolean;
  recording_status: string;
}

interface CourseOption {
  id: number;
  title: string;
  is_published: boolean;
}

interface AttendanceRow {
  id: number;
  student: { id: number; full_name: string; email: string };
  joined_at: string;
}

interface Draft {
  course: string;
  title: string;
  description: string;
  scheduled_start: string;
  duration_minutes: string;
  provider: 'external' | 'livekit';
  join_url: string;
  status: LiveClass['status'];
}

const STATUS: Record<LiveClass['status'], { label: string; tone: 'live' | 'draft' | 'muted' | 'danger' }> = {
  scheduled: { label: 'Scheduled', tone: 'draft' },
  live: { label: 'Live now', tone: 'live' },
  ended: { label: 'Ended', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

const emptyDraft = (): Draft => ({
  course: '',
  title: '',
  description: '',
  scheduled_start: '',
  duration_minutes: '90',
  provider: 'external',
  join_url: '',
  status: 'scheduled',
});

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isFinite(date.getTime())
    ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
    : '';
};

const draftFor = (row: LiveClass): Draft => ({
  course: String(row.course),
  title: row.title,
  description: row.description ?? '',
  scheduled_start: toLocalInput(row.scheduled_start),
  duration_minutes: String(row.duration_minutes),
  provider: row.provider,
  join_url: row.join_url ?? '',
  status: row.status,
});

const endsAt = (row: LiveClass) => {
  const start = new Date(row.scheduled_start).getTime();
  return Number.isFinite(start) ? start + row.duration_minutes * 60000 : 0;
};

const isUpcoming = (row: LiveClass, now: number) => row.status !== 'cancelled' && endsAt(row) >= now;

export function LiveClassesTab() {
  const toast = useToast();
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [coursesError, setCoursesError] = useState('');
  const [version, setVersion] = useState(0);

  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  const [editing, setEditing] = useState<LiveClass | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [attendanceOf, setAttendanceOf] = useState<LiveClass | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [attendanceState, setAttendanceState] = useState<{ loading: boolean; error: string }>({ loading: false, error: '' });

  const [deleting, setDeleting] = useState<LiveClass | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const list = (value: unknown) => (Array.isArray(value) ? value : ((value as { results?: unknown[] })?.results ?? []));
    Promise.allSettled([api.request('/live-classes/'), api.request('/admin/dashboard/courses/')])
      .then(([classResult, courseResult]) => {
        if (!active) return;
        if (classResult.status === 'fulfilled') {
          setClasses(list(classResult.value) as LiveClass[]);
          setError('');
        } else {
          setError('Live classes could not be loaded. Check your connection, then refresh.');
        }
        if (courseResult.status === 'fulfilled') {
          setCourses(list(courseResult.value) as CourseOption[]);
          setCoursesError('');
        } else {
          setCoursesError('Courses could not be loaded, so scheduling is paused until the list returns.');
        }
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [version]);

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setFormError('');
    setCreating(true);
  };

  const openEdit = (row: LiveClass) => {
    setDraft(draftFor(row));
    setEditing(row);
    setFormError('');
    setCreating(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setCreating(false);
    setEditing(null);
    setFormError('');
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    const start = new Date(draft.scheduled_start);
    if (!draft.course) { setFormError('Choose the course this class belongs to.'); return; }
    if (!draft.title.trim()) { setFormError('Give the class a title students will recognise.'); return; }
    if (!Number.isFinite(start.getTime())) { setFormError('Choose the date and time the class starts.'); return; }
    if (!editing && start.getTime() <= Date.now()) { setFormError('Choose a start time in the future for a new class.'); return; }
    const external = draft.provider === 'external';
    if (external && !/^https:\/\/\S+$/i.test(draft.join_url.trim())) {
      setFormError('Paste the full meeting link, starting with https://.');
      return;
    }
    const payload: Record<string, unknown> = {
      course: Number(draft.course),
      title: draft.title.trim(),
      description: draft.description,
      scheduled_start: start.toISOString(),
      duration_minutes: Math.min(480, Math.max(1, parseInt(draft.duration_minutes, 10) || 90)),
      provider: draft.provider,
      join_url: external ? draft.join_url.trim() : '',
      status: draft.status,
    };
    setSaving(true);
    try {
      const saved = await api.request<LiveClass>(editing ? `/live-classes/${editing.id}/` : '/live-classes/', {
        method: editing ? 'PATCH' : 'POST',
        body: JSON.stringify(payload),
      });
      toast.push(editing ? `“${saved.title}” updated. Students see the change immediately.` : `“${saved.title}” scheduled. Students see it on their dashboard.`, 'success');
      setCreating(false);
      setEditing(null);
      setDraft(emptyDraft());
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'The class could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const openAttendance = async (row: LiveClass) => {
    setAttendanceOf(row);
    setAttendance([]);
    setAttendanceState({ loading: true, error: '' });
    try {
      const rows = await api.request<AttendanceRow[]>(`/live-classes/${row.id}/attendance/`);
      setAttendance(Array.isArray(rows) ? rows : []);
      setAttendanceState({ loading: false, error: '' });
    } catch (err) {
      setAttendanceState({ loading: false, error: err instanceof Error ? err.message : 'Attendance could not be loaded.' });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await api.request(`/live-classes/${deleting.id}/`, { method: 'DELETE' });
      toast.push(`“${deleting.title}” deleted.`, 'success');
      setDeleting(null);
      setCreating(false);
      setEditing(null);
      reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'The class could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  };

  const now = Date.now();
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return classes
      .filter((row) => {
        if (scope === 'upcoming' && !isUpcoming(row, now)) return false;
        if (scope === 'past' && endsAt(row) >= now) return false;
        if (!needle) return true;
        return `${row.title} ${row.course_title}`.toLowerCase().includes(needle);
      })
      .sort((a, b) => {
        const delta = new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime();
        return scope === 'upcoming' ? delta : -delta;
      });
  }, [classes, search, scope, now]);

  const upcomingCount = classes.filter((row) => isUpcoming(row, now)).length;

  return (
    <>
      <AdminSection
        title="Live classes"
        description="Classes appear on student dashboards with join links and reminders. Mark a class live when the room is open, or cancelled if it will not hold."
        actions={<>
          <Action disabled={loading} onClick={reload}>Refresh</Action>
          <Action intent="primary" disabled={Boolean(coursesError)} onClick={openCreate}>Schedule a class</Action>
        </>}
      >
        {!loading && !error && classes.length > 0 && (
          <Toolbar label="Filter live classes">
            <Field label="Search">
              <TextInput
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by class or course"
              />
            </Field>
            <Field label="Show">
              <select className={controlClass} value={scope} onChange={(event) => setScope(event.target.value as typeof scope)}>
                <option value="upcoming">Upcoming and live ({upcomingCount})</option>
                <option value="past">Past sessions ({classes.length - upcomingCount})</option>
                <option value="all">Every class ({classes.length})</option>
              </select>
            </Field>
          </Toolbar>
        )}

        {coursesError && <StatusNote tone="error">{coursesError}</StatusNote>}
        {error && <StatusNote tone="error">{error}</StatusNote>}
        {loading && <Skeleton rows={4} />}

        {!loading && !error && classes.length === 0 && (
          <EmptyState
            icon="bi-camera-video"
            title="No live classes scheduled yet"
            description="Schedule the first session and every enrolled student gets it on their dashboard with a join link."
            action={<Action intent="primary" disabled={Boolean(coursesError)} onClick={openCreate}>Schedule a class</Action>}
          />
        )}

        {!loading && !error && classes.length > 0 && filtered.length === 0 && (
          <EmptyState
            icon="bi-search"
            title={scope === 'upcoming' ? 'Nothing scheduled ahead' : 'No classes match this view'}
            description={scope === 'upcoming'
              ? 'There are no upcoming sessions. Choose Past sessions to review what already ran, or schedule a new class.'
              : 'Clear the search or switch views to see the other sessions.'}
            action={<Action onClick={() => { setSearch(''); setScope('all'); }}>Show every class</Action>}
          />
        )}

        {filtered.length > 0 && (
          <AdminList label="Scheduled classes">
            {filtered.map((row) => {
              const state = STATUS[row.status] ?? STATUS.scheduled;
              const link = webUrl(row.join_url);
              return (
                <AdminRow
                  key={row.id}
                  placeholder={row.provider === 'livekit' ? 'bi-broadcast' : 'bi-camera-video'}
                  title={row.title}
                  badges={<>
                    <Pill tone={state.tone}>{state.label}</Pill>
                    {row.joinable && row.status !== 'live' && <Pill tone="live">Joinable</Pill>}
                    {row.recording_status === 'ready' && <Pill tone="muted">Recording ready</Pill>}
                  </>}
                  meta={`${row.course_title} · ${formatWorkspaceDate(row.scheduled_start, true)} · ${row.duration_minutes} min · ${row.provider === 'livekit' ? 'VaceUp Live Room' : 'External meeting'}`}
                  description={row.description || undefined}
                  actions={<>
                    {row.provider === 'external' && link && <LinkAction href={link} external>Open meeting</LinkAction>}
                    {row.provider === 'livekit' && (
                      <LinkAction href={`/classroom/?class=${row.id}`}>Open room</LinkAction>
                    )}
                    <Action onClick={() => void openAttendance(row)}>Attendance</Action>
                    <Action disabled={saving} onClick={() => openEdit(row)}>Edit</Action>
                  </>}
                />
              );
            })}
          </AdminList>
        )}
      </AdminSection>

      <Drawer
        open={creating}
        title={editing ? `Edit “${editing.title}”` : 'Schedule a live class'}
        description={editing
          ? 'Changes reach students the moment you save, including a moved start time.'
          : 'Pick the course, then the date and time. Every enrolled student sees it on their dashboard.'}
        onClose={closeEditor}
        footer={<>
          <Action disabled={saving} onClick={closeEditor}>Cancel</Action>
          <div className={adminStyles.actions}>
            {editing && (
              <Action intent="danger" disabled={saving} onClick={() => { setDeleteError(''); setDeleting(editing); }}>
                Delete class
              </Action>
            )}
            <Action intent="primary" type="submit" form="live-class-form" loading={saving}>
              {editing ? 'Save changes' : 'Schedule class'}
            </Action>
          </div>
        </>}
      >
        <form id="live-class-form" className={formClass} onSubmit={save}>
          {formError && <StatusNote tone="error">{formError}</StatusNote>}

          <FormGroup title="Session">
            <FormGrid>
              <Field label="Course" required hint="The class is visible to everyone enrolled in this course.">
                <select
                  className={controlClass}
                  value={draft.course}
                  onChange={(event) => setDraft({ ...draft, course: event.target.value })}
                >
                  <option value="">Choose a course</option>
                  {courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}{course.is_published ? '' : ' (Draft)'}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Class title" required>
                <TextInput
                  value={draft.title}
                  maxLength={200}
                  placeholder="Week 3 live review"
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                />
              </Field>
            </FormGrid>
            <FormGrid>
              <Field label="Starts" required hint="Shown to students in their own timezone.">
                <TextInput
                  type="datetime-local"
                  value={draft.scheduled_start}
                  onChange={(event) => setDraft({ ...draft, scheduled_start: event.target.value })}
                />
              </Field>
              <Field label="Length in minutes" required hint="Between 15 and 480 minutes.">
                <TextInput
                  type="number"
                  min={15}
                  max={480}
                  step={5}
                  value={draft.duration_minutes}
                  onChange={(event) => setDraft({ ...draft, duration_minutes: event.target.value })}
                />
              </Field>
            </FormGrid>
            <Field label="What the class covers" optional>
              <textarea
                className={controlClass}
                rows={3}
                value={draft.description}
                placeholder="Topics, prep work, or what students should bring."
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>
          </FormGroup>

          <FormGroup title="Where it happens">
            <Field label="Room" hint={draft.provider === 'livekit'
              ? 'Students join from the dashboard; there is no link to paste. The room opens automatically before the start time.'
              : 'Paste the Google Meet, Zoom or other secure meeting link.'}>
              <select
                className={controlClass}
                value={draft.provider}
                onChange={(event) => setDraft({ ...draft, provider: event.target.value as Draft['provider'] })}
              >
                <option value="external">External link (Google Meet / Zoom)</option>
                <option value="livekit">VaceUp Live Room (built in)</option>
              </select>
            </Field>
            {draft.provider === 'external' && (
              <Field label="Meeting link" required>
                <TextInput
                  type="url"
                  value={draft.join_url}
                  placeholder="https://meet.google.com/…"
                  onChange={(event) => setDraft({ ...draft, join_url: event.target.value })}
                />
              </Field>
            )}
            {editing && (
              <Field label="Session status" hint="Set to Live when the room is open. Cancelled and ended classes lose their join link.">
                <select
                  className={controlClass}
                  value={draft.status}
                  onChange={(event) => setDraft({ ...draft, status: event.target.value as Draft['status'] })}
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="live">Live now</option>
                  <option value="ended">Ended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </Field>
            )}
          </FormGroup>
        </form>
      </Drawer>

      <Drawer
        open={Boolean(attendanceOf)}
        title={attendanceOf ? `Attendance for “${attendanceOf.title}”` : 'Attendance'}
        description={attendanceOf ? `${attendanceOf.course_title} · ${formatWorkspaceDate(attendanceOf.scheduled_start, true)}` : undefined}
        onClose={() => setAttendanceOf(null)}
      >
        {attendanceState.loading && <Skeleton rows={4} />}
        {attendanceState.error && <StatusNote tone="error">{attendanceState.error}</StatusNote>}
        {!attendanceState.loading && !attendanceState.error && attendance.length === 0 && (
          <EmptyState
            icon="bi-people"
            title="No one has joined yet"
            description="Attendance is recorded when a student enters the room during the join window."
          />
        )}
        {attendance.length > 0 && (
          <AdminList label="Students who attended">
            {attendance.map((row) => (
              <AdminRow
                key={row.id}
                round
                placeholder="bi-person"
                title={row.student.full_name || row.student.email}
                meta={`${row.student.email} · joined ${formatWorkspaceDate(row.joined_at, true)}`}
              />
            ))}
          </AdminList>
        )}
      </Drawer>

      {deleting && (
        <ConfirmDelete
          title="Delete class"
          description={`“${deleting.title}” will be removed from every student dashboard. If it simply will not hold, edit it and mark it cancelled instead so students keep the history.`}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </>
  );
}

export default LiveClassesTab;
