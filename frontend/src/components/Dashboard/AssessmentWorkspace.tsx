'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { managementList, failureMessage } from '@/lib/course-management';
import type { Assignment, Quiz } from '@/lib/assessment-api';
import type { WorkspacePage } from '@/lib/workspace-api';
import { formatWorkspaceDate } from '@/lib/workspace-api';
import { Action, Field, Feedback, styles } from './admin/AuthoringUI';
import { WorkspaceHeading, WorkspaceFeedback, WorkspacePagination } from './WorkspaceUI';
import AssignmentWorkspace from './AssignmentWorkspace';
import QuizWorkspace from './QuizWorkspace';

function AssessmentContent() {
  const { user } = useAuth();
  const teacher = user?.role === 'instructor' || user?.role === 'admin';
  const router = useRouter(), query = useSearchParams();
  const [kind, setKind] = useState<'assignments' | 'quizzes'>('assignments');
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);
  const [course, setCourse] = useState(''), [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const selected = query.get('assignment') || query.get('quiz');
  const selectedKind = query.has('quiz') ? 'quizzes' : 'assignments';
  const root = user?.role === 'admin' ? '/dashboard?tab=assignments' : '/dashboard/assessments?view=list';
  const resource = useWorkspaceResource<WorkspacePage<Assignment | Quiz>>(!selected ? `/${kind}/?page=${page}${course ? `&course=${course}` : ''}` : null);
  useEffect(() => { let active = true;
    managementList<{ id: number; title: string }>(user?.role === 'admin' ? '/admin/dashboard/courses/' : '/dashboard/courses/')
      .then(rows => { if (active) setCourses(rows); }).catch(err => { if (active) setError(failureMessage(err)); });
    return () => { active = false; };
  }, [user?.id, user?.role]);
  const open = (id: number, type = kind) => router.push(`${root}&${type === 'quizzes' ? 'quiz' : 'assignment'}=${id}`);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true); setError('');
    try {
      const payload = { course: Number(values.get('course')), title: values.get('title'), description: values.get('description'),
        ...(kind === 'assignments'
          ? { due_at: new Date(String(values.get('due_at'))).toISOString(), max_score: values.get('max_score'), allow_late_submission: values.get('late') === 'on', is_published: values.get('publish') === 'on' }
          : { status: 'draft' }) };
      const result = await api.request<{ id: number }>(`/${kind}/`, { method: 'POST', body: JSON.stringify(payload) });
      setCreating(false); setPublishNow(false); open(result.id);
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }
  if (selected && /^\d+$/.test(selected)) return <div className={`${styles.root} ${styles.stack}`}>
    <div><Action onClick={() => router.push(root)}>Back to assessments</Action></div>
    {selectedKind === 'quizzes' ? <QuizWorkspace key={`quiz:${selected}`} id={Number(selected)} teacher={teacher} /> : <AssignmentWorkspace key={`assignment:${selected}`} id={Number(selected)} teacher={teacher} />}
  </div>;
  return <section className={`${styles.root} ${styles.stack}`} aria-label="Assessments">
    <WorkspaceHeading title={teacher ? 'Teach and assess' : 'Assignments and quizzes'} description={teacher ? 'Create work for your assigned courses, review responses, and record grades.' : 'Submit your course work, take quizzes, and review your tutor’s feedback.'} />
    <div className={styles.row}><Action aria-pressed={kind === 'assignments'} onClick={() => { setKind('assignments'); setCreating(false); setPage(1); }}>Show assignments</Action><Action aria-pressed={kind === 'quizzes'} onClick={() => { setKind('quizzes'); setCreating(false); setPage(1); }}>Show quizzes</Action>
      {teacher && <Action intent="primary" aria-expanded={creating} onClick={() => setCreating(value => !value)}>{creating ? 'Close creation form' : kind === 'quizzes' ? 'Create quiz' : 'Create assignment'}</Action>}
      <Action loading={resource.loading} onClick={resource.refresh}>Refresh assessments</Action></div>
    <Field label="Filter by course"><select value={course} onChange={event => { setCourse(event.target.value); setPage(1); }}><option value="">All my courses</option>{courses.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>
    <Feedback error={error} />
    {creating && teacher && <form className={`${styles.panel} ${styles.stack}`} onSubmit={create} aria-label="Create assessment"><fieldset className={styles.stack} disabled={busy}>
      <Field label="Assessment course"><select name="course" required defaultValue={course}><option value="">Choose a course</option>{courses.map(item => <option value={item.id} key={item.id}>{item.title}</option>)}</select></Field>
      <Field label="Title"><input name="title" maxLength={200} required /></Field><Field label="Instructions"><textarea name="description" rows={4} maxLength={10000} /></Field>
      {kind === 'assignments' && <><Field label="Due date and time (your timezone)"><input name="due_at" type="datetime-local" required /></Field><Field label="Maximum score"><input name="max_score" type="number" min="0.01" max="999.99" step="0.01" defaultValue="100" required /></Field><label className={styles.check}><input name="late" type="checkbox" defaultChecked />Accept late submissions</label>
        <label className={styles.check}><input name="publish" type="checkbox" checked={publishNow} onChange={event => setPublishNow(event.target.checked)} />Publish to enrolled learners immediately</label>
        <p className={styles.muted}>Leave unticked to keep the assignment as a draft. Drafts stay hidden from learners until you publish them from the assignment page.</p></>}
    </fieldset><div><Action type="submit" intent="primary" loading={busy}>{kind === 'quizzes' ? 'Save quiz draft' : publishNow ? 'Create and publish assignment' : 'Save assignment draft'}</Action></div></form>}
    <WorkspaceFeedback {...resource} hasData={!!resource.data} onRetry={resource.refresh} />
    {resource.data && <><ul className={styles.list}>{resource.data.results.map(item => {
      const published = 'is_published' in item ? item.is_published : item.status === 'published';
      const detail = 'is_published' in item
        ? ` / due ${formatWorkspaceDate(item.due_at, true)} / ${item.max_score} points`
        : ` / time limit ${item.time_limit_minutes} minutes`;
      return <li className={`${styles.panel} ${styles.stack}`} key={item.id}>
        <div className={`${styles.row} ${styles.between}`}><h2>{item.title}</h2>{teacher && <span className={styles.badge}>{published ? 'Published' : 'Draft'}</span>}</div>
        <p className={styles.muted}>{item.course_title}{detail}</p>
        <div><Action onClick={() => open(item.id)}>{teacher ? 'Manage' : 'Open'} {kind === 'quizzes' ? 'quiz' : 'assignment'}</Action></div></li>;
    })}</ul>
      {!resource.data.results.length && <div className={styles.empty}><h2>No {kind} yet</h2><p>{teacher ? 'Create an assessment for a course you teach.' : 'Your tutor’s published assessments will appear here. Try another course filter.'}</p></div>}
      <WorkspacePagination page={page} count={resource.data.count} hasNext={!!resource.data.next} loading={resource.loading} onPage={setPage} /></>}
  </section>;
}
export default function AssessmentWorkspace() { return <Suspense fallback={<p role="status">Loading assessments...</p>}><AssessmentContent /></Suspense>; }
