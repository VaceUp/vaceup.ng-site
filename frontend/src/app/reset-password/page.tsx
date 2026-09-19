'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { RecoveryPanel } from '@/components/auth/RecoveryPanel';
import { Action, Field, styles } from '@/components/Dashboard/admin/AuthoringUI';

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token');
    setToken(value && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ? value : null);
    setReady(true);
  }, []);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !token) return;
    if (password !== confirmation) { setError('The passwords do not match. Enter the same password in both fields.'); return; }
    setBusy(true); setError('');
    try {
      await api.confirmPasswordReset({ token, new_password: password });
      try { api.setToken(null); localStorage.removeItem('refresh_token'); } catch { /* Storage restrictions must not turn a completed reset into an error. */ }
      setPassword(''); setConfirmation(''); setDone(true); setToken(null);
      window.history.replaceState(null, '', window.location.pathname);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'We could not reach the server. Check your connection and try again.');
    } finally { setBusy(false); }
  }
  return <RecoveryPanel title={done ? 'Password updated' : 'Set a new password'} description={done ? 'Sign in with your new password. Your previous refresh sessions have been revoked.' : 'Choose a unique password for your VaceUp account.'}>
    {!ready ? <p role="status">Checking your reset link...</p> : done ? <p role="status">Your password has been changed successfully.</p> : !token ? <div className={styles.stack}><p role="alert">This reset link is missing or invalid. Open the full link from your email or request a new one.</p><Link href="/forgot-password" className={styles.action}>Request a new reset link</Link></div> : <form onSubmit={submit} aria-labelledby="page-title" className={styles.stack}>
      <p id="password-help" className={styles.muted}>Use at least eight characters. Avoid common passwords and personal details. Password managers and paste are supported.</p>
      <Field label="New password"><input id="new-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={256} value={password} disabled={busy} aria-describedby="password-help" onChange={event => setPassword(event.target.value)} /></Field>
      <Field label="Confirm new password"><input id="confirm-password" type={visible ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={256} value={confirmation} disabled={busy} onChange={event => setConfirmation(event.target.value)} /></Field>
      <label className={styles.check}><input type="checkbox" checked={visible} onChange={event => setVisible(event.target.checked)} />Show passwords</label>
      {error && <p ref={errorRef} tabIndex={-1} role="alert" className={`${styles.status} ${styles.error}`}>{error}</p>}
      <Action intent="primary" type="submit" loading={busy}>Save new password</Action>
      <Link href="/forgot-password" className={styles.action}>Link expired? Request another</Link>
    </form>}
  </RecoveryPanel>;
}
