'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/** Route-level boundary: turns an opaque failure into a readable, reportable
 * one. The real error text is shown on purpose - support tickets used to say
 * only "500" because the old static export had no boundary at all. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the cause in the console of whatever device hit it.
    console.error('Page error:', error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-2xl flex-col items-start justify-center gap-6 px-6 py-16">
      <h1 className="text-2xl font-bold text-navy-950">This page hit an unexpected error</h1>
      <p className="text-sm leading-relaxed text-gray-600">
        Your work is safe. Try again, and if it keeps happening, send the details below to the VaceUp team.
      </p>
      <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-4">
        <p className="break-words font-mono text-xs leading-relaxed text-gray-700">
          {error.message || 'Unknown error'}
          {error.digest ? ` (ref: ${error.digest})` : ''}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-gold-brand px-5 py-2.5 text-sm font-bold text-navy-950 shadow-md transition-transform active:scale-95"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg bg-gray-100 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-200"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
