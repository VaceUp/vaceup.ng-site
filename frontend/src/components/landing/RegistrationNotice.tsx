'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Mail } from 'lucide-react';
import { api } from '@/lib/api';

export default function RegistrationNotice({ email, queued = true, onContinue }: { email: string; queued?: boolean; onContinue?: () => void }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const resend = async () => {
    setSending(true);
    setMessage('');
    setError('');
    try {
      const result = await api.resendVerification({ email });
      setMessage(result.detail);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send a new link. Please try again.');
    } finally { setSending(false); }
  };
  return (
    <section className="space-y-5 text-center text-navy-950" aria-labelledby="registration-complete-title">
      <Mail className="mx-auto h-10 w-10 text-teal-brand" aria-hidden="true" />
      <h2 id="registration-complete-title" className="text-2xl font-bold">Check your email</h2>
      <p className="text-sm text-content-muted">Your account has been created for <strong className="break-all text-navy-950">{email}</strong>. {queued ? 'Open the link in your verification email, then sign in.' : 'We could not queue your verification email. Request a new link shortly; you do not need to register again.'}</p>
      <p className="text-sm text-content-muted">Check your spam folder too. A verification link expires after 24 hours.</p>
      {message && <p role="status" className="text-sm text-navy-900">{message}</p>}
      {error && <p role="alert" className="text-sm text-feedback-error">{error}</p>}
      <button type="button" onClick={resend} disabled={sending} aria-busy={sending} className="w-full rounded-xl border border-navy-900 bg-surface px-4 py-3 font-semibold hover:bg-navy-50 active:bg-navy-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900 disabled:cursor-wait">
        {sending ? 'Sending link...' : 'Resend verification email'}
      </button>
      <Link href="/login" onClick={onContinue} className="inline-flex w-full justify-center rounded-xl bg-gold-brand px-4 py-3 font-bold hover:bg-gold-hover active:bg-gold-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900">Continue to sign in</Link>
    </section>
  );
}
