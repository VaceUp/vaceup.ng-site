'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Course Content Manager — modules and lessons (with video links) per course.
 * Wired to /modules/ and /lessons/ backend CRUD.
 */

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20';

interface ModuleT {
  id: string;
  course: string;
  title: string;
  order: number;
  lessons: { id: string; title: string; video_url: string }[];
}

export function ContentTab() {
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [courseId, setCourseId] = useState('');
  const [modules, setModules] = useState<ModuleT[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, { title: string; video_url: string }>>({});

  useEffect(() => {
    api
      .request('/courses/')
      .then((res: any) => setCourses(res.results ?? res ?? []))
      .catch(() => undefined);
  }, []);

  const loadModules = useCallback((cid: string) => {
    setLoading(true);
    api
      .request('/modules/')
      .then((res: any) => {
        const all = res.results ?? res ?? [];
        setModules(all.filter((m: ModuleT) => m.course === cid));
      })
      .catch(() => setModules([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (courseId) loadModules(courseId);
    else setModules([]);
  }, [courseId, loadModules]);

  const addModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId || !newModuleTitle.trim()) return;
    try {
      await api.request('/modules/', {
        method: 'POST',
        body: JSON.stringify({ course: courseId, title: newModuleTitle.trim() }),
      });
      setNewModuleTitle('');
      loadModules(courseId);
      setMsg({ ok: true, text: 'Module added.' });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const addLesson = async (moduleId: string) => {
    const draft = lessonDrafts[moduleId] ?? { title: '', video_url: '' };
    if (!draft.title.trim()) return;
    try {
      await api.request('/lessons/', {
        method: 'POST',
        body: JSON.stringify({
          module: moduleId,
          title: draft.title.trim(),
          video_url: draft.video_url.trim(),
        }),
      });
      setLessonDrafts((prev) => ({ ...prev, [moduleId]: { title: '', video_url: '' } }));
      loadModules(courseId);
      setMsg({ ok: true, text: 'Lesson added.' });
    } catch (err: any) {
      setMsg({ ok: false, text: err.message });
    }
  };

  const removeLesson = async (lessonId: string) => {
    if (!window.confirm('Delete this lesson?')) return;
    await api.request(`/lessons/${lessonId}/`, { method: 'DELETE' }).catch(() => undefined);
    loadModules(courseId);
  };

  const removeModule = async (moduleId: string) => {
    if (!window.confirm('Delete this module and its lessons?')) return;
    await api.request(`/modules/${moduleId}/`, { method: 'DELETE' }).catch(() => undefined);
    loadModules(courseId);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-1 font-black text-navy-950">Course Content Manager</h3>
        <p className="mb-4 text-xs text-gray-500">
          Build each course: add modules, then add lessons with video links inside them.
        </p>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className={cn(inputCls, 'sm:max-w-md')}
        >
          <option value="">Select a course to manage…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>

      {courseId && (
        <>
          <form
            onSubmit={addModule}
            className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:flex-row"
          >
            <input
              type="text"
              required
              placeholder="New module title (e.g. Week 1: Foundations)"
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              className={cn(inputCls, 'flex-1')}
            />
            <button
              type="submit"
              className="rounded-xl bg-navy-950 px-6 py-3 text-sm font-bold text-white"
            >
              Add Module
            </button>
          </form>

          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : modules.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              No modules in this course yet — add the first one above.
            </div>
          ) : (
            <div className="space-y-4">
              {modules.map((m, mi) => (
                <div key={m.id} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <h4 className="font-black text-navy-950">
                      Module {mi + 1}: {m.title}
                    </h4>
                    <button
                      type="button"
                      onClick={() => removeModule(m.id)}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                    >
                      Delete module
                    </button>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {(m.lessons ?? []).map((l, li) => (
                      <li
                        key={l.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-4 py-2.5"
                      >
                        <span className="text-sm text-navy-950">
                          <span className="mr-2 text-xs font-bold text-gray-400">{mi + 1}.{li + 1}</span>
                          {l.title}
                          {l.video_url && (
                            <a
                              href={l.video_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-2 text-xs text-teal-700 hover:underline"
                            >
                              video
                            </a>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLesson(l.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>

                  {/* Add lesson inline */}
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="text"
                      placeholder="New lesson title"
                      value={lessonDrafts[m.id]?.title ?? ''}
                      onChange={(e) =>
                        setLessonDrafts((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], title: e.target.value },
                        }))
                      }
                      className={cn(inputCls, 'py-2.5')}
                    />
                    <input
                      type="url"
                      placeholder="Video link (optional)"
                      value={lessonDrafts[m.id]?.video_url ?? ''}
                      onChange={(e) =>
                        setLessonDrafts((prev) => ({
                          ...prev,
                          [m.id]: { ...prev[m.id], video_url: e.target.value },
                        }))
                      }
                      className={cn(inputCls, 'py-2.5')}
                    />
                    <button
                      type="button"
                      onClick={() => addLesson(m.id)}
                      className="rounded-xl bg-gold-brand px-5 py-2.5 text-sm font-bold text-navy-950"
                    >
                      Add Lesson
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

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
        </>
      )}
    </div>
  );
}

export default ContentTab;
