'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { failureMessage } from '@/lib/course-management';
import type { Quiz, Question } from '@/lib/assessment-api';
import { Action, Field, Feedback, styles } from './admin/AuthoringUI';

interface DraftQuestion { question_text: string; question_type: Question['question_type']; choices: { choice_text: string; is_correct: 'correct' | 'incorrect' }[]; }
const emptyQuestion = (): DraftQuestion => ({ question_text: '', question_type: 'mcq', choices: [{ choice_text: '', is_correct: 'correct' }, { choice_text: '', is_correct: 'incorrect' }] });
export default function QuizBuilder({ quiz, onSaved }: { quiz: Quiz; onSaved: () => void }) {
  const [questions, setQuestions] = useState<DraftQuestion[]>(quiz.questions.map(q => ({ question_text: q.question_text, question_type: q.question_type, choices: q.choices.map(c => ({ choice_text: c.choice_text, is_correct: c.is_correct || 'incorrect' })) })));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);
  const change = (next: DraftQuestion[]) => { setQuestions(next); setDirty(true); setNotice(''); };
  const update = (index: number, row: DraftQuestion) => change(questions.map((q, i) => i === index ? row : q));
  const [title, setTitle] = useState(quiz.title), [description, setDescription] = useState(quiz.description);
  const [limit, setLimit] = useState(quiz.time_limit_minutes), [pass, setPass] = useState(quiz.pass_mark);
  async function saveSettings(publish = false) {
    setBusy(true); setError(''); setNotice('');
    try { await api.request(`/quizzes/${quiz.id}/`, { method: 'PATCH', body: JSON.stringify({ title, description, time_limit_minutes: limit, pass_mark: pass, ...(publish ? { status: 'published' } : {}) }) }); setNotice(publish ? 'Quiz published for enrolled learners.' : 'Quiz settings saved.'); onSaved(); }
    catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
  }
  return <section className={styles.stack} aria-label="Quiz builder">
    <p className={styles.muted}>Each question carries equal weight. Multiple-choice and true/false questions are marked automatically; short answers require tutor review. Questions cannot change after a learner starts.</p>
    <Feedback error={error} message={notice} />
    <form className={`${styles.panel} ${styles.stack}`} aria-label="Quiz settings" onSubmit={e => { e.preventDefault(); void saveSettings(); }}><fieldset className={styles.stack} disabled={busy}>
      <Field label="Quiz title"><input required maxLength={200} value={title} onChange={e => setTitle(e.target.value)} /></Field><Field label="Quiz instructions"><textarea rows={4} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} /></Field>
      <div className={styles.grid}><Field label="Time limit (minutes)"><input required type="number" min="1" max="1440" value={limit} onChange={e => setLimit(Number(e.target.value))} /></Field><Field label="Pass mark (%)"><input required type="number" min="0" max="100" step="0.01" value={pass} onChange={e => setPass(e.target.value)} /></Field></div>
    </fieldset><div><Action type="submit" loading={busy}>Save quiz settings</Action></div></form>
    {quiz.status === 'draft' ? <form className={styles.stack} aria-label="Quiz questions" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); setNotice('');
      try { await api.request(`/quizzes/${quiz.id}/builder/`, { method: 'PUT', body: JSON.stringify({ questions }) }); setDirty(false); setNotice('Questions saved. Review them before publishing.'); onSaved(); }
      catch (err) { setError(failureMessage(err)); } finally { setBusy(false); }
    }}><fieldset className={styles.stack} disabled={busy}>{questions.map((q, index) => <section key={index} className={`${styles.panel} ${styles.stack}`} aria-label={`Question ${index + 1}`}><h3>Question {index + 1}</h3>
      <Field label="Question text"><textarea rows={3} maxLength={10000} required value={q.question_text} onChange={e => update(index, { ...q, question_text: e.target.value })} /></Field>
      <Field label="Question type"><select value={q.question_type} onChange={e => { const kind = e.target.value as Question['question_type']; update(index, { ...q, question_type: kind, choices: kind === 'short_answer' ? [] : kind === 'true_false' ? [{ choice_text: 'True', is_correct: 'correct' }, { choice_text: 'False', is_correct: 'incorrect' }] : emptyQuestion().choices }); }}><option value="mcq">Multiple choice</option><option value="true_false">True or false</option><option value="short_answer">Short answer</option></select></Field>
      {q.choices.map((c, ci) => <div key={ci} className={styles.row}><Field label={`Option ${ci + 1}`}><input required maxLength={500} value={c.choice_text} onChange={e => update(index, { ...q, choices: q.choices.map((choice, i) => i === ci ? { ...choice, choice_text: e.target.value } : choice) })} /></Field>
        <label className={styles.check}><input type="radio" name={`correct-${index}`} checked={c.is_correct === 'correct'} onChange={() => update(index, { ...q, choices: q.choices.map((choice, i) => ({ ...choice, is_correct: i === ci ? 'correct' : 'incorrect' })) })} />Correct option {ci + 1}</label>
        {q.question_type === 'mcq' && q.choices.length > 2 && <Action intent="danger" onClick={() => update(index, { ...q, choices: q.choices.filter((_, i) => i !== ci) })}>Remove option {ci + 1}</Action>}</div>)}
      <div className={styles.row}>{q.question_type === 'mcq' && q.choices.length < 8 && <Action onClick={() => update(index, { ...q, choices: [...q.choices, { choice_text: '', is_correct: 'incorrect' }] })}>Add option</Action>}
        <Action disabled={index === 0} onClick={() => { const next = [...questions]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; change(next); }}>Move question up</Action>
        <Action intent="danger" onClick={() => change(questions.filter((_, i) => i !== index))}>Remove question {index + 1}</Action></div>
    </section>)}</fieldset>
      <div className={styles.row}><Action disabled={busy || questions.length >= 100} onClick={() => change([...questions, emptyQuestion()])}>Add question</Action><Action type="submit" intent="primary" disabled={!questions.length} loading={busy}>Save questions</Action></div>
      <p className={styles.muted}>{dirty ? 'Question changes are not saved yet.' : quiz.questions.length ? 'Questions are saved on the server.' : 'Add and save at least one question before publishing.'} Leaving this page discards unsaved edits.</p>
    </form> : <div className={styles.panel}><h3>Published questions</h3><ol className={styles.list}>{quiz.questions.map(q => <li key={q.id}>{q.question_text} ({q.question_type.replace('_', ' ')})</li>)}</ol><p>Published questions are read-only. Create a new quiz if learners have already started this one.</p></div>}
    {quiz.status === 'draft' && <div><Action intent="primary" disabled={busy || dirty || !quiz.questions.length} loading={busy} onClick={() => void saveSettings(true)}>Publish quiz</Action></div>}
  </section>;
}
