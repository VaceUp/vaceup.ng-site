'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { managementList, type ManagedCourse, failureMessage } from '@/lib/course-management';
import { api } from '@/lib/api';
import CourseCurriculum from './admin/CourseCurriculum';
import { Action, Field, Feedback, styles } from './admin/AuthoringUI';
import { WorkspaceHeading, WorkspaceFeedback } from './WorkspaceUI';

function CourseDescription({ course, onSaved }: { course: ManagedCourse; onSaved: () => void }) {
  const [form, setForm] = useState({ description: course.description, outline: course.outline || '', learning_outcomes: course.learning_outcomes || '', requirements: course.requirements || '' });
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  return <form className={`${styles.panel} ${styles.stack}`} aria-label="Course teaching details" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setNotice(''); try {
    await api.request(`/courses/${encodeURIComponent(course.slug)}/`, { method: 'PATCH', body: JSON.stringify(form) }); setNotice('Course teaching details saved.'); onSaved();
  } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); } }}>
    <h2>{course.title}</h2><p className={styles.muted}>Changes to a published course are immediately visible. Pricing, tutor assignment and catalogue publication are managed by the administrator.</p>
    <fieldset disabled={busy} className={styles.stack}>{([['description', 'About the course'], ['outline', 'Public course outline'], ['learning_outcomes', 'Learning outcomes'], ['requirements', 'Requirements']] as const).map(([key, label]) => <Field key={key} label={label}><textarea rows={5} maxLength={20000} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></Field>)}</fieldset>
    <Feedback error={error} message={notice} /><div><Action type="submit" intent="primary" loading={busy}>Save teaching details</Action></div>
  </form>;
}
function Content() {
  const { user } = useAuth(), router = useRouter(), query = useSearchParams();
  const id = query.get('course') || '';
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]), [error, setError] = useState('');
  const allowed = user?.role === 'instructor';
  const resource = useWorkspaceResource<{ course: ManagedCourse }>(allowed && /^\d+$/.test(id) ? `/dashboard/courses/${id}/` : null);
  useEffect(() => { let active = true; if (allowed) managementList<{ id: number; title: string }>('/dashboard/courses/').then(rows => { if (active) setCourses(rows); }).catch(err => { if (active) setError(failureMessage(err)); }); return () => { active = false; }; }, [allowed]);
  if (!allowed) return <p>This editor is for the assigned tutor. Administrators can use Content in their control panel.</p>;
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Tutor course editor"><WorkspaceHeading title="Course content" description="Prepare the lessons, syllabus and videos for courses assigned to you." />
    <Feedback error={error} /><Field label="Course to edit"><select value={id} onChange={e => router.push(`/dashboard/content?course=${e.target.value}`)}><option value="">Choose your course</option>{courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}</select></Field>
    {id && <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />}
    {resource.data && <><CourseDescription key={resource.data.course.id} course={resource.data.course} onSaved={resource.refresh} /><CourseCurriculum key={resource.data.course.id} course={resource.data.course} /></>}
    {!id && <p>Select a course to edit its public teaching details, modules and lesson materials.</p>}
  </section>;
}
export default function TutorContent() { return <Suspense fallback={<p role="status">Loading course editor...</p>}><Content /></Suspense>; }
