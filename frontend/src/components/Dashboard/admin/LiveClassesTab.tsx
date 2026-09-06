'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Live Classes management — schedule classes, manage join links,
 * view attendance/recordings. Wired to the live live-classes API.
 */

interface LiveClass {
  id: string;
  course: string;
  course_title?: string;
  title: string;
  description?: string;
  scheduled_start: string;
  duration_minutes: number;
  provider: string;
  join_url?: string;
  status?: string;
}

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20';

export function LiveClassesTab() {
  const [classes, setClasses] = useState<LiveClass[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    course: '',
    title: '',
    description: '',
    scheduled_start: '',
    duration_minutes: '90',
    provider: 'external',
    join_url: '',
  });

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.request('/live-classes/').then((res: any) => res.results ?? res ?? []),
      api.request('/courses/').then((res: any) => res.results ?? res ?? []),
    ])
      .then(([cls, crs]) => {
        setClasses(cls);
        setCourses(crs);
        setError('');
      })
      .catch((err) => setError(err?.message || 'Failed to load live classes.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      await api.request('/live-classes/', {
        method: 'POST',
        body: JSON.stringify({
          course: form.course,
          title: form.title,
          description: form.description,
          scheduled_start: new Date(form.scheduled_start).toISOString(),
          duration_minutes: parseInt(form.duration_minutes) || 90,
          provider: form.provider,
          join_url: form.join_url,
        }),
      });
      setMsg({ ok: true, text: `“${form.title}” scheduled. Students see it on their dashboard.` });
      setShowForm(false);
      setForm({
        course: '',
        title: '',
        description: '',
        scheduled_start: '',
        duration_minutes: '90',
        provider: 'external',
        join_url: '',
      });
      load();
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-black text-navy-950">Scheduled Live Classes</h3>
            <p className="text-xs text-gray-500">
              Classes appear on student dashboards with join links and reminders.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-xl bg-gold-brand px-5 py-2.5 text-sm font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
          >
            {showForm ? 'Close' : '+ Schedule Class'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mt-5 space-y-4 rounded-2xl bg-gray-50 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <select
                required
                value={form.course}
                onChange={(e) => setForm({ ...form, course: e.target.value })}
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
                placeholder="Class title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className={inputCls}
              />
              <input
                type="datetime-local"
                required
                value={form.scheduled_start}
                onChange={(e) => setForm({ ...form, scheduled_start: e.target.value })}
                className={inputCls}
              />
              <input
                type="number"
                required
                min="15"
                placeholder="Duration (minutes)"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                className={inputCls}
              />
              <select
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                className={inputCls}
              >
                <option value="external">External link (Google Meet / Zoom)</option>
                <option value="livekit">VaceUp Live Room (LiveKit)</option>
              </select>
              {form.provider === 'external' && (
                <input
                  type="url"
                  placeholder="Meeting link (https://meet.google.com/…)"
                  value={form.join_url}
                  onChange={(e) => setForm({ ...form, join_url: e.target.value })}
                  className={inputCls}
                />
              )}
            </div>
            <textarea
              rows={2}
              placeholder="Class agenda / description (optional)"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className={inputCls}
            />
            <button
              type="submit"
              className="rounded-xl bg-gold-brand px-8 py-3 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
            >
              Schedule Class
            </button>
          </form>
        )}
      </div>

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

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-red-50 p-6 text-sm text-red-700">{error}</div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No live classes scheduled yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {classes.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy-950">{c.title}</p>
                <p className="text-xs text-gray-500">
                  {c.course_title} ·{' '}
                  {new Date(c.scheduled_start).toLocaleString('en-NG')} ·{' '}
                  {c.duration_minutes} min ·{' '}
                  <span className="capitalize">{c.provider}</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                {c.join_url && (
                  <a
                    href={c.join_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                  >
                    Open link
                  </a>
                )}
                <a
                  href={`/liveclasses/${c.id}`}
                  className="rounded-lg bg-gold-brand px-3 py-1.5 text-xs font-bold text-navy-950"
                >
                  Classroom
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default LiveClassesTab;
