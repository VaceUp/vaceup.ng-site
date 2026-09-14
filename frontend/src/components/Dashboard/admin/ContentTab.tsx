'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { managedCourses, managementList, failureMessage, type ManagedCourse, type ManagedModule } from '@/lib/course-management';
import { Action, Field, Feedback, ConfirmDelete, styles } from './AuthoringUI';
import LessonForm from './LessonForm';

function ModuleEditor({ module, onSaved }: { module: ManagedModule; onSaved: () => Promise<void> }) {
  const [title, setTitle] = useState(module.title), [order, setOrder] = useState(module.order);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <form className={styles.stack} aria-label={`Edit module ${module.title}`} onSubmit={async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try { await api.request(`/modules/${module.id}/`, { method: 'PATCH', body: JSON.stringify({ title, order }) }); await onSaved(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }}><div className={styles.grid}><Field label="Module title"><input required maxLength={200} disabled={busy} value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
    <Field label="Module order (starts at 0)"><input required type="number" min="0" disabled={busy} value={order} onChange={(event) => setOrder(Number(event.target.value))} /></Field></div>
    <Feedback error={error} /><div><Action type="submit" loading={busy}>Save module</Action></div>
  </form>;
}
export function ContentTab({ fixedCourse }: { fixedCourse?: ManagedCourse } = {}) {
  const [courses, setCourses] = useState<ManagedCourse[]>([]), [courseId, setCourseId] = useState(String(fixedCourse?.id || ''));
  const [modules, setModules] = useState<ManagedModule[]>([]), [title, setTitle] = useState('');
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
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Course content manager">
    <header className={styles.stack}><h3>Course Content Manager</h3><p className={styles.muted}>Add modules and lessons, edit their text and order, attach private videos, and choose free previews. New items are appended automatically.</p>
      {!fixedCourse && <Field label="Course to manage"><select value={courseId} onChange={(event) => setCourseId(event.target.value)}><option value="">Select a course, including drafts</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.title} ({course.is_published ? 'Published' : 'Draft'})</option>)}</select></Field>}
      {courseId && <div><Action loading={loading} onClick={() => void load()}>Refresh content</Action></div>}
    </header>
    <Feedback error={error} message={message} />
    {courseId && <>
      <form className={styles.row} onSubmit={async (event) => { event.preventDefault(); if (busy) return; setBusy(true); setError('');
        try { await api.request('/modules/', { method: 'POST', body: JSON.stringify({ course: Number(courseId), title }) }); setTitle(''); setMessage('Module added.'); await load(); }
        catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
      }}><Field label="New module title"><input required maxLength={200} value={title} disabled={busy} onChange={(event) => setTitle(event.target.value)} /></Field><Action type="submit" intent="primary" loading={busy}>Add module</Action></form>
      {loading && <p role="status">Loading course content...</p>}
      {!loading && !error && !modules.length && <p className={styles.muted}>No modules in this course yet. Add the first one above.</p>}
      {modules.map((module) => <article key={module.id} className={`${styles.panel} ${styles.stack}`} aria-label={`Module ${module.title}`}>
        <div className={`${styles.row} ${styles.between}`}><h3>{module.order + 1}. {module.title}</h3><Action intent="danger" onClick={() => { setDeleteError(''); setDeleting({ endpoint: `/modules/${module.id}/`, title: 'Delete module', name: module.title }); }}>Delete module</Action></div>
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
export default ContentTab;
