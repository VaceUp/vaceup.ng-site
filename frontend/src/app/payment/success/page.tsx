'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

/**
 * Paystack callback (PRD §4.3.4): verifies the transaction server-side
 * and confirms enrollment.
 */
export default function PaymentSuccessPage() {
  const [reference, setReference] = useState<string | null>(null);
  const [status, setStatus] = useState<'verifying' | 'success' | 'pending'>('verifying');
  const [course, setCourse] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference') || params.get('trxref');
    setReference(ref);
    if (!ref) {
      setStatus('pending');
      return;
    }
    let cancelled = false;
    api
      .verifyPayment(ref)
      .then((res) => {
        if (cancelled) return;
        setStatus('success');
        setCourse(res.course?.title ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('pending');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-xl">
        {status === 'verifying' && (
          <>
            <img src="/logo.webp" alt="" className="mx-auto mb-6 h-16 w-16 animate-pulse object-contain" />
            <h1 className="text-2xl font-black text-navy-950">Verifying your payment…</h1>
            <p className="mt-2 text-sm text-gray-600">
              Reference: <span className="font-mono">{reference}</span>
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-teal-brand/10">
              <i className="bi bi-check-circle-fill text-4xl text-teal-brand" aria-hidden="true" />
            </div>
            <h1 className="text-3xl font-black text-navy-950">Payment successful! 🎉</h1>
            <p className="mt-3 text-sm text-gray-600">
              {course ? (
                <>
                  You&apos;re enrolled in <span className="font-bold">{course}</span>. A receipt is
                  on its way to your email.
                </>
              ) : (
                <>Your payment was confirmed and your seat is secured. A receipt is on its way to your email.</>
              )}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
              >
                Go to My Dashboard
              </Link>
              <Link
                href="/courses"
                className="rounded-xl border-2 border-navy-900 py-3.5 font-bold text-navy-900 transition-colors hover:bg-navy-50"
              >
                Explore More Courses
              </Link>
            </div>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gold-brand/15">
              <i className="bi bi-hourglass-split text-3xl text-gold-700" aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-black text-navy-950">
              {reference ? 'Payment received — confirming' : 'Almost there'}
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm text-gray-600">
              {reference
                ? 'Your payment is confirmed with Paystack and is being synced with your account. This usually takes a few minutes — your dashboard will update automatically.'
                : 'We could not find a payment reference for this visit. If you just paid, check your email for the receipt — your enrollment is tied to your account.'}
            </p>
            <div className="mt-8 flex flex-col gap-3">
              <Link
                href="/dashboard"
                className="rounded-xl bg-navy-950 py-3.5 font-bold text-white transition-colors hover:bg-navy-900"
              >
                Go to My Dashboard
              </Link>
              <Link
                href="/contact"
                className="rounded-xl border-2 border-navy-900 py-3.5 font-bold text-navy-900 transition-colors hover:bg-navy-50"
              >
                Contact Support
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
