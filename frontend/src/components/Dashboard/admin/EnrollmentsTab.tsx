'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Enrollments management — every enrollment on the platform, with status
 * and progress. Wired to /admin/dashboard/enrollments/.
 */

interface EnrollmentT {
  id: string;
  student_name: string;
  student_email: string;
  course_title: string;
  status: string;
  progress_percent: number;
  enrolled_at: string;
}

export function EnrollmentsTab() {
  const [enrollments, setEnrollments] = useState<EnrollmentT[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .request('/admin/dashboard/enrollments/')
      .then((res: any) => setEnrollments(res.results ?? res ?? []))
      .catch((err) => setError(err?.message || 'Failed to load enrollments.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = enrollments.filter(
    (e) =>
      !search ||
      e.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      e.student_email?.toLowerCase().includes(search.toLowerCase()) ||
      e.course_title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h3 className="mb-4 font-black text-navy-950">
          All Enrollments ({enrollments.length})
        </h3>
        <input
          type="text"
          placeholder="Search by student or course…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-navy-900 focus:bg-white focus:outline-none sm:max-w-md"
        />
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500">No enrollments match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                  <th className="pb-2 pr-4">Student</th>
                  <th className="pb-2 pr-4">Course</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2">Progress</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((e) => (
                  <tr key={e.id}>
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-navy-950">{e.student_name}</p>
                      <p className="text-xs text-gray-400">{e.student_email}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-700">{e.course_title}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-1 text-[11px] font-bold capitalize',
                          e.status === 'active'
                            ? 'bg-teal-brand/10 text-teal-700'
                            : e.status === 'completed'
                              ? 'bg-navy-50 text-navy-900'
                              : 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {e.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gold-brand"
                            style={{ width: `${Math.round(e.progress_percent ?? 0)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">
                          {Math.round(e.progress_percent ?? 0)}%
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

export default EnrollmentsTab;
