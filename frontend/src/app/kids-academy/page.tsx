'use client';

import { useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { SITE } from '@/lib/site-config';

export default function KidsAcademyRedirect() {
  useEffect(() => {
    window.location.replace(SITE.kidsUrl);
  }, []);

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-6 py-20 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-brand">VaceUp Kids Tech Academy</p>
      <h1 className="mt-4 text-3xl font-black text-navy-950">The kids experience has moved.</h1>
      <p className="mt-4 leading-7 text-content-secondary">We are opening the dedicated Kids Academy site in a new moment. If you are not redirected automatically, use the button below.</p>
      <a href={SITE.kidsUrl} className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-5 py-3 font-bold text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-950">Open Kids Academy <ArrowUpRight aria-hidden="true" className="size-4" /></a>
    </main>
  );
}
