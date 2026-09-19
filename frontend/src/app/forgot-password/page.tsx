'use client';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';
import { RecoveryPanel } from '@/components/auth/RecoveryPanel';
import { Action, Field, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try { await api.requestPasswordReset({ email: email.trim() }); setSent(true); }
    catch (failure) { setError(failure instanceof ApiError ? failure.message : 'We could not reach the server. Check your connection and try again.'); }
    finally { setBusy(false); }
  }
  return <RecoveryPanel title={sent ? 'Check your email' : 'Forgot password?'} description={sent ? 'If an active account matches this address, a password-reset email has been queued. Check your inbox and spam folder.' : 'Enter your account email and we will send you a link to choose a new password.'}>
    {sent ? <div className={styles.stack}><p role="status">Open the most recent reset email. For security, earlier links may no longer work.</p><Action onClick={() => setSent(false)}>Use another email or request again</Action></div> : <form onSubmit={submit} className={styles.stack} aria-labelledby="page-title">
      <Field label="Email address"><input type="email" autoComplete="email" required value={email} disabled={busy} onChange={event => setEmail(event.target.value)} /></Field>
      <Feedback error={error} /><Action intent="primary" type="submit" loading={busy}>Send reset link</Action>
    </form>}
  </RecoveryPanel>;
}
