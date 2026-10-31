'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useWorkspaceResource } from '@/lib/use-workspace-resource';
import { failureMessage } from '@/lib/course-management';
import type { Quiz, Attempt, Answer } from '@/lib/assessment-api';
import { formatWorkspaceDate, type WorkspacePage } from '@/lib/workspace-api';
import { Action, Field, Feedback, styles } from './admin/AuthoringUI';
import { WorkspaceHeading, WorkspaceFeedback, WorkspacePagination } from './WorkspaceUI';
import QuizBuilder from './QuizBuilder';

function AttemptReview({ attempt, quiz, onSaved }: { attempt: Attempt; quiz: Quiz; onSaved: () => void }) {
  const short = quiz.questions.filter(q => q.question_type === 'short_answer');
  const [grades, setGrades] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  return <article className={`${styles.panel} ${styles.stack}`}><h3>{attempt.student_name}</h3><p>{attempt.status.replace('_', ' ')}{attempt.total_score !== null ? ` / ${attempt.total_score}%` : ''}</p>
    {attempt.status !== 'in_progress' && <><ol className={styles.list}>{quiz.questions.map(q => { const answer = attempt.answers.find(a => a.question_id === q.id); return <li key={q.id}><p>{q.question_text}</p><p className={styles.muted}>{q.question_type === 'short_answer' ? answer?.short_text || 'No response' : q.choices.find(c => c.id === answer?.choice_id)?.choice_text || 'No option selected'}</p></li>; })}</ol>
      {!!short.length && <form className={styles.stack} aria-label={`Mark ${attempt.student_name}`} onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setNotice(''); try {
        await api.request(`/quiz-attempts/${attempt.id}/grade/`, { method: 'POST', body: JSON.stringify({ grades: short.map(q => ({ question_id: q.id, score: grades[q.id] ?? attempt.answers.find(a => a.question_id === q.id)?.score_earned ?? '' })) }) }); setNotice('Marks saved.'); onSaved();
      } catch (err) { setError(failureMessage(err)); } finally { setBusy(false); } }}>
        {short.map(q => <Field key={q.id} label={`Mark: ${q.question_text} (0 to 1)`}><input type="number" min="0" max="1" step="0.01" required disabled={busy} value={grades[q.id] ?? attempt.answers.find(a => a.question_id === q.id)?.score_earned ?? ''} onChange={e => setGrades({ ...grades, [q.id]: e.target.value })} /></Field>)}
        <div><Action type="submit" intent="primary" loading={busy}>Save short-answer marks</Action></div>
      </form>}</>}
    <Feedback error={error} message={notice} />
  </article>;
}

function LearnerAttempt({ quiz, onSaved }: { quiz: Quiz; onSaved: () => void }) {
  const [attempt, setAttempt] = useState<Attempt | null>(quiz.my_attempt ?? null);
  const [answers, setAnswers] = useState<Answer[]>(quiz.my_attempt?.answers ?? []);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [now, setNow] = useState(Date.now());
  const [dirty, setDirty] = useState(false);
  const busyRef = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { if (!dirty) return; const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); }; window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn); }, [dirty]);
  const expired = !!attempt && now >= new Date(attempt.deadline).getTime();
  const remaining = attempt ? Math.max(0, Math.ceil((new Date(attempt.deadline).getTime() - now) / 60000)) : 0;
  const change = (id: number, value: Partial<Answer>) => { setAnswers(current => [...current.filter(a => a.question_id !== id), { question_id: id, choice_id: null, short_text: '', ...current.find(a => a.question_id === id), ...value }]); setDirty(true); setNotice('Unsaved answers. Select Save answers before leaving this page.'); };
  async function act(action: 'start' | 'save-answers' | 'submit' | 'finish-expired') {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try { const result = await api.request<Attempt>(`/quizzes/${quiz.id}/${action}/`, { method: action === 'save-answers' ? 'PUT' : 'POST', ...(action === 'submit' || action === 'save-answers' ? { body: JSON.stringify({ answers }) } : {}) });
      setAttempt(result); setAnswers(result.answers); setDirty(false); setNotice(action === 'save-answers' ? 'Answers saved on the server.' : action === 'start' ? 'Your attempt has started. Save your answers regularly.' : 'Your attempt was submitted.'); onSaved();
    } catch (err) { setError(failureMessage(err)); } finally { busyRef.current = false; setBusy(false); }
  }
  return <section className={styles.stack} aria-label="Your quiz attempt"><p>{quiz.description}</p><p>Time limit: {quiz.time_limit_minutes} minutes. Pass mark: {quiz.pass_mark}%. One attempt is allowed.</p><Feedback error={error} message={notice} />
    {!attempt ? <div><Action intent="primary" loading={busy} onClick={() => void act('start')}>Start timed attempt</Action></div> : attempt.status === 'in_progress' ? <>
      <p>{expired ? 'Time has ended. Only answers saved before the deadline can be submitted.' : `${remaining} minutes remaining. Deadline: ${formatWorkspaceDate(attempt.deadline, true)}.`}</p>
      <form className={styles.stack} aria-label="Answer quiz" onSubmit={e => { e.preventDefault(); void act(expired ? 'finish-expired' : 'submit'); }}><fieldset disabled={busy || expired} className={styles.stack}>
        {quiz.questions.map((q, index) => <fieldset key={q.id} className={`${styles.panel} ${styles.stack}`}><legend>{index + 1}. {q.question_text}</legend>
          {q.question_type === 'short_answer' ? <Field label={`Answer question ${index + 1}`}><textarea rows={4} maxLength={1000} value={answers.find(a => a.question_id === q.id)?.short_text || ''} onChange={e => change(q.id, { short_text: e.target.value })} /></Field>
            : q.choices.map(c => <label className={styles.check} key={c.id}><input type="radio" name={`answer-${q.id}`} checked={answers.find(a => a.question_id === q.id)?.choice_id === c.id} onChange={() => change(q.id, { choice_id: c.id })} />{c.choice_text}</label>)}
        </fieldset>)}
      </fieldset><p className={styles.muted}>Review your answers before submitting. Unanswered questions earn no automatic marks. Submitted answers cannot be edited.</p>
        <div className={styles.row}><Action disabled={expired || !dirty} loading={busy} onClick={() => void act('save-answers')}>Save answers</Action><Action intent="primary" type="submit" loading={busy}>{expired ? 'Submit saved answers' : 'Submit final answers'}</Action></div>
      </form>
    </> : <div className={`${styles.panel} ${styles.stack}`}><h2>{attempt.status === 'graded' ? 'Quiz result' : 'Submitted for review'}</h2><p>{attempt.status === 'graded' ? `${attempt.total_score}% / ${attempt.passed ? 'Passed' : 'Pass mark not reached'}` : 'Your tutor still needs to mark the short answers. A final grade is not available yet.'}</p><Action loading={busy} onClick={() => void act('start')}>Refresh result</Action></div>}
  </section>;
}

export default function QuizWorkspace({ id, teacher, embedded = false }: { id: number; teacher: boolean; embedded?: boolean }) {
  const resource = useWorkspaceResource<Quiz>(`/quizzes/${id}/`);
  const [page, setPage] = useState(1);
  const attempts = useWorkspaceResource<WorkspacePage<Attempt>>(teacher ? `/quiz-attempts/?quiz=${id}&page=${page}` : null);
  const quiz = resource.data;
  const refresh = teacher ? <Action loading={resource.loading || attempts.loading} onClick={() => { resource.refresh(); attempts.refresh(); }}>Refresh quiz</Action> : null;
  const header = embedded
    ? <header className={styles.detailHeading}><div><h2>{quiz?.title || 'Quiz'}</h2><p className={styles.muted}>{quiz?.course_title || 'Loading quiz details.'}</p></div>{refresh}</header>
    : <WorkspaceHeading title={quiz?.title || 'Quiz'} description={quiz?.course_title || 'Loading quiz details.'} />;
  return <>{header}
    <WorkspaceFeedback {...resource} hasData={!!quiz} onRetry={resource.refresh} />
    {quiz && (teacher ? <><QuizBuilder quiz={quiz} onSaved={resource.refresh} /><h2>Learner attempts</h2><WorkspaceFeedback {...attempts} hasData={!!attempts.data} onRetry={attempts.refresh} />
      {attempts.data?.results.map(attempt => <AttemptReview key={attempt.id} attempt={attempt} quiz={quiz} onSaved={attempts.refresh} />)}
      {attempts.data && attempts.data.count > 0 && <><p>{attempts.data.count} attempts recorded.</p><WorkspacePagination page={page} count={attempts.data.count} hasNext={!!attempts.data.next} loading={attempts.loading} onPage={setPage} /></>}
    </> : <LearnerAttempt quiz={quiz} onSaved={resource.refresh} />)}
  </>;
}
