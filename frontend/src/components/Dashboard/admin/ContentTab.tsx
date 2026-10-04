'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { managedCourses, managedCategories, managedTutors, failureMessage, type ManagedCourse, type ManagedCategory, type ManagedTutor } from '@/lib/course-management';
import { Action, Field, Feedback, styles } from './AuthoringUI';
import CourseForm from './CourseForm';
import CourseCurriculum from './CourseCurriculum';

export function ContentTab() {
  const params = useSearchParams();
  const [courses, setCourses] = useState<ManagedCourse[]>([]), [categories, setCategories] = useState<ManagedCategory[]>([]), [tutors, setTutors] = useState<ManagedTutor[]>([]);
  const [courseId, setCourseId] = useState(params.get('course') || '');
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [revision, setRevision] = useState(0), [dirty, setDirty] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { const [rows, groups, people] = await Promise.all([managedCourses(), managedCategories(), managedTutors()]); setCourses(rows); setCategories(groups); setTutors(people); }
    catch (err) { setError(failureMessage(err)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const course = courses.find((item) => String(item.id) === courseId);
  const discard = () => !dirty || window.confirm('Leave this editor? Any unsaved changes will be lost.');
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Full course control">
    <header className={styles.heading}><h2>Course content and details</h2><p className={styles.muted}>Select a created course to manage its public page, price, category, tutor, publication, modules and lessons.</p></header>
    <div className={styles.row}><Field label="Course to manage"><select disabled={loading} value={courseId} onChange={(event) => { if (discard()) { setCourseId(event.target.value); setDirty(false); setMessage(''); } }}><option value="">Select a course, including drafts</option>{courses.map((item) => <option key={item.id} value={item.id}>{item.title} ({item.is_published ? 'Published' : 'Draft'})</option>)}</select></Field>
      <Action loading={loading} onClick={() => { if (discard()) { setDirty(false); setRevision((value) => value + 1); void load(); } }}>Refresh courses</Action></div>
    <Feedback error={error} message={message} />
    {loading && <p role="status">Loading course controls...</p>}
    {!loading && !error && !course && <div className={`${styles.panel} ${styles.empty}`}><h3>{courseId ? 'This course is no longer available' : 'Choose a course to start editing'}</h3><p>Select a course above, or create one in Courses.</p><Link className={styles.action} href="/dashboard?tab=courses">Open Courses</Link></div>}
    {!loading && course && <div key={course.id} className={styles.stack} onChange={() => setDirty(true)}>
      <div className={styles.row}><span className={styles.badge}>{course.is_published ? 'Published' : 'Draft'}</span>{course.is_published && <Link className={styles.action} href={`/course?slug=${encodeURIComponent(course.slug)}`} target="_blank" rel="noopener noreferrer">View public course (new tab)</Link>}</div>
      <div className={styles.panel}><CourseForm key={`${course.id}:${revision}`} course={course} categories={categories} tutors={tutors}
        onCategoryCreated={(category) => setCategories((items) => [...items, category])}
        onSaved={(saved) => { setCourses((items) => items.map((item) => item.id === saved.id ? saved : item)); setDirty(false); setRevision((value) => value + 1); setMessage(`${saved.title} saved. ${saved.is_published ? 'Its public course page is updated.' : 'It remains a draft.'}`); }}
        onCancel={() => { if (discard()) { setDirty(false); setRevision((value) => value + 1); setMessage('Unsaved edits discarded.'); } }} /></div>
      <div className={styles.panel}><CourseCurriculum fixedCourse={course} /></div>
    </div>}
  </section>;
}
export default ContentTab;
