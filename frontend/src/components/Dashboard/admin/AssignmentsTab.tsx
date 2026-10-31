'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { failureMessage, managementList } from '@/lib/course-management';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import AssignmentWorkspace from '../AssignmentWorkspace';
import QuizWorkspace from '../QuizWorkspace';
import {
  Action, AdminList, AdminRow, AdminSection, CheckRow, Drawer, EmptyState, Field, FormGrid,
  Pager, Pill, Skeleton, StatusNote, TextInput, Toolbar, adminStyles, controlClass, useToast,
} from './AdminUI';

type Kind = 'assignments' | 'quizzes';

interface AssessmentItem {
  id: number; title: string; course_title: string;
  is_published?: boolean; status?: string;
  due_at?: string; max_score?: number;
  time_limit_minutes?: number; pass_mark?: number;
}

function AssessmentsContent() {
  const { user } = useAuth();
  const router = useRouter(), query = useSearchParams();
  const toast = useToast();
  const teacher = user?.role === 'admin' || user?.role === 'instructor';
  const root = '/dashboard?tab=assignments';
  const selected = query.get('assignment') || query.get('quiz');
  const selectedKind: Kind = query.has('quiz') ? 'quizzes' : 'assignments';
  const [kind, setKind] = useState<Kind>(() => query.has('quiz') ? 'quizzes' : 'assignments');
  const [courses, setCourses] = useState<{ id: number; title: string }[]>([]);
  const [course, setCourse] = useState('');
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const resource = useWorkspaceResource<WorkspacePage<AssessmentItem>>(!selected
    ? `/${kind}/?page=${page}${course ? `&course=${course}` : ''}`
    : null);

  useEffect(() => {
    let active = true;
    managementList<{ id: number; title: string }>('/admin/dashboard/courses/')
      .then((rows) => { if (active) setCourses(rows); })
      .catch(() => { if (active) setCourses([]); });
    return () => { active = false; };
  }, []);

  const chooseKind = (next: Kind) => {
    setKind(next);
    setPage(1);
    setCreating(false);
    setFormError('');
  };

  const openDrawer = () => {
    setFormError('');
    setPublishNow(false);
    setCreating(true);
  };

  const closeDrawer = () => { if (!busy) setCreating(false); };

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setFormError('');
    try {
      const payload = kind === 'assignments'
        ? {
          course: Number(values.get('course')), title: values.get('title'), description: values.get('description'),
          due_at: new Date(String(values.get('due_at'))).toISOString(), max_score: values.get('max_score'),
          allow_late_submission: values.get('late') === 'on', is_published: values.get('publish') === 'on',
        }
        : { course: Number(values.get('course')), title: values.get('title'), description: values.get('description'), status: 'draft' };
      const result = await api.request<{ id: number }>(`/${kind}/`, { method: 'POST', body: JSON.stringify(payload) });
      toast.push(kind === 'assignments'
        ? publishNow ? 'Assignment published. Enrolled learners can open it now.' : 'Assignment saved as a draft. Publish it when the brief is ready.'
        : 'Quiz draft created. Add questions, then publish it to learners.', 'success');
      setCreating(false);
      router.push(`${root}&${kind === 'quizzes' ? 'quiz' : 'assignment'}=${result.id}`);
    } catch (err) { setFormError(failureMessage(err)); } finally { setBusy(false); }
  }

  if (selected && /^\d+$/.test(selected)) {
    return <>
      <Toolbar label="Assessment navigation">
        <Action onClick={() => router.push(root)}>Back to assessments</Action>
      </Toolbar>
      {selectedKind === 'quizzes'
        ? <QuizWorkspace key={`quiz:${selected}`} id={Number(selected)} teacher={teacher} embedded />
        : <AssignmentWorkspace key={`assignment:${selected}`} id={Number(selected)} teacher={teacher} embedded />}
    </>;
  }

  const itemNoun = kind === 'quizzes' ? 'quiz' : 'assignment';
  const items = resource.data?.results ?? [];
  return <>
    <AdminSection
      title={kind === 'quizzes' ? 'Quizzes' : 'Assignments'}
      description={kind === 'quizzes'
        ? 'Timed quizzes marked automatically, with short answers reviewed by a tutor. Quizzes stay hidden until published.'
        : 'Create work for your courses, publish it when ready, then review submissions and record grades.'}
      actions={<>
        <Action loading={resource.loading} onClick={resource.refresh}>Refresh assessments</Action>
        <Action intent="primary" disabled={creating} onClick={openDrawer}>{kind === 'quizzes' ? 'Create quiz' : 'Create assignment'}</Action>
      </>}
    >
      <Toolbar label="Assessment list controls">
        <Action aria-pressed={kind === 'assignments'} onClick={() => chooseKind('assignments')}>Show assignments</Action>
        <Action aria-pressed={kind === 'quizzes'} onClick={() => chooseKind('quizzes')}>Show quizzes</Action>
        <Field label="Filter by course">
          <select className={controlClass} value={course} onChange={(event) => { setCourse(event.target.value); setPage(1); }}>
            <option value="">All courses</option>
            {courses.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
          </select>
        </Field>
      </Toolbar>
      {resource.error && <StatusNote tone="error">
        {resource.error} <Action onClick={resource.refresh}>Try again</Action>
      </StatusNote>}
      {resource.loading && !resource.data && <Skeleton rows={3} />}
      {resource.data && (items.length
        ? <>
          <AdminList label={kind === 'quizzes' ? 'Quizzes' : 'Assignments'}>
            {items.map((item) => {
              const published = kind === 'quizzes' ? item.status === 'published' : Boolean(item.is_published);
              return <AdminRow
                key={item.id}
                placeholder={kind === 'quizzes' ? 'bi-patch-question' : 'bi-clipboard2-check'}
                title={item.title}
                badges={<Pill tone={published ? 'live' : 'draft'}>{published ? 'Published' : 'Draft'}</Pill>}
                meta={<span>
                  {item.course_title}
                  {kind === 'quizzes'
                    ? ` · ${item.time_limit_minutes} minutes · pass mark ${item.pass_mark}%`
                    : ` · due ${formatWorkspaceDate(item.due_at ?? '', true)} · ${item.max_score} points`}
                </span>}
                actions={<Action onClick={() => router.push(`${root}&${kind === 'quizzes' ? 'quiz' : 'assignment'}=${item.id}`)}>
                  Manage {itemNoun}
                </Action>}
              />;
            })}
          </AdminList>
          <Pager
            page={page}
            count={resource.data.count}
            hasNext={Boolean(resource.data.next)}
            label={kind === 'quizzes' ? 'Quizzes' : 'Assignments'}
            onPrev={() => setPage((value) => Math.max(1, value - 1))}
            onNext={() => setPage((value) => value + 1)}
            busy={resource.loading}
          />
        </>
        : <EmptyState
          icon={kind === 'quizzes' ? 'bi-patch-question' : 'bi-clipboard2-check'}
          title={course ? `No ${kind} in this course` : `No ${kind} yet`}
          description={course
            ? `This course has no ${kind} yet. Switch back to all courses to see the rest, or create the first one.`
            : kind === 'quizzes'
              ? 'Create a draft quiz, add its questions, then publish it to learners.'
              : 'Create an assignment as a draft, review the brief and deadline, then publish it to enrolled learners.'}
          action={<>
            {course && <Action onClick={() => { setCourse(''); setPage(1); }}>Show all courses</Action>}
            <Action intent="primary" onClick={openDrawer}>{kind === 'quizzes' ? 'Create the first quiz' : 'Create the first assignment'}</Action>
          </>}
        />)}
    </AdminSection>

    <Drawer
      open={creating}
      title={kind === 'quizzes' ? 'Create quiz' : 'Create assignment'}
      description={kind === 'quizzes'
        ? 'The quiz starts as a draft. You add questions and publish it from the quiz page.'
        : 'Drafts stay hidden from learners. Publish from the assignment page when the brief is ready.'}
      onClose={closeDrawer}
      footer={<>
        <Action disabled={busy} onClick={closeDrawer}>Cancel</Action>
        <Action type="submit" form="assessment-form" intent="primary" loading={busy}>
          {kind === 'quizzes' ? 'Save quiz draft' : publishNow ? 'Create and publish' : 'Save assignment draft'}
        </Action>
      </>}
    >
      <form id="assessment-form" className={adminStyles.stack} onSubmit={create}>
        <fieldset disabled={busy} className={adminStyles.group}>
          <Field label="Course" required>
            <select name="course" required defaultValue={course} className={controlClass}>
              <option value="">Choose a course</option>
              {courses.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}
            </select>
          </Field>
          <Field label="Title" required>
            <TextInput name="title" maxLength={200} required />
          </Field>
          <Field label="Instructions" optional hint="Learners see this before they start.">
            <textarea name="description" rows={4} maxLength={10000} className={controlClass} />
          </Field>
          {kind === 'assignments' && <>
            <FormGrid>
              <Field label="Due date and time" required hint="Your local time.">
                <TextInput name="due_at" type="datetime-local" required />
              </Field>
              <Field label="Maximum score" required>
                <TextInput name="max_score" type="number" min="0.01" max="999.99" step="0.01" defaultValue="100" required />
              </Field>
            </FormGrid>
            <CheckRow name="late" label="Accept late submissions" hint="Late work is still accepted and marked as late." defaultChecked />
            <CheckRow
              name="publish"
              label="Publish to enrolled learners now"
              hint="Leave this unticked to review the assignment as a draft first."
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
            />
          </>}
          {kind === 'quizzes' && <StatusNote>Question text, correct answers and the pass mark are added after the draft is saved.</StatusNote>}
          {formError && <StatusNote tone="error">{formError}</StatusNote>}
        </fieldset>
      </form>
    </Drawer>
  </>;
}

export default function AssignmentsTab() {
  return <Suspense fallback={<Skeleton rows={3} />}><AssessmentsContent /></Suspense>;
}
