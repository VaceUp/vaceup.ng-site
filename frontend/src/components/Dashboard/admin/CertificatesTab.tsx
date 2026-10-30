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

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20';

export function CertificatesTab() {
  const [certs, setCerts] = useState<CertificateT[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ id: string; ok: boolean; text: string } | null>(null);
  const [search, setSearch] = useState('');

  // Issue studio
  const [students, setStudents] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [courses, setCourses] = useState<{ id: string; title: string }[]>([]);
  const [issueSel, setIssueSel] = useState({ student_id: '', course_id: '' });
  const [issuing, setIssuing] = useState(false);
  const [issueMsg, setIssueMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    api
      .request('/admin/dashboard/users/?role=student')
      .then((res: any) => setStudents(res.results ?? res ?? []))
      .catch(() => undefined);
    api
      .request('/admin/dashboard/courses/')
      .then((res: any) => setCourses(res.results ?? res ?? []))
      .catch(() => undefined);
  }, []);

  const [preview, setPreview] = useState<{ html: string; template: string } | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    if (!issueSel.student_id || !issueSel.course_id) {
      setPreview(null); setPreviewError(''); setPreviewBusy(false);
      return;
    }
    let active = true;
    setPreviewBusy(true); setPreviewError('');
    api.request<{ html: string; template: string }>(
      `/certificates/templates/preview/?course=${encodeURIComponent(issueSel.course_id)}&student=${encodeURIComponent(issueSel.student_id)}`,
    )
      .then((result) => { if (active) { setPreview(result); setPreviewError(''); } })
      .catch((err: unknown) => {
        if (!active) return;
        setPreview(null);
        setPreviewError(err instanceof Error ? err.message : 'The certificate design could not be previewed.');
      })
      .finally(() => { if (active) setPreviewBusy(false); });
    return () => { active = false; };
  }, [issueSel.student_id, issueSel.course_id]);

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueMsg(null);
    if (!issueSel.student_id || !issueSel.course_id) {
      setIssueMsg({ ok: false, text: 'Select the student and the course.' });
      return;
    }
    setIssuing(true);
    try {
      const res = await fetch(`${api.baseUrl}/admin/dashboard/certificates/issue/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${api.getToken()}`,
        },
        body: JSON.stringify(issueSel),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error?.detail || 'Issuing failed.');
      }
      setIssueMsg({
        ok: true,
        text: `Certificate ${data.certificate_number} issued to ${data.student_name}.`,
      });
      load();
    } catch (err: any) {
      setIssueMsg({ ok: false, text: err.message });
    } finally {
      setIssuing(false);
    }
  };

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

      {/* ═══ Issue Certificate studio ═══ */}
      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <form onSubmit={handleIssue} className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-1 font-black text-navy-950">Issue a Certificate</h3>
          <p className="mb-5 text-xs text-gray-500">
            Select the student and the course — the preview updates live, then issue it.
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Student</label>
              <select required value={issueSel.student_id}
                onChange={(e) => setIssueSel({ ...issueSel, student_id: e.target.value })}
                className={inputCls}>
                <option value="">Select student...</option>
                {students.map((st) => (
                  <option key={st.id} value={st.id}>{st.full_name || st.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-400">Course</label>
              <select required value={issueSel.course_id}
                onChange={(e) => setIssueSel({ ...issueSel, course_id: e.target.value })}
                className={inputCls}>
                <option value="">Select course...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={issuing}
              className="w-full rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover disabled:opacity-60">
              {issuing ? 'Issuing...' : 'Issue Certificate'}
            </button>
            {issueMsg && (
              <p className={cn('rounded-xl px-4 py-3 text-xs',
                issueMsg.ok ? 'bg-teal-brand/10 text-teal-700' : 'bg-red-50 text-red-700')}>
                {issueMsg.text}
              </p>
            )}
          </div>
        </form>

        {/* Live preview — rendered by the same code that issues the PDF */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Certificate preview</p>
            {preview && <p className="text-xs text-gray-500">Design: {preview.template}</p>}
          </div>
          {!issueSel.student_id || !issueSel.course_id ? (
            <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
              Choose a student and a course to see the exact certificate they would receive.
            </div>
          ) : previewBusy && !preview ? (
            <div className="min-h-40 animate-pulse rounded-xl bg-gray-100" aria-busy="true" />
          ) : previewError ? (
            <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{previewError}</p>
          ) : preview ? (
            <iframe
              title="Certificate preview"
              srcDoc={preview.html}
              sandbox=""
              className="aspect-[297/210] w-full rounded-xl border border-gray-200 bg-white"
            />
          ) : null}
          <p className="mt-3 text-center text-xs text-gray-400">
            Names, dates and the verification code come from the real course records.
          </p>
        </div>
      </div>

      {/* ═══ Issued certificates list ═══ */}
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
