import React from 'react';
import Link from 'next/link';

export interface LegalSection {
  heading: string;
  body: string[];
  bullets?: string[];
}

export function LegalPage({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-navy-950 py-14 text-white">
        <div className="mx-auto max-w-4xl px-6">
          <h1 className="text-3xl font-black sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-navy-200">Last updated: {updated}</p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="mb-10 rounded-2xl border border-gold-brand/30 bg-gold-light p-5 text-sm leading-relaxed text-navy-900">
          {intro}
        </p>

        <div className="space-y-10">
          {sections.map((section, i) => (
            <section key={i} aria-labelledby={`legal-${i}`}>
              <h2 id={`legal-${i}`} className="text-xl font-black text-navy-950">
                {i + 1}. {section.heading}
              </h2>
              {section.body.map((para, j) => (
                <p key={j} className="mt-3 text-sm leading-relaxed text-gray-700">
                  {para}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 space-y-2">
                  {section.bullets.map((bullet, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm leading-relaxed text-gray-700">
                      <i className="bi bi-dot text-lg leading-5 text-gold-700" aria-hidden="true" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Questions about this policy? Contact us at{' '}
          <a href="mailto:info@vaceup.ng" className="font-bold text-navy-900 hover:text-gold-700">
            info@vaceup.ng
          </a>{' '}
          or through our{' '}
          <Link href="/contact" className="font-bold text-navy-900 hover:text-gold-700">
            contact page
          </Link>
          .
        </div>

        <div className="mt-8 flex flex-wrap gap-4 text-xs text-gray-500">
          <Link href="/terms" className="hover:text-navy-900">Terms & Conditions</Link>
          <Link href="/privacy" className="hover:text-navy-900">Privacy Policy</Link>
          <Link href="/refund-policy" className="hover:text-navy-900">Refund Policy</Link>
          <Link href="/cookie-policy" className="hover:text-navy-900">Cookie Policy</Link>
        </div>
      </main>
    </div>
  );
}

export default LegalPage;
