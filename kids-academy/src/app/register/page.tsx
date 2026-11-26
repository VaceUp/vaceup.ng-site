'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { registerParent } from '@/lib/kids-api';

export default function KidsRegisterPage() {
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', relationship: 'Parent', password: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const result = await registerParent(form);
      setMessage(result.detail);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'We could not create the parent account.');
    } finally { setLoading(false); }
  }

  return <main className="min-h-screen bg-surface-muted px-5 py-28 sm:px-8">
    <div className="mx-auto grid max-w-5xl gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
      <section><p className="text-sm font-bold uppercase tracking-[0.18em] text-teal-brand">Parent account</p><h1 className="mt-3 text-4xl font-black tracking-tight text-navy-950 sm:text-5xl">Start your child’s Kids Academy journey.</h1><p className="mt-5 text-lg leading-8 text-content-secondary">Create one secure parent account for learner profiles, admissions, class updates, progress and certificates.</p><div className="mt-8 flex items-start gap-3 rounded-2xl border border-line bg-white p-5"><ShieldCheck className="mt-0.5 size-6 shrink-0 text-teal-brand" aria-hidden="true" /><p className="text-sm leading-6 text-content-secondary">Children’s information stays inside the Kids Academy portal and is only visible to the parent account and authorised Kids Academy staff.</p></div></section>
      <section className="rounded-3xl border border-line bg-white p-6 shadow-sm sm:p-8"><h2 className="text-2xl font-black text-navy-950">Create a parent account</h2>{message ? <div className="mt-6 rounded-2xl border border-teal-brand/30 bg-teal-brand/5 p-5" role="status"><p className="font-semibold text-navy-950">{message}</p><p className="mt-2 text-sm leading-6 text-content-secondary">Open the verification link, then return here to sign in.</p><Link href="/login" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold-brand px-5 py-3 font-bold text-navy-950">Continue to parent login <ArrowRight className="size-4" aria-hidden="true" /></Link></div> : <form className="mt-6 space-y-5" onSubmit={submit}>
        {error && <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-900" role="alert">{error}</p>}
        <label className="block"><span className="text-sm font-semibold text-navy-950">Your full name</span><input required value={form.full_name} onChange={event => setForm({ ...form, full_name: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20" /></label>
        <label className="block"><span className="text-sm font-semibold text-navy-950">Email address</span><input required type="email" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20" /></label>
        <div className="grid gap-5 sm:grid-cols-2"><label className="block"><span className="text-sm font-semibold text-navy-950">Phone</span><input value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20" /></label><label className="block"><span className="text-sm font-semibold text-navy-950">Relationship</span><select value={form.relationship} onChange={event => setForm({ ...form, relationship: event.target.value })} className="mt-2 w-full rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20"><option>Parent</option><option>Guardian</option><option>Other caregiver</option></select></label></div>
        <label className="block"><span className="text-sm font-semibold text-navy-950">Password</span><input required minLength={8} type="password" value={form.password} onChange={event => setForm({ ...form, password: event.target.value })} className="mt-2 w-full rounded-xl border border-line px-4 py-3 outline-none focus:border-teal-brand focus:ring-2 focus:ring-teal-brand/20" /></label>
        <button disabled={loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gold-brand px-5 py-3 font-bold text-navy-950 transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-60">{loading ? 'Creating account...' : 'Create parent account'} <ArrowRight className="size-4" aria-hidden="true" /></button>
        <p className="text-center text-sm text-content-secondary">Already registered? <Link href="/login" className="font-bold text-teal-brand underline">Sign in</Link></p>
      </form>}</section>
    </div>
  </main>;
}
