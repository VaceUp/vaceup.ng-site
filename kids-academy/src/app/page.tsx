'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Check, ChevronRight, Code2, HeartHandshake, Laptop, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { formatPrice, getKidsPrograms, programImage, type KidsProgram } from '@/lib/catalog';
import { MAIN_SITE_URL, PORTAL_URL } from '@/lib/config';

const programTones = [
  'from-blue-600 to-indigo-700',
  'from-violet-600 to-fuchsia-700',
  'from-emerald-600 to-teal-700',
  'from-rose-500 to-pink-700',
  'from-orange-500 to-red-600',
  'from-cyan-600 to-blue-700',
];

const reasons = [
  { icon: ShieldCheck, title: 'Safe by design', text: 'Age-appropriate classes, moderated communication and clear parent visibility from enrolment to completion.' },
  { icon: UsersRound, title: 'Small, live classes', text: 'Children learn with a tutor and a focused group, so questions get answered and projects keep moving.' },
  { icon: Laptop, title: 'Skills they can show', text: 'Every programme ends with practical work a child can explain, improve and share with family.' },
  { icon: HeartHandshake, title: 'Parents stay informed', text: 'The shared VaceUp account keeps attendance, progress, feedback and certificates in one place.' },
];

const parentQuestions = [
  { question: 'What ages do you teach?', answer: 'Programmes are designed for children and teenagers from ages 6 to 17. Each programme card shows its intended age range.' },
  { question: 'Does my child need prior experience?', answer: 'No. Beginner programmes start from the basics, while intermediate programmes clearly state what learners should already know.' },
  { question: 'How do classes work?', answer: 'Classes are live and practical. The tutor demonstrates, children build during the lesson, and parents can review progress through the shared VaceUp account.' },
  { question: 'Where does my child sign in?', answer: 'Use the parent portal link on this page. It connects to the same secure VaceUp account and backend used for enrolment, classes, recordings and certificates.' },
];

export default function KidsHomePage() {
  const [programs, setPrograms] = useState<KidsProgram[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    getKidsPrograms(controller.signal)
      .then(setPrograms)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'The programme catalogue is temporarily unavailable.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  return (
    <>
      <main>
        <section className="relative overflow-hidden bg-navy-950" aria-labelledby="hero-title">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,199,44,0.16),transparent_34%),radial-gradient(circle_at_15%_85%,rgba(25,33,231,0.34),transparent_38%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-36 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-28 lg:pt-44">
            <div>
              <Badge variant="kids" className="mb-6">VaceUp Kids Tech Academy</Badge>
              <h1 id="hero-title" className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl">A confident start to the digital future.</h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-navy-200 sm:text-xl">Live, practical technology programmes for children and teenagers aged 6–17. They build real projects, learn with a tutor and grow with a parent who can see the journey.</p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <a href="#programs"><Button variant="kids" size="lg" rightIcon={<ArrowRight aria-hidden="true" className="size-5" />}>Explore programmes</Button></a>
                <a href={PORTAL_URL}><Button variant="outline" size="lg" className="border-white/30 text-white hover:bg-white/10">Open parent portal</Button></a>
              </div>
              <ul className="mt-9 grid gap-3 text-sm text-navy-200 sm:grid-cols-3">
                {['No prior experience needed', 'Live tutor support', 'Parent visibility included'].map((item) => <li key={item} className="flex items-center gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/10 text-gold-brand"><Check aria-hidden="true" className="size-3.5" /></span>{item}</li>)}
              </ul>
            </div>
            <div className="relative">
              <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/10 p-3 shadow-2xl shadow-black/20">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-navy-800 to-indigo-900">
                  <div className="absolute inset-0 opacity-70" aria-hidden="true"><div className="absolute -right-12 -top-12 size-56 rounded-full border-[28px] border-gold-brand/20" /><div className="absolute -bottom-20 -left-16 size-72 rounded-full border-[34px] border-teal-brand/20" /><div className="absolute left-1/2 top-1/2 grid size-32 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-[2rem] border border-white/15 bg-white/10"><Code2 className="size-16 text-gold-brand" /></div></div>
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-transparent to-transparent" aria-hidden="true" />
                  <div className="absolute inset-x-6 bottom-6 rounded-2xl border border-white/15 bg-navy-950/70 p-5 backdrop-blur">
                    <div className="flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-brand">Learn by making</p><p className="mt-2 text-xl font-bold text-white">From first idea to finished project.</p></div><Sparkles aria-hidden="true" className="size-8 shrink-0 text-gold-brand" /></div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-3 rounded-2xl border border-white/15 bg-white p-4 shadow-xl sm:-left-6"><p className="text-2xl font-black text-navy-950">6–17</p><p className="text-xs font-semibold text-content-secondary">years old</p></div>
              <div className="absolute -right-2 -top-5 rounded-2xl border border-gold-brand/30 bg-gold-brand p-4 shadow-xl sm:-right-6"><p className="text-2xl font-black text-navy-950">Live</p><p className="text-xs font-semibold text-navy-800">with a tutor</p></div>
            </div>
          </div>
        </section>

        <section id="programs" className="scroll-mt-24 bg-surface-muted py-20" aria-labelledby="programs-heading">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-brand">Choose a path</p><h2 id="programs-heading" className="mt-3 text-3xl font-black tracking-tight text-navy-950 sm:text-4xl">Programmes built for curious minds.</h2></div>
              <p className="max-w-md text-sm leading-6 text-content-secondary">The catalogue is managed from the shared VaceUp admin dashboard, so dates, prices and availability stay current.</p>
            </div>

            {loading && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3" role="status" aria-live="polite">{[0, 1, 2].map((item) => <div key={item} className="h-80 animate-pulse rounded-3xl bg-white" />)}<span className="sr-only">Loading programmes</span></div>}
            {!loading && error && <div className="mt-10 rounded-3xl border border-red-200 bg-red-50 p-8" role="alert"><p className="font-semibold text-red-900">{error}</p><p className="mt-2 text-sm text-red-800">Please refresh in a moment or contact the team while we restore the catalogue.</p><a href="mailto:kids@vaceup.ng" className="mt-5 inline-flex rounded-xl bg-navy-950 px-4 py-3 text-sm font-bold text-white">Contact kids support</a></div>}
            {!loading && !error && programs.length === 0 && <div className="mt-10 rounded-3xl border border-dashed border-line bg-white p-10 text-center"><Code2 aria-hidden="true" className="mx-auto size-10 text-teal-brand" /><h3 className="mt-4 text-xl font-bold text-navy-950">New programmes are on the way.</h3><p className="mx-auto mt-2 max-w-xl text-content-secondary">The VaceUp team is preparing the next kids intake. Leave your details with the admissions team and we will let you know when enrolment opens.</p><a href={`${MAIN_SITE_URL}/contact`} className="mt-6 inline-flex rounded-xl bg-gold-brand px-5 py-3 font-bold text-navy-950">Talk to the team</a></div>}
            {!loading && !error && programs.length > 0 && <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{programs.map((program, index) => <ProgramCard key={program.id} program={program} tone={programTones[index % programTones.length]} />)}</div>}
          </div>
        </section>

        <section id="why" className="scroll-mt-24 bg-white py-20" aria-labelledby="why-heading">
          <div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="max-w-2xl"><p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-brand">A better learning environment</p><h2 id="why-heading" className="mt-3 text-3xl font-black tracking-tight text-navy-950 sm:text-4xl">Built for children. Clear for parents.</h2><p className="mt-4 text-lg leading-8 text-content-secondary">The same trusted VaceUp backend powers enrolment, classes, recordings and certificates, while this dedicated site keeps the kids experience focused and age-appropriate.</p></div><div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">{reasons.map(({ icon: Icon, title, text }) => <Card key={title} className="h-full border-line bg-surface-muted"><CardContent className="p-6"><span className="grid size-12 place-items-center rounded-2xl bg-gold-light text-teal-brand"><Icon aria-hidden="true" className="size-6" /></span><h3 className="mt-5 text-lg font-bold text-navy-950">{title}</h3><p className="mt-2 text-sm leading-6 text-content-secondary">{text}</p></CardContent></Card>)}</div></div>
        </section>

        <section id="parents" className="scroll-mt-24 bg-navy-950 py-20" aria-labelledby="parents-heading">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-gold-brand">For parents and guardians</p><h2 id="parents-heading" className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">You stay close without taking over.</h2><p className="mt-5 text-lg leading-8 text-navy-200">Use one account to enrol, pay, join classes and review progress. When your child is ready, the same portal carries their work forward.</p><a href={PORTAL_URL} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gold-brand px-5 py-3 font-bold text-navy-950 transition-colors hover:bg-gold-hover">Open the parent portal <ArrowRight aria-hidden="true" className="size-5" /></a></div><div className="space-y-3">{parentQuestions.map((item) => <details key={item.question} className="group rounded-2xl border border-white/10 bg-white/5 p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-white"><span>{item.question}</span><ChevronRight aria-hidden="true" className="size-5 shrink-0 text-gold-brand transition-transform group-open:rotate-90" /></summary><p className="mt-3 max-w-2xl text-sm leading-6 text-navy-200">{item.answer}</p></details>)}</div></div>
        </section>

        <section className="bg-gold-brand py-16" aria-labelledby="cta-heading"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-navy-800">Ready when you are</p><h2 id="cta-heading" className="mt-2 text-3xl font-black tracking-tight text-navy-950">Give your child a place to build.</h2></div><div className="flex flex-col gap-3 sm:flex-row"><a href="#programs"><Button variant="primary" size="lg" rightIcon={<ArrowRight aria-hidden="true" className="size-5" />}>See programmes</Button></a><a href={`${MAIN_SITE_URL}/contact`}><Button variant="outline" size="lg" className="border-navy-950 text-navy-950 hover:bg-white/30">Talk to us</Button></a></div></div></section>
      </main>
    </>
  );
}

function ProgramCard({ program, tone }: { program: KidsProgram; tone: string }) {
  const image = programImage(program);
  return <Card className="flex h-full flex-col border-line bg-white"><div className={`relative aspect-[16/10] overflow-hidden bg-gradient-to-br ${tone}`}>{image ? <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" /> : <div className="grid h-full place-items-center text-white"><Code2 aria-hidden="true" className="size-16 opacity-80" /></div>}<div className="absolute inset-x-4 top-4 flex items-start justify-between gap-3">{program.level && <Badge variant="outline" className="border-white/40 bg-black/20 text-white backdrop-blur">{program.level}</Badge>}<span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-navy-950">{program.duration || 'Flexible schedule'}</span></div></div><CardContent className="flex flex-1 flex-col p-6"><h3 className="text-xl font-bold text-navy-950">{program.title}</h3><p className="mt-2 line-clamp-3 text-sm leading-6 text-content-secondary">{program.tagline || program.description}</p>{program.target_audience && <p className="mt-4 text-sm font-semibold text-teal-brand">{program.target_audience}</p>}<div className="mt-auto flex items-center justify-between gap-4 border-t border-line pt-5"><div><p className="text-xs font-semibold uppercase tracking-wide text-content-muted">From</p><p className="mt-1 text-lg font-black text-navy-950">{formatPrice(program.price)}</p></div><a href={`${MAIN_SITE_URL}/course?slug=${encodeURIComponent(program.slug)}&source=kids`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-navy-950 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-navy-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-brand">View programme <ArrowRight aria-hidden="true" className="size-4" /></a></div></CardContent></Card>;
}
