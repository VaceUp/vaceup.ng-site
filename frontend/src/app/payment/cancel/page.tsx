'use client';

import React from 'react';
import Link from 'next/link';

export default function PaymentCancelPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-xl">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-gold-brand/15">
          <i className="bi bi-pause-circle text-4xl text-gold-700" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-navy-950">Payment paused — no charge made</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm text-gray-600">
          You closed the payment window before completing your purchase. Your cart and course
          selection are safe — pick up right where you left off whenever you&apos;re ready.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/checkout"
            className="rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
          >
            Resume Checkout
          </Link>
          <Link
            href="/courses"
            className="rounded-xl border-2 border-navy-900 py-3.5 font-bold text-navy-900 transition-colors hover:bg-navy-50"
          >
            Back to Courses
          </Link>
        </div>
        <p className="mt-6 text-xs text-gray-400">
        Questions? Reach us at info@vaceup.ng or on WhatsApp.
        </p>
      </div>
    </div>
  );
}
