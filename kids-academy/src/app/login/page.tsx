'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { loginParent } from '@/lib/kids-api';

export default function KidsLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('');
    try { await loginParent(form.email, form.password); router.replace('/parent'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'We could not sign you in.'); }
    finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-surface-muted px-5 py-28 sm:px-8"><div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"><div className="grid size-12 place-items-center rounded-2xl bg-gold-light text-teal-brand"><LockKeyhole className="size-6" aria-hidden="true" /></div><p className="mt-8 text-sm font-bold uppercase tracking-[0.18em] text-teal-brand">Kids Academy portal</p><h1 className="mt-3 text-4xl font-black tracking-tight text-navy-950">Parent sign in</h1><p className="mt-4 leading-7 text-content-secondary">Manage learner profiles, admissions, progress and class updates from one Kids Academy account.</p><form className="mt-8 space-y-5" onSubmit={submit}>{error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900" role="alert">{error}</p>}<label className="block"><span className="text-sm font-semibold text-navy-950">Email address</span><input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20" /></label><label className="block"><span className="text-sm font-semibold text-navy-950">Password</span><input required type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20" /></label><button disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-brand px-5 py-3 font-bold text-navy-950 transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Signing in...' : 'Sign in to Kids Academy'} <ArrowRight className="size-4" aria-hidden="true" /></button><p className="text-center text-sm text-content-secondary">New here? <Link href="/register" className="font-bold text-teal-brand underline">Create a parent account</Link></p></form></div></main>;
}
