import React from 'react';
import Link from 'next/link';

export const metadata = {
  title: 'Frequently Asked Questions | VaceUp Digital Academy',
  description: 'Answers to common questions about VaceUp courses, enrollment, payments, live classes and certificates.',
};

const FAQS: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: 'Courses & Learning',
    items: [
      {
        q: 'Do I need prior experience to enroll?',
        a: 'Most of our courses start from the fundamentals — Virtual Assistant, Data Analysis, UI/UX Design, Graphic Design and Web Development all begin with the basics before moving to advanced, project-based work. Check each course page for its level.',
      },
      {
        q: 'How are classes delivered?',
        a: 'Every cohort combines live, interactive online classes with your tutor, downloadable materials, practical assignments and a final capstone project. Live sessions are recorded and available afterwards for revision.',
      },
      {
        q: 'What happens if I miss a live class?',
        a: 'Recordings are uploaded after every session, so you can catch up at your own pace. We recommend attending live where possible — tutors take questions in real time — but your progress never depends on a single session.',
      },
      {
        q: 'Will the platform work on my phone or with slow internet?',
        a: 'Yes. The platform is designed for Nigerian network realities: it is lightweight, works well on mobile, and our learning tools (code editor, workspace) are built to tolerate unstable connections. Recordings and materials are also available after class.',
      },
    ],
  },
  {
    category: 'Enrollment & Payment',
    items: [
      {
        q: 'How do I enroll?',
        a: 'Click Enroll Now, pick your course, create an account, complete the short application and pay securely through Paystack. You get instant confirmation and access when your cohort starts.',
      },
      {
        q: 'What payment methods do you accept?',
        a: 'Cards, bank transfer and USSD through Paystack — all in Naira. International card payments are also supported.',
      },
      {
        q: 'Can I pay in instalments?',
        a: 'Some cohorts offer instalment plans — this is stated on the course page before you pay. Otherwise fees are due in full before the cohort begins.',
      },
      {
        q: 'What is your refund policy?',
        a: 'Full refund up to 3 days before your cohort starts, and a 70% refund within 48 hours after your first live class. Full details are on our Refund Policy page.',
      },
    ],
  },
  {
    category: 'Certificates & Outcomes',
    items: [
      {
        q: 'Will I get a certificate?',
        a: 'Yes — every course grants a verifiable digital certificate once you complete the attendance, assignment and capstone requirements. Each certificate has a unique code that employers can verify on our site.',
      },
      {
        q: 'Do you help with jobs after the course?',
        a: 'Career support is built into the program: portfolio reviews, interview preparation and introductions to opportunities through our partner network. Outcomes like our alumni at Flutterwave, Andela and Paystack started exactly where you are.',
      },
    ],
  },
  {
    category: 'Kids Tech Academy',
    items: [
      {
        q: 'What ages do you accept?',
        a: 'Our kids programs run from ages 6 to 17, grouped by age band (6–12, 9–15, 10–16) so every child learns with the right pace and content.',
      },
      {
        q: 'How do you keep children safe online?',
        a: 'Moderated classes, background-checked instructors, and a parent dashboard where you follow progress in real time. Kids accounts require parent/guardian consent at registration.',
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-1.5 text-sm font-semibold text-gold-brand">
            Help Centre
          </span>
          <h1 className="mt-6 text-4xl font-black sm:text-5xl">Frequently Asked Questions</h1>
          <p className="mx-auto mt-4 max-w-2xl text-navy-200">
            Everything you need to know about learning with VaceUp. Can&apos;t find your answer?{' '}
            <Link href="/contact" className="font-bold text-gold-brand hover:underline">
              Talk to us
            </Link>
            .
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl px-6 py-14">
        {FAQS.map((group) => (
          <section key={group.category} className="mb-12" aria-labelledby={group.category.replace(/\W/g, '')}>
            <h2 id={group.category.replace(/\W/g, '')} className="mb-5 text-xl font-black text-navy-950">
              {group.category}
            </h2>
            <div className="space-y-3">
              {group.items.map((item) => (
                <details
                  key={item.q}
                  className="group rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow hover:shadow-md open:shadow-md"
                >
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-navy-950 [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <i
                      className="bi bi-chevron-down text-gold-700 transition-transform group-open:rotate-180"
                      aria-hidden="true"
                    />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-gray-700">{item.a}</p>
                </details>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-2xl bg-navy-950 p-8 text-center text-white">
          <h2 className="text-2xl font-black">Still have questions?</h2>
          <p className="mt-2 text-sm text-navy-200">
            Our admissions team responds within a few hours during business hours.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              href="/contact"
              className="rounded-xl bg-gold-brand px-6 py-3 text-sm font-bold text-navy-950 transition-all hover:bg-gold-hover"
            >
              Contact Us
            </Link>
            <a
              href="https://wa.me/2348145798943"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-white/30 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
            >
              Chat on WhatsApp
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
