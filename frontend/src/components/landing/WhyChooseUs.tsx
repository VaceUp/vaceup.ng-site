'use client';

import React from 'react';

interface FeatureCard {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FEATURES: FeatureCard[] = [
  {
    id: 'practitioners',
    title: 'Taught by practitioners',
    description: "Every tutor works in the field they teach, you'll learn current tools, not outdated theory.",
    icon: (
      <svg className="w-5 h-5 text-[#008B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
      </svg>
    ),
  },
  {
    id: 'real-work',
    title: 'Built around real work',
    description: 'Client-style briefs, code reviews and portfolio projects that stand up in interviews.',
    icon: (
      <svg className="w-5 h-5 text-[#008B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'support',
    title: 'Structured Support',
    description: 'Live classes, recordings, assignments and weekly mentorship inside one learning platform.',
    icon: (
      <svg className="w-5 h-5 text-[#008B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    id: 'outcomes',
    title: 'Career outcomes first',
    description: 'Interview practice, portfolio reviews and referrals to hiring partners across three countries.',
    icon: (
      <svg className="w-5 h-5 text-[#008B8B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
];

export const WhyChooseUs: React.FC = () => {
  return (
    <section className="bg-gradient-to-b from-white via-slate-50/50 to-white py-20 text-[#00088A]">
      <div className="mx-auto max-w-7xl px-6 text-center">
        
        {/* Section Tagline */}
        <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
          WHY CHOOSE VACEUP?
        </span>

        {/* Section Heading */}
        <h2 className="mt-3 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-[#00088A]">
          An academy built like <br className="hidden sm:block" /> a company, not classroom
        </h2>

        {/* Subtitle */}
        <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base text-gray-500 leading-relaxed">
          We designed VaceUp around the way real teams work, so your first day on the job feels familiar.
        </p>

        {/* Cards Grid */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
          {FEATURES.map((feature) => (
            <div
              key={feature.id}
              className="flex flex-col justify-between rounded-3xl border border-gray-100 bg-white p-8 shadow-lg shadow-gray-100/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div>
                {/* Icon Badge */}
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E6F4F4]">
                  {feature.icon}
                </div>

                {/* Feature Title */}
                <h3 className="mt-6 text-lg font-bold text-[#00088A]">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="mt-3 text-xs leading-relaxed text-gray-500">
                  {feature.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};