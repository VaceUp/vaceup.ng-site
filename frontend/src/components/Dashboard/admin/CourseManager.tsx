'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { managedCourses, managedCategories, managedTutors, courseEndpoint, failureMessage, type ManagedCourse, type ManagedCategory, type ManagedTutor } from '@/lib/course-management';
import { Action, Field, Feedback, ConfirmDelete, styles } from './AuthoringUI';
import CategoryManager from './CategoryManager';
import CourseForm from './CourseForm';
import ContentTab from './ContentTab';

export default function CourseManager() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<ManagedCourse[]>([]), [categories, setCategories] = useState<ManagedCategory[]>([]), [tutors, setTutors] = useState<ManagedTutor[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [mode, setMode] = useState<'courses' | 'categories' | 'import'>('courses');
  const [filter, setFilter] = useState('all'), [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ManagedCourse | 'new' | null>(null), [content, setContent] = useState<ManagedCourse | null>(null);
  const [busy, setBusy] = useState(false), [deleting, setDeleting] = useState<ManagedCourse | null>(null), [deleteError, setDeleteError] = useState('');
  const [importTutor, setImportTutor] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true); setError('');
    const results = await Promise.allSettled([managedCourses(), managedCategories(), managedTutors()]);
    if (results[0].status === 'fulfilled') setCourses(results[0].value);
    if (results[1].status === 'fulfilled') setCategories(results[1].value);
    if (results[2].status === 'fulfilled') setTutors(results[2].value);
    setError(results.flatMap((result, i) => result.status === 'rejected' ? [`${['Courses', 'Categories', 'Tutors'][i]}: ${failureMessage(result.reason)}`] : []).join(' '));
    setLoading(false);
  }, []);
  useEffect(() => { if (user?.role === 'admin') void refresh(); }, [refresh, user?.id, user?.role]);
  if (user?.role !== 'admin') return <p role="alert">Administrator access is required to manage the catalogue.</p>;
  const shown = courses.filter((course) => (filter === 'all' || course.is_published === (filter === 'published')) && course.title.toLowerCase().includes(search.toLowerCase()));
  const saved = (course: ManagedCourse) => { setCourses((current) => [course, ...current.filter((item) => item.id !== course.id)]); setEditing(null); setMessage(`${course.title} saved as ${course.is_published ? 'published' : 'a draft'}.`); };
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Course management">
    <header className={`${styles.heading} ${styles.panel}`}><h2>Course management</h2><p className={styles.muted}>Manage every course, including imported drafts. Build the content here, then publish when it is ready for learners.</p>
      <div className={styles.row}><Action intent="primary" disabled={!!editing} onClick={() => { setMode('courses'); setContent(null); setEditing('new'); setMessage(''); }}>New course</Action><Action loading={loading} disabled={!!editing} onClick={() => void refresh()}>Refresh courses</Action></div>
    </header>
    <nav className={styles.row} aria-label="Course management sections">{(['courses', 'categories', 'import'] as const).map((item) => <Action key={item} aria-pressed={mode === item} disabled={!!editing || busy} onClick={() => { setMode(item); setContent(null); setMessage(''); }}>{item === 'courses' ? 'All courses' : item === 'categories' ? 'Categories' : 'Import homepage courses'}</Action>)}</nav>
    <Feedback error={error} message={message} />
    {loading && <p role="status">Loading courses, categories and tutors...</p>}
    {mode === 'categories' && <div className={styles.panel}><CategoryManager categories={categories} onChanged={async () => setCategories(await managedCategories())} /></div>}
    {mode === 'import' && <form className={`${styles.panel} ${styles.stack}`} onSubmit={async (event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setError(''); setMessage('');
      try { await api.request('/courses/import-homepage/', { method: 'POST', body: JSON.stringify({ instructor: Number(importTutor) }) }); setMessage('Homepage import completed. Missing courses were added as drafts; matching courses and their edits were preserved. Open All courses to review them.'); await refresh(); }
      catch (err) { setError(failureMessage(err)); }
      finally { setBusy(false); }
    }}><h3>Restore the original homepage catalogue</h3><p className={styles.muted}>Import Virtual Assistant, Data Analysis, UI/UX Design, Graphic Design and Web Development, including their original prices and categories. This creates catalogue records, not lesson content. Existing matching courses are not overwritten.</p>
      <Field label="Tutor for newly imported courses"><select required disabled={busy} value={importTutor} onChange={(event) => setImportTutor(event.target.value)}><option value="">Select an active tutor</option>{tutors.map((tutor) => <option key={tutor.id} value={tutor.id}>{tutor.full_name || tutor.email}</option>)}</select></Field>
      {!tutors.length && <p className={styles.muted}>No active tutors loaded. Add or activate the intended tutor under Users, then refresh this page.</p>}
      <div><Action intent="primary" type="submit" loading={busy} disabled={!importTutor}>Import missing courses as drafts</Action></div>
    </form>}
    {mode === 'courses' && <>
      {editing ? <div className={styles.panel}><CourseForm key={editing === 'new' ? 'new' : editing.id} course={editing === 'new' ? undefined : editing} categories={categories} tutors={tutors} onSaved={saved} onCancel={() => setEditing(null)} /></div> : <>
        <div className={styles.row}><Field label="Search courses"><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} /></Field><Field label="Publication status"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All courses</option><option value="draft">Drafts</option><option value="published">Published</option></select></Field></div>
        <p role="status" className={styles.muted}>{shown.length} shown / {courses.length} loaded. Drafts are not displayed on the public homepage.</p>
        {!loading && !error && !shown.length && <div className={`${styles.panel} ${styles.empty}`}><h3>{courses.length ? 'No courses match these filters' : 'Your course catalogue starts here'}</h3><p className={styles.muted}>{courses.length ? 'Clear the search or select All courses.' : 'Create a course, or use Import homepage courses to bring the original catalogue into this dashboard.'}</p></div>}
        <ul className={styles.list}>{shown.map((course) => <li key={course.id} className={`${styles.panel} ${styles.stack}`}>
          <div className={`${styles.row} ${styles.between}`}><h3>{course.title}</h3><span className={styles.badge}>{course.is_published ? 'Published' : 'Draft'}</span></div>
          <p className={styles.muted}>{categories.find((category) => String(category.id) === String(course.category))?.name || 'Category unavailable'} / {new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(Number(course.price))} / {course.level}{course.duration ? ` / ${course.duration}` : ''}</p>
          <div className={styles.row}><Action onClick={() => { setEditing(course); setContent(null); }} aria-label={`Edit ${course.title}`}>Edit course</Action><Action onClick={() => setContent(course)} aria-label={`Manage content for ${course.title}`}>Modules and lessons</Action>
            <Action disabled={busy} onClick={async () => { if (busy) return; setBusy(true); setError(''); try { saved(await api.request<ManagedCourse>(courseEndpoint(course), { method: 'PATCH', body: JSON.stringify({ is_published: !course.is_published }) })); } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); } }} aria-label={`${course.is_published ? 'Unpublish' : 'Publish'} ${course.title}`}>{course.is_published ? 'Unpublish' : 'Publish'}</Action>
            {!course.is_published && <Action intent="danger" onClick={() => { setDeleting(course); setDeleteError(''); }} aria-label={`Delete draft ${course.title}`}>Delete draft</Action>}
          </div>
          {content?.id === course.id && <ContentTab key={course.id} fixedCourse={course} />}
        </li>)}</ul>
      </>}
    </>}
    {deleting && <ConfirmDelete title="Delete draft course" description={`Delete ${deleting.title}? This cannot be undone. Only empty drafts without linked records can be deleted. Keep other courses unpublished to preserve their content and history.`} busy={busy} error={deleteError} onCancel={() => setDeleting(null)} onConfirm={async () => {
      if (busy) return; setBusy(true); setDeleteError(''); try { await api.request(courseEndpoint(deleting), { method: 'DELETE' }); setCourses((items) => items.filter((item) => item.id !== deleting.id)); setMessage('Empty draft deleted.'); setDeleting(null); } catch (err) { setDeleteError(failureMessage(err)); } finally { setBusy(false); }
    }} />}
  </section>;
}
