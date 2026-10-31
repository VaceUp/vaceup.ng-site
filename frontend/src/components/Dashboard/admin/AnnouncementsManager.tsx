'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { managementList, failureMessage } from '@/lib/course-management';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import { ConfirmDelete } from './AuthoringUI';
import {
  Action,
  AdminList,
  AdminRow,
  AdminSection,
  CheckRow,
  Drawer,
  EmptyState,
  Field,
  FormGrid,
  Pager,
  Pill,
  Skeleton,
  StatusNote,
  TextInput,
  Toolbar,
  adminStyles,
  controlClass,
  useToast,
} from './AdminUI';

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

const STATUS_TONE: Record<string, 'live' | 'draft' | 'muted'> = {
  published: 'live',
  scheduled: 'draft',
  draft: 'draft',
  archived: 'muted',
};

const STATUS_LABEL: Record<string, string> = {
  published: 'Published',
  scheduled: 'Scheduled',
  draft: 'Draft',
  archived: 'Archived',
};

const PRIORITY_LABEL: Record<string, string> = {
  low: 'Low priority',
  normal: 'Normal',
  high: 'High priority',
  critical: 'Critical',
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
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const resource = useWorkspaceResource<WorkspacePage<AnnouncementRow>>(`/announcements/?page=${page}&status=${status}`);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [coursesError, setCoursesError] = useState('');
  const [draft, setDraft] = useState(emptyDraft());
  const [editing, setEditing] = useState<AnnouncementRow | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  const rows = useMemo(() => resource.data?.results ?? [], [resource.data]);
  const set = <K extends keyof ReturnType<typeof emptyDraft>>(key: K, value: ReturnType<typeof emptyDraft>[K]) =>
    setDraft(current => ({ ...current, [key]: value }));

  const closeEditor = () => { setEditorOpen(false); setEditing(null); setError(''); };

  const openCreate = () => {
    setEditing(null);
    setDraft(emptyDraft());
    setError('');
    setEditorOpen(true);
  };

  const openEdit = (row: AnnouncementRow) => {
    setEditing(row);
    setDraft({
      title: row.title, body: row.body, target: row.target, course: String(row.target_courses[0] ?? ''),
      priority: row.priority, timing: row.status === 'scheduled' ? 'scheduled' : 'keep',
      publish_at: toLocalInput(row.publish_at), expires_at: toLocalInput(row.expires_at),
      pin_to_top: row.pin_to_top, allow_comments: row.allow_comments, send_email: row.send_email,
    });
    setError('');
    setEditorOpen(true);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (needsCourse && !draft.course) { setError('Choose the course this announcement is for.'); return; }
    if (draft.timing === 'scheduled' && !draft.publish_at) { setError('A scheduled announcement needs a publication time.'); return; }
    if (draft.timing === 'scheduled' && new Date(draft.publish_at).getTime() <= Date.now()) { setError('Choose a publication time in the future, or publish now.'); return; }
    const effectivePublish = draft.timing === 'scheduled' ? new Date(draft.publish_at)
      : draft.timing === 'now' ? new Date() : editing?.publish_at ? new Date(editing.publish_at) : null;
    if (draft.expires_at && effectivePublish && new Date(draft.expires_at) <= effectivePublish) { setError('The expiry must be after the publication time.'); return; }
    setBusy(true); setError('');
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
      toast.push(editing
        ? 'Announcement saved.'
        : draft.timing === 'now' ? 'Announcement published. Learners in the selected audience will see it on their announcements page.'
          : draft.timing === 'scheduled' ? 'Announcement scheduled. It stays hidden until its publication time.'
            : 'Announcement saved as a draft. Publish it when you are ready.', 'success');
      closeEditor();
      resource.refresh();
    } catch (err) {
      setError(failureMessage(err));
    } finally { setBusy(false); }
  };

  const setState = async (row: AnnouncementRow, action: 'publish' | 'unpublish') => {
    setBusy(true);
    try {
      const result = await api.request<{ detail?: string }>(`/announcements/${row.id}/${action}/`, { method: 'POST' });
      toast.push(result.detail || (action === 'publish' ? 'Announcement published.' : 'Announcement moved back to draft.'), 'success');
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await api.request(`/announcements/${confirm.id}/`, { method: 'DELETE' });
      toast.push(`“${confirm.title}” was deleted.`, 'success');
      if (editing?.id === confirm.id) closeEditor();
      setConfirm(null);
      resource.refresh();
    } catch (err) { toast.push(failureMessage(err), 'error'); } finally { setBusy(false); }
  };

  const courseTitles = (row: AnnouncementRow) => row.target_courses_detail.map(course => course.title).join(', ');

  return (
    <>
      <AdminSection
        title="Announcements"
        description="Announcements here are the ones learners and tutors actually see in their workspace. Nothing is delivered until you publish it."
        actions={<Action intent="primary" onClick={openCreate}>Write an announcement</Action>}
      >
        <Toolbar label="Announcement list controls">
          <Field label="Show">
            <select className={controlClass} value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All announcements</option>
              <option value="draft">Drafts</option>
              <option value="scheduled">Scheduled</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Action loading={resource.loading} onClick={resource.refresh}>Refresh list</Action>
        </Toolbar>

        {(resource.error || coursesError) && (
          <StatusNote tone="error">
            {resource.error || coursesError}
            {resource.error && <span className={adminStyles.inlineActions}><Action onClick={resource.refresh}>Retry</Action></span>}
          </StatusNote>
        )}
        {resource.error && resource.data && <p className="text-sm">Showing the last announcements we could load.</p>}
        {resource.loading && !resource.data && <Skeleton rows={3} />}

        {resource.data && (rows.length
          ? <AdminList label="Announcements">
            {rows.map((row) => (
              <AdminRow
                key={row.id}
                placeholder="bi-megaphone"
                title={row.title}
                badges={<>
                  <Pill tone={STATUS_TONE[row.status] ?? 'muted'}>{STATUS_LABEL[row.status] ?? row.status}</Pill>
                  {row.pin_to_top && <Pill tone="muted">Pinned</Pill>}
                  {row.priority !== 'normal' && (
                    <Pill tone={row.priority === 'critical' ? 'danger' : row.priority === 'high' ? 'draft' : 'muted'}>
                      {PRIORITY_LABEL[row.priority] ?? row.priority}
                    </Pill>
                  )}
                </>}
                meta={<>
                  <span>{AUDIENCE[row.target] ?? row.target}{courseTitles(row) ? ` — ${courseTitles(row)}` : ''}</span>
                  <span className="block">
                    {row.publish_at ? `Visible ${formatWorkspaceDate(row.publish_at, true)}` : 'Not published yet'}
                    {row.expires_at ? ` · until ${formatWorkspaceDate(row.expires_at, true)}` : ''}
                    {row.author_name ? ` · by ${row.author_name}` : ''}
                  </span>
                </>}
                description={row.body}
                actions={<>
                  {row.status === 'published'
                    ? <Action disabled={busy} onClick={() => void setState(row, 'unpublish')}>Move back to draft</Action>
                    : <Action intent="primary" disabled={busy} onClick={() => void setState(row, 'publish')}>Publish now</Action>}
                  <Action disabled={busy} onClick={() => openEdit(row)}>Edit</Action>
                  <Action intent="danger" disabled={busy} onClick={() => setConfirm(row)}>Delete</Action>
                </>}
              />
            ))}
          </AdminList>
          : <EmptyState
            icon="bi-megaphone"
            title={status ? 'No announcements in this state' : 'No announcements yet'}
            description={status
              ? 'Nothing matches this filter. Switch back to all announcements to see the rest.'
              : 'Write the first one. Drafts and scheduled announcements stay hidden from learners until their publication time.'}
            action={status
              ? <Action onClick={() => { setStatus(''); setPage(1); }}>Show all announcements</Action>
              : <Action intent="primary" onClick={openCreate}>Write the first announcement</Action>}
          />)}
        {resource.data && <Pager
          label="Announcements"
          page={page}
          count={resource.data.count}
          hasNext={!!resource.data.next}
          busy={resource.loading}
          onPrev={() => setPage(current => Math.max(1, current - 1))}
          onNext={() => setPage(current => current + 1)}
        />}
      </AdminSection>

      <Drawer
        open={editorOpen}
        title={editing ? `Editing “${editing.title}”` : 'Write an announcement'}
        description="Draft, schedule or publish. Learners and tutors see it in their workspace only once it is live."
        onClose={() => { if (!busy) closeEditor(); }}
        footer={<>
          <Action disabled={busy} onClick={closeEditor}>Cancel</Action>
          <Action
            type="submit"
            form="announcement-form"
            intent="primary"
            loading={busy}
          >
            {editing ? 'Save changes' : draft.timing === 'now' ? 'Create and publish' : 'Save announcement'}
          </Action>
        </>}
      >
        <form id="announcement-form" onSubmit={(event) => void submit(event)}>
          {error && <StatusNote tone="error">{error}</StatusNote>}
          {editing && (
            <StatusNote tone="info">
              Saving keeps it as a {editing.status} until you choose a different timing.
            </StatusNote>
          )}
          <Field label="Title" required>
            <TextInput
              value={draft.title}
              onChange={(event) => set('title', event.target.value)}
              maxLength={200}
              required
              autoFocus
            />
          </Field>
          <Field label="Message" required>
            <textarea
              className={controlClass}
              rows={6}
              value={draft.body}
              onChange={(event) => set('body', event.target.value)}
              maxLength={20000}
              required
            />
          </Field>
          <FormGrid>
            <Field label="Audience">
              <select className={controlClass} value={draft.target} onChange={(event) => set('target', event.target.value)}>
                {Object.entries(AUDIENCE).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="Importance">
              <select className={controlClass} value={draft.priority} onChange={(event) => set('priority', event.target.value)}>
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
          </FormGrid>
          {needsCourse && (
            <Field label="Course" required>
              <select className={controlClass} value={draft.course} onChange={(event) => set('course', event.target.value)} required>
                <option value="">Choose a course</option>
                {courses.map(course => <option key={course.id} value={course.id}>{course.title}</option>)}
              </select>
            </Field>
          )}
          <FormGrid>
            <Field label="When should it go out?">
              <select className={controlClass} value={draft.timing} onChange={(event) => set('timing', event.target.value as Timing)}>
                {editing && <option value="keep">Keep its current state ({editing.status})</option>}
                <option value="draft">Keep as a draft</option>
                <option value="scheduled">Schedule for a date and time</option>
                <option value="now">Publish as soon as I save</option>
              </select>
            </Field>
            {draft.timing === 'scheduled' && (
              <Field label="Publication time" required hint="Your timezone.">
                <TextInput type="datetime-local" value={draft.publish_at} onChange={(event) => set('publish_at', event.target.value)} required />
              </Field>
            )}
          </FormGrid>
          <Field label="Stop showing after" optional hint="The announcement hides itself when this passes.">
            <TextInput type="datetime-local" value={draft.expires_at} onChange={(event) => set('expires_at', event.target.value)} />
          </Field>
          <FormGrid columns={1}>
            <CheckRow label="Pin to the top of the list" checked={draft.pin_to_top} onChange={(event) => set('pin_to_top', event.target.checked)} />
            <CheckRow label="Allow replies" checked={draft.allow_comments} onChange={(event) => set('allow_comments', event.target.checked)} />
            <CheckRow
              label="Include in the email queue"
              hint="Email goes out through the platform mail queue once the announcement is published."
              checked={draft.send_email}
              onChange={(event) => set('send_email', event.target.checked)}
            />
          </FormGrid>
          <p className={adminStyles.hint}>
            Audience: {audience}. Browser push is not configured, so nothing is sent there.
          </p>
        </form>
      </Drawer>

      {confirm && <ConfirmDelete
        title="Delete announcement"
        description={`“${confirm.title}” will be removed permanently, along with its replies and read receipts.`}
        confirmationName={confirm.title}
        error=""
        busy={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void remove()}
      />}
    </>
  );
}
