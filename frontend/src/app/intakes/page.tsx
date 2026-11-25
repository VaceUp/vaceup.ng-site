'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock3, UsersRound } from 'lucide-react';
import { api } from '@/lib/api';
import type { AcademyIntake } from '@/lib/website-api';
import { Modal } from '@/components/ui/Modal';

type CourseOption = {
  id: number;
  slug: string;
  title: string;
  capacity?: number;
  enrolled?: number;
  remaining?: number;
  status?: string;
};
type FormValues = { full_name: string; email: string; phone: string; consent_reminders: boolean };
type RegistrationResult = { detail: string; payment_url?: string; status?: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

function admissionTitle(value: string) {
  return value.replace(/\bcohorts?\b/gi, (word) => {
    const plural = word.toLowerCase().endsWith('s');
    return word[0] === word[0].toUpperCase() ? (plural ? 'Admissions' : 'Admission') : (plural ? 'admissions' : 'admission');
  });
}

const blankForm = (): FormValues => ({ full_name: '', email: '', phone: '', consent_reminders: true });

export default function IntakesPage() {
  const [rows, setRows] = useState<AcademyIntake[]>([]);
  const [selected, setSelected] = useState<AcademyIntake | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseOption | null>(null);
  const [step, setStep] = useState<'courses' | 'register' | 'waitlist'>('courses');
  const [preference, setPreference] = useState<'pay_now' | 'pay_later'>('pay_later');
  const [form, setForm] = useState<FormValues>(blankForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<RegistrationResult | null>(null);

  useEffect(() => {
    api.request<{ results: AcademyIntake[] }>('/website/intakes/?page=1', {}, false)
      .then((data) => setRows(data.results || []))
      .catch(() => setError('We could not load the admissions calendar. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const selectedCourses = useMemo<CourseOption[]>(() => (selected?.available_courses || []) as CourseOption[], [selected]);

  function openCohort(intake: AcademyIntake) {
    setSelected(intake); setSelectedCourse(null); setStep('courses'); setForm(blankForm()); setPreference('pay_later'); setResult(null); setMessage(''); setError('');
  }

  function closeCohort() {
    if (busy) return;
    setSelected(null); setSelectedCourse(null); setStep('courses');
  }

  function beginRegistration(course: CourseOption) {
    setSelectedCourse(course); setStep('register'); setResult(null); setMessage(''); setError('');
  }

  function beginWaitlist(course: CourseOption) {
    setSelectedCourse(course); setStep('waitlist'); setResult(null); setMessage(''); setError('');
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault();
    if (!selected || !selectedCourse) return;
    setBusy(true); setError(''); setMessage(''); setResult(null);
    try {
      const response = await api.request<RegistrationResult>(`/website/intakes/${selected.id}/register/`, {
        method: 'POST',
        body: JSON.stringify({ ...form, course: selectedCourse.id, payment_preference: preference }),
      }, false);
      setResult(response); setMessage(response.detail || 'Your registration has been recorded.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not save your registration. Please try again.');
    } finally { setBusy(false); }
  }

  async function joinWaitlist(event: FormEvent) {
    event.preventDefault();
    if (!selected || !selectedCourse) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await api.request(`/website/intakes/${selected.id}/waitlist/`, {
        method: 'POST',
        body: JSON.stringify({ ...form, preferred_course: selectedCourse.id }),
      }, false);
      setMessage('You are on the waitlist. We will email you if a place opens.'); setForm(blankForm());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not save your waitlist request. Please try again.');
    } finally { setBusy(false); }
  }

  return <main className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
    <header className="max-w-3xl space-y-5">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-content-muted">Academy admissions</p>
      <h1 className="text-4xl font-black tracking-tight text-content sm:text-5xl">Choose your course and start date.</h1>
      <p className="max-w-2xl text-lg leading-8 text-content-secondary">Explore every academy admission window for the year, choose a course, and register your interest. You can pay now or reserve your place while you plan.</p>
    </header>

    {loading ? <p role="status">Loading admissions calendar...</p> : error && !rows.length ? <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-50 p-4 text-red-900">{error}</div> : <section className="grid gap-5 md:grid-cols-2" aria-label="Academy admissions">
      {rows.map((intake) => <article key={intake.id} className="flex flex-col rounded-3xl border border-line bg-surface p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-content-muted">{intake.status === 'open' ? 'Open for registration' : 'Upcoming admission'}</p><h2 className="mt-2 text-2xl font-bold text-content">{admissionTitle(intake.title)}</h2></div><CalendarDays aria-hidden="true" className="size-6 shrink-0 text-content-muted" /></div>
        <p className="mt-4 flex items-center gap-2 text-content-secondary"><Clock3 aria-hidden="true" className="size-4" />{dateLabel(intake.starts_on)} - {dateLabel(intake.ends_on)}</p>
        <p className="mt-5 flex items-center gap-2 text-sm text-content-muted"><UsersRound aria-hidden="true" className="size-4" />{intake.available_courses.length} courses available</p>
        <ul className="mt-5 space-y-2 text-sm">{(intake.available_courses as CourseOption[]).slice(0, 4).map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2"><span className="font-medium text-content">{item.title}</span><span className="text-content-muted">{item.status === 'waitlist_open' ? 'Waitlist' : `${item.remaining ?? 0} places`}</span></li>)}</ul>
        <div className="mt-auto flex flex-wrap gap-3 pt-6"><button type="button" className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-4 py-3 font-semibold text-white transition hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:ring-offset-2" onClick={() => openCohort(intake)}>View admission <ArrowRight aria-hidden="true" className="size-4" /></button>{intake.registration_url && <Link href={intake.registration_url} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-3 font-semibold text-content">More details <ArrowRight aria-hidden="true" className="size-4" /></Link>}</div>
      </article>)}
    </section>}

    <Modal isOpen={Boolean(selected)} onClose={closeCohort} size="full" title={selected ? `${admissionTitle(selected.title)} — ${step === 'courses' ? 'Choose a course' : step === 'register' ? 'Register your interest' : 'Join the waitlist'}` : ''} description={step === 'courses' ? 'Select a course to continue. Registration does not charge you.' : 'We will use these details for admissions and class updates.'}>
        {step === 'courses' && <div className="mt-6 space-y-3"><p className="text-content-secondary">Select one course. Registration does not charge you; you can choose whether to pay now or later.</p>{selectedCourses.map((item) => <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-line p-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-content">{item.title}</h3><p className="mt-1 text-sm text-content-muted">{item.status === 'waitlist_open' ? 'This course is full. Join the waitlist.' : `${item.remaining ?? 0} places remaining`}</p></div><button type="button" className="shrink-0 rounded-xl border border-navy-950 px-4 py-2.5 font-semibold text-navy-950 transition hover:bg-navy-950 hover:text-white focus:outline-none focus:ring-2 focus:ring-navy-950" onClick={() => item.status === 'waitlist_open' ? beginWaitlist(item) : beginRegistration(item)}>{item.status === 'waitlist_open' ? 'Join waitlist' : 'Register interest'}</button></div>)}</div>}

        {(step === 'register' || step === 'waitlist') && <form className="mt-6 space-y-5" onSubmit={(event) => void (step === 'register' ? submitRegistration(event) : joinWaitlist(event))}>
          <button type="button" className="inline-flex items-center gap-2 text-sm font-semibold text-content-muted hover:text-content" onClick={() => setStep('courses')}><ArrowLeft aria-hidden="true" className="size-4" />Back to courses</button>
          <div className="rounded-2xl bg-surface-muted p-4"><p className="text-sm text-content-muted">Selected course</p><p className="mt-1 font-semibold text-content">{selectedCourse?.title}</p></div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-content">Full name<input required autoComplete="name" className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 font-normal" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label className="block text-sm font-semibold text-content">Email<input required type="email" autoComplete="email" className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 font-normal" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div>
          <label className="block text-sm font-semibold text-content">Phone number<input required type="tel" autoComplete="tel" className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3 font-normal" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
          {step === 'register' && <fieldset><legend className="text-sm font-semibold text-content">Payment preference</legend><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className={`cursor-pointer rounded-xl border p-3 ${preference === 'pay_now' ? 'border-navy-950 bg-surface-muted' : 'border-line'}`}><input type="radio" name="payment_preference" className="mr-2" checked={preference === 'pay_now'} onChange={() => setPreference('pay_now')} />Pay now after registration</label><label className={`cursor-pointer rounded-xl border p-3 ${preference === 'pay_later' ? 'border-navy-950 bg-surface-muted' : 'border-line'}`}><input type="radio" name="payment_preference" className="mr-2" checked={preference === 'pay_later'} onChange={() => setPreference('pay_later')} />Pay later, keep me informed</label></div></fieldset>}
          <label className="flex items-start gap-3 text-sm text-content-secondary"><input type="checkbox" className="mt-1 size-4" checked={form.consent_reminders} onChange={(event) => setForm({ ...form, consent_reminders: event.target.checked })} /><span>Send me periodic admissions updates and a reminder for each class day. You can opt out from any email.</span></label>
          {message && <div role="status" className="rounded-xl border border-emerald-600/40 bg-emerald-50 p-4 text-emerald-900"><div className="flex gap-2"><CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0" /><p>{message}</p></div>{result?.payment_url && <Link className="mt-3 inline-flex font-semibold underline" href={result.payment_url}>Continue to application and payment <ArrowRight aria-hidden="true" className="ml-1 size-4" /></Link>}</div>}
          {error && <p role="alert" className="rounded-xl border border-red-600/40 bg-red-50 p-4 text-red-900">{error}</p>}
          <button disabled={busy || Boolean(result)} className="w-full rounded-xl bg-navy-950 px-4 py-3 font-semibold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-navy-950 focus:ring-offset-2" type="submit">{busy ? 'Saving...' : step === 'register' ? 'Register my interest' : 'Join waitlist'}</button>
        </form>}
    </Modal>
  </main>;
}
