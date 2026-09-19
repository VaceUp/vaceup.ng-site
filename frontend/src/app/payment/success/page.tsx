'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type Payment } from '@/lib/api';
import { Action, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';
import { StandalonePanel } from '@/components/ui/StandalonePanel';

export default function PaymentSuccessPage() {
  const [reference, setReference] = useState('');
  const [payment, setPayment] = useState<Payment | null>(null);
  const [status, setStatus] = useState<'verifying' | 'success' | 'pending' | 'error' | 'missing' | 'login'>('verifying');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference') || params.get('trxref') || '';
    setReference(ref); setError('');
    if (!ref || ref.length > 64) { setStatus('missing'); return; }
    if (!api.getToken()) { setStatus('login'); return; }
    setStatus('verifying');
    api.verifyPayment(ref).then(result => {
      if (cancelled) return;
      setPayment(result);
      setStatus(result.status === 'success' ? 'success' : result.status === 'pending' ? 'pending' : 'error');
    }).catch(err => {
      if (cancelled) return;
      setStatus(err instanceof ApiError && err.status === 401 ? 'login' : 'error');
      setError(err instanceof Error ? err.message : 'Verification is unavailable. Please try again.');
    });
    return () => { cancelled = true; };
  }, [attempt]);
  const title = status === 'success' ? 'Payment confirmed' : status === 'verifying' ? 'Verifying payment' : 'Check your payment';
  return <StandalonePanel title={title} description="This page checks the payment reference with the academy's server.">
    {reference && <p>Reference: <strong>{reference}</strong></p>}
    <Feedback error={error} />
    {status === 'verifying' && <p role="status">Checking your payment. Please wait...</p>}
    {status === 'success' && <div className={styles.stack}><Feedback message="Your payment was verified. Open your courses to check your access." />
      <ul className={styles.list}>{(payment?.items?.length ? payment.items : [{ course: payment?.course, course_title: payment?.course_title }]).map(item => <li key={item.course}>{item.course_title}</li>)}</ul>
      <Link className={styles.action + ' ' + styles.primary} href="/dashboard/courses/">Open my courses</Link>
    </div>}
    {status === 'pending' && <p role="status">The payment is still processing. Do not pay again; check this reference again shortly.</p>}
    {status === 'error' && <p>We have not confirmed this payment. If you were debited, do not pay again. Retry verification or share the reference with support.</p>}
    {status === 'missing' && <p>This link has no valid payment reference. Open the original payment return link, or contact support if you were debited.</p>}
    {status === 'login' && <div className={styles.stack}><p>Sign in with the account used for this purchase to verify it.</p><Link className={styles.action} href={'/login?next=' + encodeURIComponent('/payment/success/?reference=' + encodeURIComponent(reference))}>Sign in to verify</Link></div>}
    <div className={styles.row}>{(status === 'pending' || status === 'error') && <Action onClick={() => setAttempt(value => value + 1)}>Retry verification</Action>}<Link className={styles.action} href="/dashboard/billing/">Payment history</Link><Link className={styles.action} href="/contact/">Contact support</Link></div>
  </StandalonePanel>;
}
