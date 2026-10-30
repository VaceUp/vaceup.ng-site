'use client';

import { useEffect, useState } from 'react';
import { Download, GraduationCap } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { formatWorkspaceDate, progressPercent, type Gradebook, type GradebookStudent, type WorkspaceCourse, type WorkspacePage } from '@/lib/workspace-api';
import { WorkspaceButton, WorkspaceEmpty, WorkspaceFeedback, WorkspaceHeading, WorkspacePagination, WorkspacePanel, WorkspaceRefresh, styles } from './WorkspaceUI';

function csvCell(value: string | number | null | undefined) {
  const text = value == null ? '' : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCsv(gradebook: Gradebook) {
  const header = ['Student', 'Email', 'Enrollment', 'Progress %',
    ...gradebook.assignments.map(item => `${item.title} (/ ${item.max_score})`),
    ...gradebook.quizzes.map(item => `${item.title} (%)`), 'Average %'];
  const rows = gradebook.students.map(student => [
    student.student_name, student.email, student.enrollment_status,
    progressPercent(student.progress_percent),
    ...gradebook.assignments.map(item => student.assignments[String(item.id)]?.percent ?? ''),
    ...gradebook.quizzes.map(item => student.quizzes[String(item.id)]?.percent ?? ''),
    student.average_percent ?? '',
  ]);
  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `VaceUp-gradebook-${gradebook.course.title.replace(/[^a-z0-9]+/gi, '-')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function Mark({ student, kind, id, maximum, passMark }: {
  student: GradebookStudent; kind: 'assignment' | 'quiz'; id: number; maximum?: string; passMark?: string;
}) {
  if (kind === 'assignment') {
    const cell = student.assignments[String(id)];
    if (!cell || cell.status === 'not_submitted') return <span className={styles.muted}>Not submitted</span>;
    if (cell.percent != null && cell.score != null) {
      return <span>{cell.score} / {maximum}{cell.is_late ? <span className={styles.badge}>Late</span> : null}</span>;
    }
    return <span className={styles.muted}>{cell.status === 'graded' ? 'Marked' : 'Awaiting grade'}</span>;
  }
  const cell = student.quizzes[String(id)];
  if (!cell || cell.status === 'not_started') return <span className={styles.muted}>Not started</span>;
  if (cell.percent != null) {
    return <span>{Math.round(cell.percent)}%<span className={styles.badge}>{cell.passed ? `Pass (${passMark}%)` : `Below ${passMark}%`}</span></span>;
  }
  return <span className={styles.muted}>{cell.status === 'in_progress' ? 'In progress' : 'Awaiting marks'}</span>;
}

export default function TutorGradebook() {
  const { user } = useAuth();
  const instructor = user?.role === 'instructor';
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState('');
  const courses = useWorkspaceResource<WorkspacePage<WorkspaceCourse>>(instructor ? `/dashboard/courses/?page=${page}` : null);
  const gradebook = useWorkspaceResource<Gradebook>(instructor && selected ? `/instructor/courses/${selected}/gradebook/` : null);
  useEffect(() => {
    if (!selected && courses.data?.results.length) setSelected(String(courses.data.results[0].id));
  }, [courses.data, selected]);
  if (!instructor) return <WorkspaceEmpty title="Tutor access only">The gradebook is available to tutors for the courses they teach.</WorkspaceEmpty>;
  const data = gradebook.data;
  return <>
    <WorkspaceHeading title="Gradebook" description="Every learner and assessment in one course, with the marks recorded so far."
      action={<WorkspaceRefresh loading={gradebook.loading} onRefresh={() => { courses.refresh(); gradebook.refresh(); }} />} />
    <div className={styles.filters}>
      <label className={styles.field}>Course<select value={selected} onChange={event => setSelected(event.target.value)}>
        {courses.data?.results.map(course => <option key={course.id} value={course.id}>{course.title}{course.is_published ? '' : ' (draft)'}</option>)}
      </select></label>
      {data && <WorkspaceButton onClick={() => downloadCsv(data)}><Download aria-hidden="true" />Export CSV</WorkspaceButton>}
    </div>
    <WorkspaceFeedback {...courses} hasData={!!courses.data} onRetry={courses.refresh} />
    {courses.data && <WorkspacePagination page={page} count={courses.data.count} hasNext={!!courses.data.next} loading={courses.loading} onPage={setPage} />}
    <WorkspaceFeedback {...gradebook} hasData={!!data} onRetry={gradebook.refresh} />
    {data && <>
      <dl className={styles.stats}>
        <div className={styles.stat}><dt>Learners</dt><dd>{data.summary.students}</dd></div>
        <div className={styles.stat}><dt>Active</dt><dd>{data.summary.active}</dd></div>
        <div className={styles.stat}><dt>Average progress</dt><dd>{Math.round(data.summary.average_progress)}%</dd></div>
        <div className={styles.stat}><dt>Awaiting grading</dt><dd>{data.summary.awaiting_grading}</dd></div>
      </dl>
      {data.students.length ? <div className={styles.tableWrap}>
        <table className={styles.gradebook}><caption>Assessment marks for {data.course.title}. A dash means the work has not produced a mark yet.</caption>
          <thead><tr><th scope="col">Learner</th>
            {data.assignments.map(item => <th scope="col" key={`a-${item.id}`}><span>{item.title}</span><span className={styles.muted}>/ {item.max_score} · {formatWorkspaceDate(item.due_at)}</span></th>)}
            {data.quizzes.map(item => <th scope="col" key={`q-${item.id}`}><span>{item.title}</span><span className={styles.muted}>Pass {item.pass_mark}%</span></th>)}
            <th scope="col">Average</th></tr></thead>
          <tbody>{data.students.map(student => <tr key={student.student_id}>
            <th scope="row"><span>{student.student_name}</span><span className={styles.muted}>{student.email}</span><span className={styles.badge}>{student.enrollment_status}</span></th>
            {data.assignments.map(item => <td key={`a-${item.id}`}><Mark student={student} kind="assignment" id={item.id} maximum={item.max_score} /></td>)}
            {data.quizzes.map(item => <td key={`q-${item.id}`}><Mark student={student} kind="quiz" id={item.id} passMark={item.pass_mark} /></td>)}
            <td>{student.average_percent != null ? `${student.average_percent}%` : <span className={styles.muted}>No marks</span>}</td>
          </tr>)}</tbody>
        </table>
      </div> : <WorkspacePanel><WorkspaceEmpty title="No learners enrolled yet" action={<GraduationCap aria-hidden="true" />}>Marks appear once learners enroll and you create assignments or publish quizzes.</WorkspaceEmpty></WorkspacePanel>}
      <p className={styles.footer}>Assignments and quizzes only. Live-class attendance is recorded on the Live classes page.</p>
    </>}
  </>;
}
