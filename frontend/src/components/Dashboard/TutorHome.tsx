'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface InstructorStats {
  courses: { total: number; published: number };
  students: number;
  enrollments: { active: number; completed: number };
  revenue: string;
  upcoming_classes: { title?: string; course_title?: string; scheduled_at?: string }[];
  recent_enrollments: {
    student_name: string;
    course_title: string;
    progress_percent: string;
    enrolled_at: string;
  }[];
}

function Stat({
  icon,
  label,
  value,
  accent = 'navy',
}: {
  icon: string;
  label: string;
  value: React.ReactNode;
  accent?: 'navy' | 'gold' | 'teal';
}) {
  const accents = {
    navy: 'bg-navy-50 text-navy-900',
    gold: 'bg-gold-light text-gold-800',
    teal: 'bg-teal-brand/10 text-teal-700',
  };
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', accents[accent])}>
          <i className={cn('bi', icon)} aria-hidden="true" />
        </span>
      </div>
      <div className="text-3xl font-black text-navy-950">{value}</div>
      <div className="mt-1 text-sm text-gray-500">{label}</div>
    </div>
  );
}

export function TutorHome() {
  const [stats, setStats] = useState<InstructorStats | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.request('/instructor/dashboard/'), api.request('/instructor/students/')])
      .then(([dash, studs]) => {
        if (cancelled) return;
        setStats(dash as InstructorStats);
        setStudents(Array.isArray(studs) ? studs : (studs as any)?.results ?? []);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message || 'Could not load your dashboard.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-700">
        {error} — if this persists, the instructor endpoints may need your tutor role assigned
        by an admin.
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-gray-200" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-200" />
          ))}
        </div>
      </div>
    );
  }

  const money = (v: string) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(parseFloat(v || '0'));

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat icon="bi-book" label="Courses" value={stats.courses?.total ?? 0} />
        <Stat icon="bi-eye" label="Published" value={stats.courses?.published ?? 0} accent="teal" />
        <Stat icon="bi-people" label="Students" value={stats.students} />
        <Stat icon="bi-activity" label="Active Enrollments" value={stats.enrollments?.active ?? 0} accent="gold" />
        <Stat icon="bi-cash-coin" label="Revenue" value={money(stats.revenue)} accent="gold" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent enrollments */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-black text-navy-950">Recent Enrollments</h3>
          {(stats.recent_enrollments || []).length === 0 ? (
            <p className="text-sm text-gray-500">No enrollments yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.recent_enrollments.map((e, i) => (
                <li key={i} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-bold text-navy-950">{e.student_name}</p>
                    <p className="text-xs text-gray-500">{e.course_title}</p>
                  </div>
                  <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-bold text-navy-900">
                    {e.progress_percent}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Upcoming classes */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 font-black text-navy-950">Upcoming Classes</h3>
          {(stats.upcoming_classes || []).length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming classes scheduled.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {stats.upcoming_classes.map((c: any, i: number) => (
                <li key={i} className="flex items-center gap-3 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-brand/15 text-gold-700">
                    <i className="bi bi-camera-video" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-navy-950">
                      {c.title || c.course_title || 'Live class'}
                    </p>
                    {c.scheduled_at && (
                      <p className="text-xs text-gray-500">
                        {new Date(c.scheduled_at).toLocaleString('en-NG')}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Students */}
      <div id="students" className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-black text-navy-950">My Students</h3>
        {students.length === 0 ? (
          <p className="text-sm text-gray-500">No students assigned yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {students.map((s: any, i: number) => (
                  <tr key={s.id ?? i}>
                    <td className="py-3 pr-4 font-semibold text-navy-950">
                      {s.student_name || s.full_name || s.name || '—'}
                    </td>
                    <td className="py-3 pr-4 text-gray-600">
                      {s.course_title || s.course || '—'}
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gold-brand"
                            style={{ width: `${Math.round(parseFloat(s.progress_percent ?? s.progress ?? 0))}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(parseFloat(s.progress_percent ?? s.progress ?? 0))}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default TutorHome;
