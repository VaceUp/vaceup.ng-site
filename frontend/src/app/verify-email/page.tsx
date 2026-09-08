'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function VerifyEmail() {
  const params = useSearchParams();
  const token = params.get('token');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const verify = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try { await api.verifyEmail({ token }); setVerified(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to verify this link.'); }
    finally { setBusy(false); }
  };
  return (
    <section className="mx-auto my-12 max-w-md space-y-5 rounded-2xl border border-line bg-surface p-6 text-navy-950 shadow-lg">
      <h1 className="text-2xl font-bold">{verified ? 'Email verified' : 'Verify your email'}</h1>
      <p className="text-sm text-content-muted">{verified ? 'Your account is ready. You can now sign in.' : 'Confirm your email address to activate your VaceUp account.'}</p>
      {error && <p role="alert" className="text-sm text-feedback-error">{error}</p>}
      {!token && <p role="status" className="text-sm text-content-muted">Open the link in your verification email, or request a new one below.</p>}
      {token && !verified && <button type="button" onClick={verify} disabled={busy} aria-busy={busy} className="w-full rounded-xl bg-gold-brand px-4 py-3 font-bold hover:bg-gold-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900">{busy ? 'Verifying...' : 'Verify email address'}</button>}
      {!verified && <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError(''); setMessage('');
        try { setMessage((await api.resendVerification({ email })).detail); }
        catch (err) { setError(err instanceof Error ? err.message : 'Unable to send a new link.'); }
        finally { setBusy(false); }
      }}>
        <label htmlFor="verification-email" className="block text-sm font-semibold">Need a new link? Enter your email</label>
        <input id="verification-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full min-w-0 rounded-xl border border-line-control bg-surface p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900" />
        <button type="submit" disabled={busy} className="w-full rounded-xl border border-navy-900 px-4 py-3 font-semibold hover:bg-navy-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-900">Resend verification email</button>
      </form>}
      {message && <p role="status" className="text-sm">{message}</p>}
      <Link href="/login" className="inline-block py-3 font-semibold underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy-900">Continue to sign in</Link>
    </section>
  );
}

export default function VerifyEmailPage() {
  return <Suspense fallback={<p role="status">Loading verification...</p>}><VerifyEmail /></Suspense>;
}
