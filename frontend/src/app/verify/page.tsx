'use client';

import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

/**
 * Public certificate verification (PRD §13) — the target of the QR code
 * on every certificate. Reads ?code= and checks it against the backend
 * verification endpoint (pending — see MISSING-ENDPOINTS.md).
 */
export default function VerifyPage() {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [detail, setDetail] = useState<{
    student_name: string;
    course: string;
    issued_at: string;
    certificate_number: string;
  } | null>(null);

  const check = async (value: string) => {
    if (!value.trim()) return;
    setStatus('checking');
    try {
      const res = await api.getCertificate(value.trim());
      setDetail({
        student_name: (res as any).student_name || 'Verified holder',
        course: (res as any).course?.title || (res as any).course || 'VaceUp Course',
        issued_at: (res as any).issued_at || '',
        certificate_number: (res as any).certificate_number || value.trim(),
      });
      setStatus('valid');
    } catch {
      setStatus('invalid');
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const preset = params.get('code');
    if (preset) {
      setCode(preset);
      check(preset);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-gold-brand/10 px-4 py-1.5 text-sm font-semibold text-gold-brand">
            <i className="bi bi-patch-check" aria-hidden="true" /> Certificate Verification
          </span>
          <h1 className="mt-6 text-4xl font-black">Verify a VaceUp certificate</h1>
          <p className="mx-auto mt-3 max-w-xl text-navy-200">
            Every VaceUp certificate carries a unique code. Enter it here (or scan the QR code on
            the certificate) to confirm it is genuine.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-2xl px-6 py-12">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            check(code);
          }}
          className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8"
        >
          <label htmlFor="cert-code" className="mb-2 block text-sm font-bold text-navy-950">
            Certificate code
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="cert-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. VU-2026-XXXX-XXXX"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 font-mono text-sm uppercase transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
            />
            <button
              type="submit"
              disabled={status === 'checking'}
              className="whitespace-nowrap rounded-xl bg-gold-brand px-8 py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover disabled:opacity-60"
            >
              {status === 'checking' ? 'Checking…' : 'Verify'}
            </button>
          </div>
        </form>

        {status === 'valid' && detail && (
          <div className="mt-6 rounded-3xl border-2 border-teal-brand/40 bg-teal-brand/5 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-brand/15">
              <i className="bi bi-patch-check-fill text-3xl text-teal-brand" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-black text-navy-950">Genuine certificate</h2>
            <p className="mt-1 text-sm text-gray-600">
              This certificate was issued by VaceUp Digital Academy.
            </p>
            <dl className="mx-auto mt-6 max-w-sm space-y-2 text-left text-sm">
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="font-bold text-navy-950">Holder</dt>
                <dd className="text-gray-700">{detail.student_name}</dd>
              </div>
              <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                <dt className="font-bold text-navy-950">Course</dt>
                <dd className="text-gray-700">{detail.course}</dd>
              </div>
              {detail.issued_at && (
                <div className="flex justify-between gap-4 border-b border-gray-200 pb-2">
                  <dt className="font-bold text-navy-950">Issued</dt>
                  <dd className="text-gray-700">
                    {new Date(detail.issued_at).toLocaleDateString('en-NG', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="font-bold text-navy-950">Number</dt>
                <dd className="font-mono text-gray-700">{detail.certificate_number}</dd>
              </div>
            </dl>
          </div>
        )}

        {status === 'invalid' && (
          <div className="mt-6 rounded-3xl border-2 border-red-200 bg-red-50 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <i className="bi bi-x-circle-fill text-3xl text-red-500" aria-hidden="true" />
            </div>
            <h2 className="text-2xl font-black text-navy-950">No matching certificate</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
              We could not find a certificate with the code{' '}
              <span className="font-mono font-bold">{code}</span>. Double-check the code — or if
              you believe this certificate is genuine, contact us at info@vaceup.ng.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
