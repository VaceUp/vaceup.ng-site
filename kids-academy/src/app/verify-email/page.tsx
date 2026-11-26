'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, MailCheck } from 'lucide-react';
import { verifyKidsEmail } from '@/lib/kids-api';

export default function KidsVerifyEmailPage() {
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Checking your verification link...');
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) { setState('error'); setMessage('This verification link is incomplete.'); return; }
    verifyKidsEmail(token).then(result => { setState('success'); setMessage(result.detail); }).catch(reason => { setState('error'); setMessage(reason instanceof Error ? reason.message : 'This verification link is no longer valid.'); });
  }, []);
  return <main className="min-h-screen bg-surface-muted px-5 py-28 sm:px-8"><div className="mx-auto max-w-lg rounded-3xl border border-line bg-white p-8 text-center shadow-sm"><div className={`mx-auto grid size-14 place-items-center rounded-2xl ${state === 'error' ? 'bg-red-50 text-red-700' : 'bg-gold-light text-teal-brand'}`}><MailCheck className="size-7" aria-hidden="true" /></div><h1 className="mt-6 text-3xl font-black text-navy-950">{state === 'loading' ? 'Confirming your email' : state === 'success' ? 'Email confirmed' : 'Link unavailable'}</h1><p className="mt-4 leading-7 text-content-secondary" role={state === 'error' ? 'alert' : 'status'}>{message}</p>{state !== 'loading' && <Link href="/login" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gold-brand px-5 py-3 font-bold text-navy-950">Continue to parent login <ArrowRight className="size-4" aria-hidden="true" /></Link>}</div></main>;
}
