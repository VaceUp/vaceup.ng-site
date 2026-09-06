'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Assignments & Quizzes management — create assignments with deadlines,
 * grade submissions, create quizzes. Wired to live backend routes.
 */

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20';

interface AssignmentT {
  id: string;
  title: string;
  course_title?: string;
  due_at?: string;
  description?: string;
}

interface SubmissionT {
  id: string;
  student_name: string;
  assignment_title: string;
  status: string;
  score: string | null;
  feedback?: string;
  submitted_at: string;
}

interface QuizT {
  id: string;
  title: string;
  course_title?: string;
}

interface CourseOpt {
  id: string;
  title: string;
}

export function AssignmentsTab() {
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [assignments, setAssignments] = useState<AssignmentT[]>([]);
  const [quizzes, setQuizzes] = useState<QuizT[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionT[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [showQuizForm, setShowQuizForm] = useState(false);
  const [assignForm, setAssignForm] = useState({ course: '', title: '', description: '', due_at: '' });
  const [quizForm, setQuizForm] = useState({ course: '', title: '', description: '' });
  const [grading, setGrading] = useState<SubmissionT | null>(null);
  const [gradeForm, setGradeForm] = useState({ score: '', feedback: '' });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.request('/assignments/').then((res: any) => res.results ?? res ?? []),
      api.request('/admin/dashboard/submissions/').then((res: any) => res.results ?? res ?? []),
      api.request('/quizzes/').then((res: any) => res.results ?? res ?? []),
      api.request('/courses/').then((res: any) => res.results ?? res ?? []),
    ])
      .then(([a, s, q, c]) => {
        setAssignments(a);
        setSubmissions(s);
        setQuizzes(q);
        setCourses(c);
      })
      .catch((err) => setMsg({ ok: false, text: err?.message || 'Failed to load.' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.request('/assignments/', {
        method: 'POST',
        body: JSON.stringify({
          course: assignForm.course,
          title: assignForm.title,
          description: assignForm.description,
          due_at: assignForm.due_at ? new Date(assignForm.due_at).toISOString() : undefined,
        }),
      });
      setMsg({ ok: true, text: `Assignment “${assignForm.title}” created.` });
      setAssignForm({ course: '', title: '', description: '', due_at: '' });
      setShowAssignForm(false);
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.request('/quizzes/', {
        method: 'POST',
        body: JSON.stringify({
          course: quizForm.course,
          title: quizForm.title,
          description: quizForm.description,
        }),
      });
      setMsg({ ok: true, text: `Quiz “${quizForm.title}” created — add questions from Django admin or the builder.` });
      setQuizForm({ course: '', title: '', description: '' });
      setShowQuizForm(false);
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const gradeSubmission = async (sub: SubmissionT) => {
    setMsg(null);
    try {
      const assignment = assignments.find((a) => a.title === sub.assignment_title);
      if (!assignment) throw new Error('Matching assignment not found in this view.');
      await api.request(`/assignments/${assignment.id}/grade/`, {
        method: 'POST',
        body: JSON.stringify({
          submission_id: sub.id,
          score: parseFloat(gradeForm.score) || 0,
          feedback: gradeForm.feedback,
        }),
      });
      setMsg({ ok: true, text: `Graded ${sub.student_name}: ${gradeForm.score}` });
      setGrading(null);
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const pendingGrading = submissions.filter((s) => s.status === 'submitted' || s.status === 'in_progress');

  return (
    <div className="space-y-6">
      {msg && (
        <p
          className={cn(
            'rounded-xl px-4 py-3 text-sm',
            msg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
          )}
        >
          {msg.text}
        </p>
      )}

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => {
            setShowAssignForm((v) => !v);
            setShowQuizForm(false);
          }}
          className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-bold text-white"
        >
          + New Assignment
        </button>
        <button
          type="button"
          onClick={() => {
            setShowQuizForm((v) => !v);
            setShowAssignForm(false);
          }}
          className="rounded-xl border-2 border-navy-900 px-5 py-2.5 text-sm font-bold text-navy-900"
        >
          + New Quiz
        </button>
      </div>

      {showAssignForm && (
        <form onSubmit={handleCreateAssignment} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <select
              required
              value={assignForm.course}
              onChange={(e) => setAssignForm({ ...assignForm, course: e.target.value })}
              className={inputCls}
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              value={assignForm.due_at}
              onChange={(e) => setAssignForm({ ...assignForm, due_at: e.target.value })}
              className={inputCls}
            />
          </div>
          <input
            type="text"
            required
            placeholder="Assignment title"
            value={assignForm.title}
            onChange={(e) => setAssignForm({ ...assignForm, title: e.target.value })}
            className={inputCls}
          />
          <textarea
            rows={3}
            placeholder="Instructions…"
            value={assignForm.description}
            onChange={(e) => setAssignForm({ ...assignForm, description: e.target.value })}
            className={inputCls}
          />
          <button type="submit" className="rounded-xl bg-gold-brand px-8 py-3 font-bold text-navy-950">
            Create Assignment
          </button>
        </form>
      )}

      {showQuizForm && (
        <form onSubmit={handleCreateQuiz} className="space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <select
              required
              value={quizForm.course}
              onChange={(e) => setQuizForm({ ...quizForm, course: e.target.value })}
              className={inputCls}
            >
              <option value="">Select course…</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder="Quiz title"
              value={quizForm.title}
              onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
              className={inputCls}
            />
          </div>
          <textarea
            rows={2}
            placeholder="Description (optional)"
            value={quizForm.description}
            onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
            className={inputCls}
          />
          <button type="submit" className="rounded-xl bg-gold-brand px-8 py-3 font-bold text-navy-950">
            Create Quiz
          </button>
        </form>
      )}

      {/* Grading queue */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-black text-navy-950">Grading Queue</h3>
        <p className="mb-4 text-xs text-gray-500">
          {pendingGrading.length} submission{pendingGrading.length === 1 ? '' : 's'} waiting for a grade.
        </p>
        {pendingGrading.length === 0 ? (
          <p className="text-sm text-gray-500">All caught up! 🎉</p>
        ) : (
          <ul className="space-y-4">
            {pendingGrading.map((s) => (
              <li key={s.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-navy-950">{s.student_name}</p>
                    <p className="text-xs text-gray-500">
                      {s.assignment_title} · submitted {new Date(s.submitted_at).toLocaleDateString('en-NG')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setGrading(s);
                      setGradeForm({ score: '', feedback: '' });
                    }}
                    className="rounded-lg bg-gold-brand px-4 py-2 text-xs font-bold text-navy-950"
                  >
                    Grade
                  </button>
                </div>
                {grading?.id === s.id && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[100px_1fr_auto]">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="Score"
                      value={gradeForm.score}
                      onChange={(e) => setGradeForm({ ...gradeForm, score: e.target.value })}
                      className={cn(inputCls, 'py-2.5')}
                    />
                    <input
                      type="text"
                      placeholder="Feedback"
                      value={gradeForm.feedback}
                      onChange={(e) => setGradeForm({ ...gradeForm, feedback: e.target.value })}
                      className={cn(inputCls, 'py-2.5')}
                    />
                    <button
                      type="button"
                      onClick={() => gradeSubmission(s)}
                      className="rounded-xl bg-teal-brand px-5 py-2.5 text-sm font-bold text-white"
                    >
                      Submit Grade
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* All assignments */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-black text-navy-950">Assignments ({assignments.length})</h3>
        {assignments.length === 0 ? (
          <p className="text-sm text-gray-500">No assignments created.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {assignments.map((a) => (
              <li key={a.id} className="py-3">
                <p className="text-sm font-bold text-navy-950">{a.title}</p>
                <p className="text-xs text-gray-500">
                  {a.course_title} {a.due_at ? `· due ${new Date(a.due_at).toLocaleDateString('en-NG')}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Quizzes */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-black text-navy-950">Quizzes ({quizzes.length})</h3>
        {quizzes.length === 0 ? (
          <p className="text-sm text-gray-500">No quizzes created.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {quizzes.map((q) => (
              <li key={q.id} className="py-3">
                <p className="text-sm font-bold text-navy-950">{q.title}</p>
                <p className="text-xs text-gray-500">{q.course_title}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default AssignmentsTab;
