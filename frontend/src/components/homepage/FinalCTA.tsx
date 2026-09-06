'use client';

import React from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';

/**
 * Full-width closing call-to-action (PRD §13):
 * "Your Digital Career Starts Here." with Explore Courses + Talk to Us.
 */
export function FinalCTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy-900 via-navy-950 to-navy-950 py-20" aria-labelledby="final-cta-heading">
      {/* Gold glow accents */}
      <div
        className="pointer-events-none absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-gold-brand/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-teal-brand/10 blur-3xl"
        aria-hidden="true"
      />

      <Reveal className="relative mx-auto max-w-4xl px-6 text-center">
        <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-2 text-sm font-semibold text-gold-brand">
          Your move
        </span>
        <h2
          id="final-cta-heading"
          className="mt-6 text-4xl font-black leading-tight text-white sm:text-5xl"
        >
          Your Digital Career <span className="text-gold-brand">Starts Here.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg text-navy-200">
          Join the academy turning ambition into employable, verifiable digital skills —
          one cohort at a time.
        </p>
        <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/courses"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold-brand px-8 py-4 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover active:scale-95 sm:w-auto"
          >
            Explore Courses
            <i className="bi bi-arrow-right" aria-hidden="true" />
          </Link>
          <Link
            href="/contact"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-2 border-white/30 px-8 py-4 font-bold text-white transition-colors hover:border-white hover:bg-white/10 sm:w-auto"
          >
            <i className="bi bi-chat-dots" aria-hidden="true" />
            Talk to Us
          </Link>
        </div>
        <p className="mt-6 text-xs text-navy-300">
          Next cohort starts 21 September 2026 · Limited seats per course
        </p>
      </Reveal>
    </section>
  );
}

export default FinalCTA;
