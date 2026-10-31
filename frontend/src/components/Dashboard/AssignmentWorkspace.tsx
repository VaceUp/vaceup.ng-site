'use client';
import { useState, type FormEvent } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import { downloadApiFile } from '@/lib/api-pages';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import type { Assignment, Submission } from '@/lib/assessment-api';
import { Action, Field, Feedback, styles } from './admin/AuthoringUI';
import { WorkspaceHeading, WorkspaceFeedback, WorkspacePagination } from './WorkspaceUI';

function SubmissionReview({ submission, assignment, teacher, onSaved }: { submission: Submission; assignment: Assignment; teacher: boolean; onSaved: () => void }) {
  const [score, setScore] = useState(submission.score ?? ''), [feedback, setFeedback] = useState(submission.feedback);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  return <article className={`${styles.panel} ${styles.stack}`}><h2>{teacher ? submission.student_name : 'Your submission'}</h2><p>{submission.status}{submission.is_late ? ' / Submitted late' : ''} / {formatWorkspaceDate(submission.submitted_at, true)}</p>
    <p className={styles.preview}>{submission.text_answer || 'No text answer.'}</p>
    {submission.file && <div><Action loading={busy} onClick={async () => { setBusy(true); setError(''); try { await downloadApiFile(`/submissions/${submission.id}/download/`, `assignment-${assignment.id}-attachment`); } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); } }}>Download attachment</Action></div>}
    <Feedback error={error} message={notice} />
    {teacher ? <form className={styles.stack} aria-label={`Grade ${submission.student_name}`} onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); setNotice('');
      try { await api.request(`/assignments/${assignment.id}/grade/`, { method: 'POST', body: JSON.stringify({ submission_id: submission.id, score, feedback }) }); setNotice('Grade and feedback saved.'); onSaved(); }
      catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
    }}><Field label={`Score out of ${assignment.max_score}`}><input value={score} onChange={e => setScore(e.target.value)} type="number" min="0" max={assignment.max_score} step="0.01" required disabled={busy} /></Field><Field label="Feedback for learner"><textarea value={feedback} onChange={e => setFeedback(e.target.value)} rows={4} maxLength={10000} disabled={busy} /></Field><div><Action type="submit" intent="primary" loading={busy}>Save grade</Action></div></form>
      : <><p>{submission.score === null ? 'Awaiting your tutor’s review.' : `Score: ${submission.score} / ${assignment.max_score}`}</p>{submission.feedback && <p className={styles.preview}>{submission.feedback}</p>}</>}
  </article>;
}

const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
};

function TeacherControls({ assignment, locked, onSaved }: { assignment: Assignment; locked: boolean; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [form, setForm] = useState({ title: assignment.title, description: assignment.description, due_at: toLocalInput(assignment.due_at), max_score: assignment.max_score, allow_late_submission: assignment.allow_late_submission });
  const publish = async () => {
    setBusy(true); setError(''); setNotice('');
    try { await api.request(`/assignments/${assignment.id}/${assignment.is_published ? 'unpublish' : 'publish'}/`, { method: 'POST' }); setNotice(assignment.is_published ? 'Assignment hidden from learners. Submissions and grades are retained.' : 'Assignment published. Enrolled learners can now open it and submit work.'); onSaved(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api.request(`/assignments/${assignment.id}/`, { method: 'PATCH', body: JSON.stringify({ ...form, due_at: new Date(form.due_at).toISOString(), max_score: form.max_score }) });
      setNotice('Assignment updated.'); onSaved();
    } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  };
  return <section className={`${styles.panel} ${styles.stack}`} aria-label="Assignment management">
    <div className={`${styles.row} ${styles.between}`}><h2>{assignment.is_published ? 'Published to learners' : 'Draft — hidden from learners'}</h2><span className={styles.badge}>{assignment.is_published ? 'Published' : 'Draft'}</span></div>
    <p className={styles.muted}>{assignment.is_published
      ? 'Enrolled learners can open this assignment and submit work. Unpublishing hides it again without deleting any submission or grade.'
      : 'Review the instructions and deadline, then publish. Learners only see published assignments for courses they are enrolled in.'}</p>
    <Feedback error={error} message={notice} />
    <div className={styles.row}><Action intent="primary" loading={busy} onClick={() => void publish()}>{assignment.is_published ? 'Unpublish assignment' : 'Publish assignment'}</Action></div>
    {locked ? <p className={styles.muted}>Learners have already submitted, so the title, instructions, deadline and score are locked. Add feedback and grades below, or create a new assignment for the next task.</p>
      : <form className={styles.stack} onSubmit={save} aria-label="Edit assignment"><fieldset className={styles.stack} disabled={busy}>
        <Field label="Title"><input value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} maxLength={200} required /></Field>
        <Field label="Instructions for learners"><textarea rows={5} value={form.description} onChange={event => setForm({ ...form, description: event.target.value })} maxLength={10000} /></Field>
        <div className={styles.grid}>
          <Field label="Due date and time (your timezone)"><input type="datetime-local" value={form.due_at} onChange={event => setForm({ ...form, due_at: event.target.value })} required /></Field>
          <Field label="Maximum score"><input type="number" min="0.01" max="999.99" step="0.01" value={form.max_score} onChange={event => setForm({ ...form, max_score: event.target.value })} required /></Field>
        </div>
        <label className={styles.check}><input type="checkbox" checked={form.allow_late_submission} onChange={event => setForm({ ...form, allow_late_submission: event.target.checked })} />Accept late submissions (marked as late)</label>
      </fieldset><div><Action type="submit" intent="primary" loading={busy} disabled={!form.title.trim() || !form.due_at}>Save changes</Action></div></form>}
  </section>;
}

export default function AssignmentWorkspace({ id, teacher, embedded = false }: { id: number; teacher: boolean; embedded?: boolean }) {
  const [page, setPage] = useState(1);
  const resource = useWorkspaceResource<Assignment>(`/assignments/${id}/`);
  const submissions = useWorkspaceResource<WorkspacePage<Submission>>(`/submissions/?assignment=${id}&page=${page}`);
  const [answer, setAnswer] = useState<string | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const assignment = resource.data, previous = !teacher ? submissions.data?.results[0] : undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    const form = event.currentTarget;
    const payload = new FormData(form);
    payload.set('assignment', String(id));
    payload.set('text_answer', answer ?? previous?.text_answer ?? '');
    const file = payload.get('file');
    if (file instanceof File && !file.size) payload.delete('file');
    try { await api.request('/submissions/', { method: 'POST', body: payload }); setNotice('Your work was submitted. You can revise it until it is graded, subject to the deadline.'); const upload = form.elements.namedItem('file') as HTMLInputElement; if (upload) upload.value = ''; submissions.refresh(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }
  const refresh = <Action loading={resource.loading || submissions.loading} onClick={() => { resource.refresh(); submissions.refresh(); }}>Refresh assignment</Action>;
  const header = embedded
    ? <header className={styles.detailHeading}><div><h2>{assignment?.title || 'Assignment'}</h2><p className={styles.muted}>{assignment?.course_title || 'Loading course details.'}</p></div>{refresh}</header>
    : <WorkspaceHeading title={assignment?.title || 'Assignment'} description={assignment?.course_title || 'Loading course details.'} action={refresh} />;
  return <>{header}
    <WorkspaceFeedback {...resource} hasData={!!assignment} onRetry={resource.refresh} />
    {assignment && <>{teacher && <TeacherControls assignment={assignment} locked={!!submissions.data?.results.length} onSaved={() => { resource.refresh(); submissions.refresh(); }} />}
      {(!embedded || !teacher) && <><p className={styles.preview}>{assignment.description}</p><p>Due {formatWorkspaceDate(assignment.due_at, true)} / {assignment.max_score} points. {assignment.allow_late_submission ? 'Late submissions are accepted and marked late.' : 'Submissions close at the deadline.'}</p></>}
      <WorkspaceFeedback {...submissions} hasData={!!submissions.data} onRetry={submissions.refresh} />
      {!teacher && submissions.data && (previous?.score == null) && <form className={`${styles.panel} ${styles.stack}`} onSubmit={submit} aria-label="Submit assignment"><Field label="Your answer"><textarea rows={10} maxLength={50000} disabled={busy} value={answer ?? previous?.text_answer ?? ''} onChange={e => setAnswer(e.target.value)} /></Field><Field label="Assignment attachment (optional, up to 10 MB)"><input type="file" name="file" accept=".pdf,.txt,.docx,.png,.jpg,.jpeg" disabled={busy} /></Field><p className={styles.muted}>Provide text or an attachment. New attachments are private to your account, the assigned tutor and administrators. Updating without a new file keeps the existing attachment.</p><div><Action type="submit" intent="primary" loading={busy}>{previous ? 'Update submission' : 'Submit assignment'}</Action></div></form>}
      <Feedback error={error} message={notice} />
      {submissions.data?.results.map(item => <SubmissionReview key={item.id} submission={item} assignment={assignment} teacher={teacher} onSaved={submissions.refresh} />)}
      {teacher && submissions.data && !submissions.data.results.length && <p>No submissions yet. Enrolled learners can open this assignment from their assessment page.</p>}
      {submissions.data && submissions.data.count > 0 && <WorkspacePagination page={page} count={submissions.data.count} hasNext={!!submissions.data.next} loading={submissions.loading} onPage={setPage} />}
    </>}
  </>;
}
