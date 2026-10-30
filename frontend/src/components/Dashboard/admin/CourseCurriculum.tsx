'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { managedCourses, managementList, failureMessage, type ManagedCourse, type ManagedModule } from '@/lib/course-management';
import { Action, Field, Feedback, ConfirmDelete, styles } from './AuthoringUI';
import LessonForm from './LessonForm';

function ModuleEditor({ module, onSaved }: { module: ManagedModule; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    title: module.title, order: module.order, week: module.week,
    duration_minutes: module.duration_minutes, meeting_url: module.meeting_url || '',
  });
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form className={styles.stack} aria-label={`Edit module ${module.title}`} onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.request(`/modules/${module.id}/`, { method: 'PATCH', body: JSON.stringify(form) }); await onSaved(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }}><div className={styles.grid}>
    <Field label="Module title"><input required maxLength={200} disabled={busy} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
    <Field label="Course week"><input required type="number" min="1" disabled={busy} value={form.week} onChange={(event) => setForm({ ...form, week: Number(event.target.value) })} /></Field>
    <Field label="Planned contact time (minutes)"><input type="number" min="0" disabled={busy} value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: Number(event.target.value) })} /></Field>
    <Field label="Module order (starts at 0)"><input required type="number" min="0" disabled={busy} value={form.order} onChange={(event) => setForm({ ...form, order: Number(event.target.value) })} /></Field>
    <Field label="Google Meet link for live sessions"><input type="url" disabled={busy} placeholder="https://meet.google.com/abc-defg-hij" value={form.meeting_url} onChange={(event) => setForm({ ...form, meeting_url: event.target.value })} /></Field>
  </div>
  <p className={styles.muted}>Enrolled learners only see this link when the module has one. Leave it blank for self-paced teaching.</p>
  <Feedback error={error} /><div><Action type="submit" loading={busy}>Save module</Action></div>
  </form>;
}
export function CourseCurriculum({ fixedCourse }: { fixedCourse?: ManagedCourse } = {}) {
  const [courses, setCourses] = useState<ManagedCourse[]>([]), [courseId, setCourseId] = useState(String(fixedCourse?.id || ''));
  const [modules, setModules] = useState<ManagedModule[]>([]);
  const [draft, setDraft] = useState({ title: '', week: '', duration_minutes: 0, meeting_url: '' });
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [deleting, setDeleting] = useState<{ endpoint: string; title: string; name: string } | null>(null), [deleteError, setDeleteError] = useState('');
  const requestVersion = useRef(0);
  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!courseId) return; setLoading(true); setError('');
    try { const rows = await managementList<ManagedModule>(`/modules/?course=${encodeURIComponent(courseId)}`); if (version === requestVersion.current) setModules(rows); }
    catch (err) { if (version === requestVersion.current) setError(failureMessage(err)); } finally { if (version === requestVersion.current) setLoading(false); }
  }, [courseId]);
  useEffect(() => { if (!fixedCourse) managedCourses().then(setCourses).catch((err) => setError(failureMessage(err))); }, [fixedCourse]);
  useEffect(() => { setModules([]); setMessage(''); void load(); }, [load]);
  const suggestedWeek = modules.reduce((max, module) => Math.max(max, module.week), 0) + 1;
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Course content manager">
    <header className={styles.stack}><h3>Modules and lessons</h3><p className={styles.muted}>Add teaching content here: lesson text, private videos and free previews. Give each module its course week, planned contact time and Google Meet link so learners see the live schedule. These lessons drive student progress; the public outline above is only a syllabus.</p>
      {!fixedCourse && <Field label="Course to manage"><select value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course, including drafts</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.is_published ? 'Published' : 'Draft'})</option>)}</select></Field>}
      {courseId && <div><Action loading={loading} onClick={() => void load()}>Refresh content</Action></div>}
    </header>
    <Feedback error={error} message={message} />
    {courseId && <>
      <form className={styles.stack} onSubmit={async (event) => { event.preventDefault(); if (busy) return; setBusy(true); setError('');
        try {
          await api.request('/modules/', { method: 'POST', body: JSON.stringify({
            course: Number(courseId), title: draft.title.trim(),
            week: draft.week ? Number(draft.week) : suggestedWeek,
            duration_minutes: draft.duration_minutes || 0,
            meeting_url: draft.meeting_url.trim(),
          }) });
          setDraft({ title: '', week: '', duration_minutes: 0, meeting_url: '' });
          setMessage('Module added.'); await load();
        }
        catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
      }}>
        <div className={styles.grid}>
          <Field label="New module title"><input required maxLength={200} value={draft.title} disabled={busy} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Field>
          <Field label="Course week"><input type="number" min="1" placeholder={`${suggestedWeek}`} value={draft.week} disabled={busy} onChange={(event) => setDraft({ ...draft, week: event.target.value })} /></Field>
          <Field label="Planned contact time (minutes)"><input type="number" min="0" value={draft.duration_minutes} disabled={busy} onChange={(event) => setDraft({ ...draft, duration_minutes: Number(event.target.value) })} /></Field>
        </div>
        <Field label="Google Meet link for live sessions"><input type="url" placeholder="https://meet.google.com/abc-defg-hij" value={draft.meeting_url} disabled={busy} onChange={(event) => setDraft({ ...draft, meeting_url: event.target.value })} /></Field>
        <div><Action type="submit" intent="primary" loading={busy}>Add module</Action></div>
      </form>
      {loading && <p role="status">Loading course content...</p>}
      {!loading && !error && !modules.length && <p className={styles.muted}>No modules in this course yet. Add the first one above.</p>}
      {modules.map((module) => <article key={module.id} className={`${styles.panel} ${styles.stack}`} aria-label={`Module ${module.title}`}>
        <div className={`${styles.row} ${styles.between}`}>
          <div>
            <h3>Week {module.week} - {module.title}</h3>
            <p className={styles.muted}>
              {module.order + 1} in sequence - {module.duration_minutes ? `${module.duration_minutes} minutes planned` : 'contact time not set'} - {module.meeting_url ? 'Google Meet link set' : 'no live session link'}
            </p>
          </div>
          <Action intent="danger" onClick={() => { setDeleteError(''); setDeleting({ endpoint: `/modules/${module.id}/`, title: 'Delete module', name: module.title }); }}>Delete module</Action>
        </div>
        <details><summary>Edit module details</summary><ModuleEditor key={`${module.id}:${module.title}:${module.order}`} module={module} onSaved={load} /></details>
        <ul className={styles.list}>{module.lessons.map((lesson) => <li key={lesson.id}><details><summary>{lesson.order + 1}. {lesson.title}{lesson.is_preview ? ' (Free preview)' : ''}</summary>
          <div className={styles.stack}><LessonForm lesson={lesson} moduleId={module.id} onSaved={load} /><div><Action intent="danger" onClick={() => { setDeleteError(''); setDeleting({ endpoint: `/lessons/${lesson.id}/`, title: 'Delete lesson', name: lesson.title }); }}>Delete lesson</Action></div></div>
        </details></li>)}</ul>
        <details><summary>Add a lesson to {module.title}</summary><LessonForm moduleId={module.id} onSaved={load} /></details>
      </article>)}
    </>}
    {deleting && <ConfirmDelete title={deleting.title} confirmationName={deleting.name} description={`Permanently delete ${deleting.name}? This also removes its dependent lesson/progress records. Uploaded storage objects are retained. This cannot be undone.`} busy={busy} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={async () => {
      if (busy) return; setBusy(true); setDeleteError('');
      try { await api.request(deleting.endpoint, { method: 'DELETE' }); setDeleting(null); setMessage('Content deleted.'); await load(); }
      catch (err) { setDeleteError(failureMessage(err)); } finally { setBusy(false); }
    }} />}
  </section>;
}
export default CourseCurriculum;
