'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { CalendarDays, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import type { AcademyIntake } from '@/lib/website-api';

type CourseOption = { id: number; slug: string; title: string; capacity?: number; enrolled?: number; remaining?: number; status?: string };

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
}

export default function IntakesPage() {
  const [rows, setRows] = useState<AcademyIntake[]>([]);
  const [selected, setSelected] = useState<AcademyIntake | null>(null);
  const [course, setCourse] = useState('');
  const [form, setForm] = useState({ full_name: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { api.request<{ results: AcademyIntake[] }>('/website/intakes/?page=1', {}, false).then((data) => setRows(data.results || [])).catch(() => setError('We could not load the intake calendar. Please try again.')).finally(() => setLoading(false)); }, []);
  const selectedCourses = useMemo<CourseOption[]>(() => selected?.available_courses || [], [selected]);
  async function joinWaitlist(event: FormEvent) {
    event.preventDefault(); if (!selected || !course) return;
    setBusy(true); setError(''); setMessage('');
    try { await api.request(`/website/intakes/${selected.id}/waitlist/`, { method: 'POST', body: JSON.stringify({ ...form, preferred_course: course }) }, false); setMessage('You are on the waitlist. Check your inbox for confirmation.'); setForm({ full_name: '', email: '', phone: '' }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not save your waitlist request.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6">
    <header className="max-w-2xl space-y-4"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-content-muted">Academy admissions</p><h1 className="text-4xl font-black tracking-tight sm:text-5xl">Choose your 2027 intake.</h1><p className="text-lg leading-8 text-content-secondary">Four teaching windows, clear course availability, and a waitlist when a course reaches its limit.</p></header>
    {loading ? <p role="status">Loading intakes...</p> : error && !rows.length ? <p role="alert">{error}</p> : <section className="grid gap-5 md:grid-cols-2" aria-label="Upcoming intakes">{rows.map((intake) => <article key={intake.id} className="rounded-3xl border border-line bg-surface p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold text-content-muted">{intake.status === 'open' ? 'Open for registration' : 'Upcoming'}</p><h2 className="mt-2 text-2xl font-bold">{intake.title}</h2></div><CalendarDays aria-hidden="true" className="size-6" /></div><p className="mt-4 text-content-secondary">{dateLabel(intake.starts_on)} - {dateLabel(intake.ends_on)}</p><ul className="mt-5 space-y-2 text-sm">{(intake.available_courses as CourseOption[]).map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-muted px-3 py-2"><span>{item.title}</span><span className="text-content-muted">{item.status === 'waitlist_open' ? 'Waitlist open' : `${item.remaining ?? 0} places left`}</span></li>)}</ul><div className="mt-6 flex flex-wrap gap-3"><button type="button" className="rounded-xl bg-navy-950 px-4 py-3 font-semibold text-white" onClick={() => { setSelected(intake); setCourse(''); setMessage(''); setError(''); }}>Join waitlist</button>{intake.registration_url && <Link href={intake.registration_url} className="inline-flex items-center gap-2 rounded-xl border border-line px-4 py-3 font-semibold">Register <ArrowRight aria-hidden="true" className="size-4" /></Link>}</div></article>)}</section>}
    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="waitlist-title" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-3xl bg-surface p-6 shadow-xl"><div className="flex items-start justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-content-muted">{selected.title}</p><h2 id="waitlist-title" className="mt-2 text-2xl font-bold">Join the waitlist</h2></div><button type="button" className="rounded-lg border border-line px-3 py-2" onClick={() => setSelected(null)}>Close</button></div><form className="mt-6 space-y-4" onSubmit={(event) => void joinWaitlist(event)}><label className="block text-sm font-semibold">Full name<input required className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label className="block text-sm font-semibold">Email<input required type="email" className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="block text-sm font-semibold">Phone<input className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label className="block text-sm font-semibold">Preferred course<select required className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-3" value={course} onChange={(event) => setCourse(event.target.value)}><option value="">Choose a course</option>{selectedCourses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>{message && <p role="status" className="rounded-xl bg-surface-muted p-3">{message}</p>}{error && <p role="alert" className="rounded-xl border border-red-600 p-3">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-navy-950 px-4 py-3 font-semibold text-white" type="submit">{busy ? 'Saving...' : 'Join waitlist'}</button></form></section></div>}
  </main>;
}
