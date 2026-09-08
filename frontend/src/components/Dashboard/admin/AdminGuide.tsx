'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Compass, Lightbulb, Map, X } from 'lucide-react';
import { ADMIN_SECTIONS, type AdminTab } from '@/lib/admin-sections';
import { useAuth } from '@/lib/auth-context';
import { cn } from '@/lib/utils';
import { NativeDialog } from '@/components/ui/Modal';

const QUICK_START: { title: string; description: string; destinations: AdminTab[] }[] = [
  { title: 'Bring the right people in', description: 'Set up your tutors, review applications and confirm learner access.', destinations: ['users', 'applications', 'enrollments'] },
  { title: 'Prepare a course for learners', description: 'Create the course as a draft, build its modules and lessons, then publish when it is ready.', destinations: ['courses', 'content'] },
  { title: 'Run teaching and assessment', description: 'Schedule sessions, review learner work and confirm achievements before issuing certificates.', destinations: ['liveclasses', 'assignments', 'certificates'] },
  { title: 'Keep the academy running', description: 'Review payments, share clear updates and check settings with your technical team.', destinations: ['payments', 'announcements', 'marketing', 'flags'] },
];

const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900';
const secondary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line-control bg-surface px-4 py-2 text-sm font-semibold text-navy-950 hover:bg-navy-50 active:bg-navy-100 disabled:cursor-not-allowed disabled:opacity-50 ${focus}`;
const primary = `inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gold-brand px-5 py-3 text-sm font-bold text-navy-950 hover:bg-gold-hover active:bg-gold-700 disabled:cursor-wait ${focus}`;

export default function AdminGuide({ currentTab, onNavigate }: { currentTab: AdminTab; onNavigate: (tab: AdminTab) => void }) {
  const { user, setAdminGuideDismissed } = useAuth();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const openedFor = useRef<string | null>(null);
  const [view, setView] = useState<'start' | 'map'>('start');
  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<AdminTab>(currentTab);
  const [neverShow, setNeverShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const active = ADMIN_SECTIONS.find((section) => section.id === currentTab)!;
  const detail = ADMIN_SECTIONS.find((section) => section.id === selected)!;
  const tour = QUICK_START[step];

  useEffect(() => {
    if (!user || user.role !== 'admin' || openedFor.current === String(user.id)) return;
    openedFor.current = String(user.id);
    setNeverShow(Boolean(user.admin_guide_dismissed));
    let seen = false;
    try { seen = sessionStorage.getItem(`vaceup:admin-guide:seen:${user.id}`) === 'true'; } catch { /* Keep the guide usable without browser storage. */ }
    if (!user.admin_guide_dismissed && !seen) dialog.current?.showModal();
  }, [user]);

  const open = () => {
    setView('map');
    setSelected(currentTab);
    setNeverShow(Boolean(user?.admin_guide_dismissed));
    setError('');
    dialog.current?.showModal();
  };

  const close = async (destination?: AdminTab) => {
    if (saving || !user) return;
    setSaving(true);
    setError('');
    try {
      if (neverShow !== Boolean(user.admin_guide_dismissed)) await setAdminGuideDismissed(neverShow);
      try { sessionStorage.setItem(`vaceup:admin-guide:seen:${user.id}`, 'true'); } catch { /* The account preference still persists on the server. */ }
      dialog.current?.close();
      trigger.current?.focus();
      if (destination) onNavigate(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Your preference could not be saved. Please try again.');
    } finally { setSaving(false); }
  };

  return <>
    <section aria-label={`${active.name} guidance`} className="flex flex-col gap-4 rounded-2xl border border-navy-100 bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-teal-brand" aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="font-semibold text-navy-950">{active.name}</h2>
          <p className="mt-1 text-sm text-content-muted">{active.hint}</p>
        </div>
      </div>
      <button type="button" ref={trigger} onClick={open} className={cn(secondary, 'shrink-0')}>
        <Compass className="h-4 w-4" aria-hidden="true" /> Guide &amp; site map
      </button>
    </section>

    <NativeDialog ref={dialog} aria-labelledby="admin-guide-title" aria-describedby="admin-guide-description"
      onCancel={(event) => { event.preventDefault(); void close(); }}
      className="m-auto max-h-[calc(100dvh-var(--spacing)*8)] w-[calc(100%-var(--spacing)*8)] max-w-4xl overflow-y-auto rounded-3xl border border-navy-100 bg-surface p-0 text-navy-950 shadow-2xl backdrop:bg-navy-950/70">
      <header className="relative rounded-t-3xl bg-navy-950 px-5 py-7 text-white sm:px-8">
        <div className="mb-5 flex items-center gap-3 pr-12">
          <img src="/logo.webp" alt="" className="h-10 w-10 rounded-lg object-contain" />
          <p className="text-xs font-bold uppercase tracking-widest text-gold-brand">VaceUp / Administrator guide</p>
        </div>
        <button type="button" onClick={() => void close()} disabled={saving} aria-label="Close administrator guide" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-xl text-white hover:bg-surface/10 active:bg-surface/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-brand disabled:cursor-wait">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <h2 id="admin-guide-title" className="text-3xl font-bold tracking-tight sm:text-4xl">Your academy, one step at a time.</h2>
        <p id="admin-guide-description" className="mt-3 max-w-2xl text-sm leading-relaxed text-white">A practical guide to the control panel. Follow the setup path or find the section you need.</p>
      </header>

      <div className="space-y-6 p-5 sm:p-8">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Guide views">
          <button type="button" aria-pressed={view === 'start'} onClick={() => setView('start')} className={cn(secondary, view === 'start' && 'border-navy-900 bg-navy-50')}><BookOpen className="h-4 w-4" aria-hidden="true" /> Quick start</button>
          <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')} className={cn(secondary, view === 'map' && 'border-navy-900 bg-navy-50')}><Map className="h-4 w-4" aria-hidden="true" /> Site map</button>
        </div>

        {view === 'start' ? <section aria-label="Quick start walkthrough" className="space-y-5">
          <p role="status" className="text-xs font-bold uppercase tracking-wider text-navy-900">Step {step + 1} of {QUICK_START.length}</p>
          <h3 className="text-2xl font-bold">{tour.title}</h3>
          <p className="text-sm leading-relaxed text-content-muted">{tour.description}</p>
          <ol className="divide-y divide-line rounded-2xl border border-line">
            {tour.destinations.map((id) => {
              const section = ADMIN_SECTIONS.find((item) => item.id === id)!;
              return <li key={id} className="p-4">
                <button type="button" onClick={() => { setSelected(id); setView('map'); }} className={cn('inline-flex min-h-11 items-center gap-2 text-left font-semibold underline decoration-navy-200 underline-offset-4 hover:decoration-navy-900', focus)}>{section.name}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
                <p className="text-sm leading-relaxed text-content-muted">{section.description}</p>
              </li>;
            })}
          </ol>
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)} className={secondary}><ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back</button>
            <button type="button" onClick={() => step === QUICK_START.length - 1 ? setView('map') : setStep((value) => value + 1)} className={primary}>{step === QUICK_START.length - 1 ? 'Explore the site map' : 'Next step'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </div>
        </section> : <div className="grid min-w-0 gap-6 md:grid-cols-5">
          <label className="block text-sm font-semibold md:hidden">Choose an admin area
            <select value={selected} onChange={(event) => setSelected(event.target.value as AdminTab)} className={cn('mt-2 min-h-11 w-full rounded-xl border border-navy-900 bg-surface px-3', focus)}>
              {ADMIN_SECTIONS.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}
            </select>
          </label>
          <nav aria-label="Admin site map" className="hidden space-y-1 md:col-span-2 md:block">
            {ADMIN_SECTIONS.map((section) => <button key={section.id} type="button" aria-current={selected === section.id ? 'true' : undefined}
              onClick={() => setSelected(section.id)} className={cn('flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-navy-50 active:bg-navy-100', selected === section.id ? 'bg-navy-50 font-bold text-navy-900' : 'text-content-secondary', focus)}>
              {section.name}{selected === section.id && <ArrowRight className="h-4 w-4 shrink-0" aria-hidden="true" />}
            </button>)}
          </nav>
          <section aria-label={`${detail.name} instructions`} className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface-subtle p-5 md:col-span-3">
            <p className="text-xs font-bold uppercase tracking-wider text-navy-900">{detail.group}</p>
            <h3 className="text-2xl font-bold">{detail.name}</h3>
            <p className="text-sm leading-relaxed text-content-muted">{detail.description}</p>
            <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed text-content-secondary">
              {detail.steps.map((instruction) => <li key={instruction}>{instruction}</li>)}
            </ol>
            <div className="rounded-xl border border-gold-200 bg-gold-light p-4">
              <p className="mb-1 text-sm font-semibold">Helpful hint</p>
              <p className="text-sm leading-relaxed">{detail.hint}</p>
            </div>
            <button type="button" disabled={saving} onClick={() => void close(selected)} className={primary}>Open {detail.name}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
          </section>
        </div>}

        <footer className="space-y-4 border-t border-line pt-5">
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm leading-relaxed">
            <input type="checkbox" checked={neverShow} disabled={saving} onChange={(event) => setNeverShow(event.target.checked)} className={cn('mt-1 h-5 w-5 shrink-0 accent-navy-900', focus)} />
            <span><span className="block font-semibold">Never show again at sign-in</span><span className="block text-content-muted">Saved to your admin account when you close the guide. You can reopen it from Guide &amp; site map anytime.</span></span>
          </label>
          {error && <p role="alert" className="rounded-xl bg-feedback-error-surface p-3 text-sm text-feedback-error">{error} Your preference has not been saved.</p>}
          <button type="button" onClick={() => void close()} disabled={saving} aria-busy={saving} className={cn(secondary, 'w-full sm:w-auto')}>{saving ? 'Saving preference...' : 'Close guide'}</button>
        </footer>
      </div>
    </NativeDialog>
  </>;
}
