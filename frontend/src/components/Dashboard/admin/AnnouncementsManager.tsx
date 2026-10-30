'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { managementList, failureMessage } from '@/lib/course-management';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import { Action, ConfirmDelete, Field, Feedback, styles } from './AuthoringUI';
import { WorkspacePagination } from '../WorkspaceUI';

interface AnnouncementRow {
  id: number; title: string; body: string; target: string; target_courses: number[];
  target_courses_detail: { id: number; title: string }[]; priority: string; status: string;
  publish_at: string | null; expires_at: string | null; author_name: string | null;
  is_published: boolean; pin_to_top: boolean; allow_comments: boolean; send_email: boolean;
  created_at: string;
}

interface CourseOption { id: number; title: string; }

const COURSE_TARGETS = ['course_students', 'course_instructors', 'enrolled_users'];

const AUDIENCE: Record<string, string> = {
  all: 'Everyone with an account',
  students: 'Students only',
  instructors: 'Tutors only',
  admins: 'Administrators only',
  course_students: 'Students enrolled in the selected course',
  course_instructors: 'The tutor of the selected course',
  enrolled_users: 'Students and tutors enrolled in the selected course',
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
};

type Timing = 'draft' | 'scheduled' | 'now' | 'keep';

const emptyDraft = () => ({
  title: '', body: '', target: 'all', course: '', priority: 'normal',
  timing: 'draft' as Timing, publish_at: '', expires_at: '',
  pin_to_top: false, allow_comments: true, send_email: true,
});

export default function AnnouncementsManager() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<AnnouncementRow>>(`/announcements/?page=${page}&status=${status}`);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesError, setCoursesError] = useState('');
  const [draft, setDraft] = useState(emptyDraft());
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState<AnnouncementRow | null>(null);
  const needsCourse = COURSE_TARGETS.includes(draft.target);

  useEffect(() => {
    let active = true;
    managementList<CourseOption>('/admin/dashboard/courses/')
      .then(rows => { if (active) setCourses(rows); })
      .catch(err => { if (active) setCoursesError(failureMessage(err)); });
    return () => { active = false; };
  }, []);

  const audience = useMemo(() => AUDIENCE[draft.target] ?? 'Selected audience', [draft.target]);

  const reset = () => { setEditing(null); setDraft(emptyDraft()); setNotice(''); setError(''); };

  const edit = (row: AnnouncementRow) => {
    setEditing(row);
    setDraft({
      title: row.title, body: row.body, target: row.target, course: String(row.target_courses[0] ?? ''),
      priority: row.priority, timing: row.status === 'scheduled' ? 'scheduled' : 'keep',
      publish_at: toLocalInput(row.publish_at), expires_at: toLocalInput(row.expires_at),
      pin_to_top: row.pin_to_top, allow_comments: row.allow_comments, send_email: row.send_email,
    });
    setNotice(`Editing “${row.title}”. Saving keeps it as a ${row.status} until you change its state.`);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (needsCourse && !draft.course) { setError('Choose the course this announcement is for.'); return; }
    if (draft.timing === 'scheduled' && !draft.publish_at) { setError('A scheduled announcement needs a publication time.'); return; }
    if (draft.timing === 'scheduled' && new Date(draft.publish_at).getTime() <= Date.now()) { setError('Choose a publication time in the future, or publish now.'); return; }
    const effectivePublish = draft.timing === 'scheduled' ? new Date(draft.publish_at)
      : draft.timing === 'now' ? new Date() : editing?.publish_at ? new Date(editing.publish_at) : null;
    if (draft.expires_at && effectivePublish && new Date(draft.expires_at) <= effectivePublish) { setError('The expiry must be after the publication time.'); return; }
    setBusy(true); setError(''); setNotice('');
    const payload = {
      title: draft.title.trim(), body: draft.body.trim(), target: draft.target, priority: draft.priority,
      ...(draft.timing === 'keep' ? {} : { status: draft.timing === 'now' ? 'published' : draft.timing }),
      ...(needsCourse ? { target_courses: [Number(draft.course)] } : {}),
      ...(draft.timing === 'scheduled' ? { publish_at: new Date(draft.publish_at).toISOString() } : {}),
      ...(draft.expires_at ? { expires_at: new Date(draft.expires_at).toISOString() } : {}),
      pin_to_top: draft.pin_to_top, allow_comments: draft.allow_comments, send_email: draft.send_email, send_push: false,
    };
    try {
      if (editing) await api.request(`/announcements/${editing.id}/`, { method: 'PATCH', body: JSON.stringify(payload) });
      else await api.request('/announcements/', { method: 'POST', body: JSON.stringify(payload) });
      setNotice(editing
        ? 'Announcement saved.'
        : draft.timing === 'now' ? 'Announcement published. Learners in the selected audience will see it on their announcements page.'
          : draft.timing === 'scheduled' ? 'Announcement scheduled. It stays hidden until its publication time.'
            : 'Announcement saved as a draft. Publish it when you are ready.');
      reset();
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const setState = async (row: AnnouncementRow, action: 'publish' | 'unpublish') => {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api.request<{ detail?: string }>(`/announcements/${row.id}/${action}/`, { method: 'POST' });
      setNotice(result.detail || (action === 'publish' ? 'Announcement published.' : 'Announcement moved back to draft.'));
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true); setError('');
    try {
      await api.request(`/announcements/${confirm.id}/`, { method: 'DELETE' });
      setNotice(`“${confirm.title}” was deleted.`);
      if (editing?.id === confirm.id) reset();
      setConfirm(null);
      resource.refresh();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };

  return <div className={`${styles.root} ${styles.stack}`}>
    <div className={styles.heading}>
      <h2>Announcements</h2>
      <p className={styles.muted}>Announcements here are the ones learners and tutors actually see in their workspace. Nothing is delivered until you publish it.</p>
    </div>
    <Feedback error={error || coursesError || resource.error} message={notice} />

    <form className={`${styles.panel} ${styles.stack}`} onSubmit={event => void submit(event)} aria-label={editing ? 'Edit announcement' : 'New announcement'}>
      <div className={styles.row}><h3>{editing ? `Editing “${editing.title}”` : 'Write an announcement'}</h3>{editing && <Action disabled={busy} onClick={reset}>Cancel editing</Action>}</div>
      <Field label="Title"><input value={draft.title} onChange={event => setDraft({ ...draft, title: event.target.value })} maxLength={200} required /></Field>
      <Field label="Message"><textarea rows={6} value={draft.body} onChange={event => setDraft({ ...draft, body: event.target.value })} maxLength={20000} required /></Field>
      <div className={styles.grid}>
        <Field label="Audience"><select value={draft.target} onChange={event => setDraft({ ...draft, target: event.target.value })}>
          {Object.entries(AUDIENCE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></Field>
        <Field label="Importance"><select value={draft.priority} onChange={event => setDraft({ ...draft, priority: event.target.value })}>
          <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="critical">Critical</option>
        </select></Field>
      </div>
      {needsCourse && <Field label="Course"><select value={draft.course} onChange={event => setDraft({ ...draft, course: event.target.value })} required>
        <option value="">Choose a course</option>{courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
      </select></Field>}
      <div className={styles.grid}>
        <Field label="When should it go out?"><select value={draft.timing} onChange={event => setDraft({ ...draft, timing: event.target.value as Timing })}>
          {editing && <option value="keep">Keep its current state ({editing.status})</option>}
          <option value="draft">Keep as a draft</option><option value="scheduled">Schedule for a date and time</option><option value="now">Publish as soon as I save</option>
        </select></Field>
        {draft.timing === 'scheduled' && <Field label="Publication time (your timezone)"><input type="datetime-local" value={draft.publish_at} onChange={event => setDraft({ ...draft, publish_at: event.target.value })} required /></Field>}
      </div>
      <Field label="Stop showing after (optional)"><input type="datetime-local" value={draft.expires_at} onChange={event => setDraft({ ...draft, expires_at: event.target.value })} /></Field>
      <div className={styles.row}>
        <label className={styles.check}><input type="checkbox" checked={draft.pin_to_top} onChange={event => setDraft({ ...draft, pin_to_top: event.target.checked })} />Pin to the top of the list</label>
        <label className={styles.check}><input type="checkbox" checked={draft.allow_comments} onChange={event => setDraft({ ...draft, allow_comments: event.target.checked })} />Allow replies</label>
        <label className={styles.check}><input type="checkbox" checked={draft.send_email} onChange={event => setDraft({ ...draft, send_email: event.target.checked })} />Include in the email queue</label>
      </div>
      <p className={styles.muted}>Audience: {audience}. Email delivery runs from the platform mail queue once published; browser push is not configured, so nothing is sent there.</p>
      <div><Action type="submit" intent="primary" loading={busy}>{editing ? 'Save changes' : draft.timing === 'now' ? 'Create and publish' : 'Save announcement'}</Action></div>
    </form>

    <div className={`${styles.row} ${styles.between}`}>
      <Field label="Filter by state"><select value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}>
        <option value="">All announcements</option><option value="draft">Drafts</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option>
      </select></Field>
      <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
    </div>

    {resource.error && resource.data && <p className={styles.muted}>Showing the last announcements we could load.</p>}
    {resource.data && (resource.data.results.length
      ? <ul className={styles.list}>{resource.data.results.map(row => <li className={`${styles.panel} ${styles.stack}`} key={row.id}>
        <div className={`${styles.row} ${styles.between}`}><h3>{row.title}</h3><span className={styles.badge}>{row.status}</span></div>
        <p className={styles.muted}>{AUDIENCE[row.target] ?? row.target}{row.target_courses_detail.length ? ` - ${row.target_courses_detail.map(course => course.title).join(', ')}` : ''}</p>
        <p className={styles.muted}>Priority {row.priority}{row.publish_at ? ` - visible ${formatWorkspaceDate(row.publish_at, true)}` : ' - not published yet'}{row.expires_at ? ` - until ${formatWorkspaceDate(row.expires_at, true)}` : ''}. {row.author_name ? `By ${row.author_name}.` : ''}</p>
        <p className={styles.preview}>{row.body}</p>
        <div className={styles.row}>
          {row.status === 'published'
            ? <Action disabled={busy} onClick={() => void setState(row, 'unpublish')}>Move back to draft</Action>
            : <Action intent="primary" disabled={busy} onClick={() => void setState(row, 'publish')}>Publish now</Action>}
          <Action disabled={busy} onClick={() => edit(row)}>Edit</Action>
          <Action intent="danger" disabled={busy} onClick={() => setConfirm(row)}>Delete</Action>
        </div>
      </li>)}</ul>
      : <div className={styles.empty}><h3>No announcements in this state</h3><p className={styles.muted}>Write one above. Drafts and scheduled announcements stay hidden from learners until their publication time.</p></div>)}
    {resource.data && <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} />}

    {confirm && <ConfirmDelete title="Delete announcement" description={`“${confirm.title}” will be removed permanently, along with its replies and read receipts.`} confirmationName={confirm.title} error={error} busy={busy} onCancel={() => setConfirm(null)} onConfirm={() => void remove()} />}
  </div>;
}
