'use client';

import React from 'react';
import Link from 'next/link';
import { Reveal } from '@/components/ui/Reveal';

/**
 * The 6-step admission journey (PRD §6). Anchored at #how-it-works —
 * the hero's "Watch How It Works" CTA scrolls here.
 */
const STEPS = [
  {
    icon: 'bi-grid',
    title: 'Select your course',
    text: 'Explore our practical programs and choose the one that matches your career goal.',
  },
  {
    icon: 'bi-person-plus',
    title: 'Create your account',
    text: 'Register in under two minutes — this connects you to your tutors, classes and support.',
  },
  {
    icon: 'bi-file-earmark-text',
    title: 'Complete your application',
    text: 'A short application tells us who you are and what you want to achieve.',
  },
  {
    icon: 'bi-credit-card',
    title: 'Make secure payment',
    text: 'Pay safely in Naira via Paystack — card, transfer or USSD. Instant confirmation.',
  },
  {
    icon: 'bi-envelope-check',
    title: 'Receive confirmation',
    text: 'You get an email with your cohort start date, timetable and everything you need.',
  },
  {
    icon: 'bi-rocket-takeoff',
    title: 'Start learning',
    text: 'Join live classes, access materials, submit assignments and build real portfolio work.',
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-navy-950 py-20"
      aria-labelledby="how-heading"
    >
      <div className="mx-auto max-w-7xl px-6">
        <Reveal>
          <div className="mb-14 text-center">
            <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-2 text-sm font-semibold text-gold-brand">
              How It Works
            </span>
            <h2 id="how-heading" className="mt-4 text-3xl font-black text-white sm:text-4xl">
              From zero to enrolled in one day
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-navy-200">
              Six simple steps stand between you and your first live class.
            </p>
          </div>
        </Reveal>

        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.06}>
              <li className="relative h-full rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-gold-brand/40">
                <span className="absolute right-5 top-5 text-4xl font-black text-white/5">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gold-brand/15">
                  <i className={`bi ${step.icon} text-xl text-gold-brand`} aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-bold text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-navy-200">{step.text}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <Reveal delay={0.2}>
          <div className="mt-12 text-center">
            <Link
              href="/courses"
              className="inline-flex items-center gap-2 rounded-xl bg-gold-brand px-8 py-4 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover active:scale-95"
            >
              Start Step 1 — Explore Courses
              <i className="bi bi-arrow-right" aria-hidden="true" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default HowItWorks;
