'use client';

import React, { useState } from 'react';

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQSectionProps {
  onEnrollNow?: () => void;
}

const faqs: FAQItem[] = [
  {
    id: '1',
    question: 'How are classes delivered ?',
    answer: 'Classes are delivered online via interactive live sessions and self-paced practical modules with direct access to instructors and cohort mentors.',
  },
  {
    id: '2',
    question: 'Are the programs beginner friendly ?',
    answer: 'Yes! Our foundational tracks assume zero prior experience and guide you step-by-step through practical hands-on exercises.',
  },
  {
    id: '3',
    question: 'Do I get a certificate?',
    answer: 'Yes, upon successful completion of your course and capstone project, you receive a verified certificate of completion.',
  },
  {
    id: '4',
    question: 'What if I miss a live class?',
    answer: 'All live sessions are recorded and made available on your dashboard within 24 hours along with session notes and resources.',
  },
  {
    id: '5',
    question: 'Is there job support?',
    answer: 'Absolutely. We offer portfolio reviews, resume optimization, mock interviews, and direct employer referral opportunities for eligible graduates.',
  },
];

export const FAQSection: React.FC<FAQSectionProps> = ({ onEnrollNow }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  const toggleFAQ = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <section className="bg-white py-20 text-[#00088A]">
      <div className="mx-auto max-w-5xl px-6 space-y-16">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[#008B8B]">
            FREQUENTLY ASKED QUESTIONS
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#00088A] tracking-tight">
            Everything you need to know
          </h2>
        </div>

        {/* FAQ List */}
        <div className="divide-y divide-gray-100 border-t border-b border-gray-100 max-w-4xl mx-auto">
          {faqs.map((item) => {
            const isOpen = openId === item.id;
            return (
              <div key={item.id} className="py-6">
                <button
                  onClick={() => toggleFAQ(item.id)}
                  className="w-full flex items-center justify-between text-left group focus:outline-none"
                >
                  <span className="text-base sm:text-lg font-bold text-[#00088A] group-hover:text-[#008B8B] transition-colors pr-4">
                    {item.question}
                  </span>
                  <span className="text-[#00088A] transition-transform duration-300 transform">
                    <svg
                      className={`w-5 h-5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-4 text-sm sm:text-base text-gray-600 leading-relaxed pr-8 animate-fadeIn">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Banner */}
        <div className="rounded-3xl bg-gradient-to-r from-[#000459] via-[#00088A] to-[#2E3192] p-8 sm:p-12 text-center text-white shadow-xl relative overflow-hidden">
          <div className="relative z-10 max-w-2xl mx-auto space-y-6 flex flex-col items-center">
            
            {/* Users Icon */}
            <div className="text-[#FFC72C]">
              <svg
                className="w-8 h-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>

            <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Your seat for the next cohort is open
            </h3>

            <p className="text-xs sm:text-sm text-gray-200 leading-relaxed max-w-xl">
              Fifteen places per class so every learner gets mentor attention. Apply today and start on 21 September, 2026.
            </p>

            <button
              onClick={onEnrollNow}
              className="inline-flex items-center gap-2 rounded-xl bg-[#FFC72C] px-8 py-3.5 text-xs font-bold text-[#00088A] shadow-md hover:bg-[#ebd024] transition-all transform active:scale-95"
            >
              <span>Enroll Now</span>
              <span>→</span>
            </button>
          </div>
        </div>

      </div>
    </section>
  );
};