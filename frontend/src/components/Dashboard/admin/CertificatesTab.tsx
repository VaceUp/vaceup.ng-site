'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Certificates management — list all issued certificates (admin sees all),
 * download PDF, open the public verify page, revoke bad ones.
 */

interface CertificateT {
  id: string;
  certificate_number: string;
  student_name?: string;
  student?: { full_name: string };
  course_title?: string;
  course?: { title: string } | string;
  issued_at?: string;
  status?: string;
}

export function CertificatesTab() {
  const [certs, setCerts] = useState<CertificateT[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api
      .request('/certificates/')
      .then((res: any) => setCerts(res.results ?? res ?? []))
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const revoke = async (cert: CertificateT) => {
    if (!window.confirm(`Revoke certificate ${cert.certificate_number}? This cannot be undone.`)) return;
    try {
      await api.request(`/certificates/${cert.certificate_number}/revoke/`, { method: 'POST' });
      setMsg({ id: cert.id, ok: true, text: 'Certificate revoked.' });
      load();
    } catch (err: any) {
      setMsg({ id: cert.id, ok: false, text: err.message });
    }
  };

  const studentName = (c: CertificateT) =>
    c.student_name || c.student?.full_name || 'Student';
  const courseTitle = (c: CertificateT) =>
    c.course_title || (typeof c.course === 'object' ? c.course?.title : c.course) || 'Course';

  const filtered = certs.filter(
    (c) =>
      !search ||
      studentName(c).toLowerCase().includes(search.toLowerCase()) ||
      String(c.certificate_number).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Search by student or certificate number…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm focus:border-navy-900 focus:bg-white focus:outline-none"
        />
        <a
          href="/verify"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border-2 border-navy-900 px-5 py-2.5 text-center text-sm font-bold text-navy-900 hover:bg-navy-50"
        >
          Open Verify Page
        </a>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
          No certificates issued yet. Certificates are generated automatically when students
          complete their courses.
        </div>
      ) : (
        <ul className="space-y-3">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy-950">
                  {studentName(c)}
                  {c.status === 'revoked' && (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                      REVOKED
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {courseTitle(c)} ·{' '}
                  <span className="font-mono">{c.certificate_number}</span>
                  {c.issued_at && (
                    <> · issued {new Date(c.issued_at).toLocaleDateString('en-NG')}</>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`${api.baseUrl}/certificates/${c.certificate_number}/pdf/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                >
                  PDF
                </a>
                <a
                  href={`/verify?code=${c.certificate_number}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-navy-50 px-3 py-1.5 text-xs font-bold text-navy-900 hover:bg-navy-100"
                >
                  Verify
                </a>
                {c.status !== 'revoked' && (
                  <button
                    type="button"
                    onClick={() => revoke(c)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100"
                  >
                    Revoke
                  </button>
                )}
              </div>
              {msg?.id === c.id && (
                <p
                  className={cn(
                    'w-full rounded-lg px-3 py-2 text-xs',
                    msg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700'
                  )}
                >
                  {msg.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default CertificatesTab;
