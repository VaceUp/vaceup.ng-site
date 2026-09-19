'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { getPublicCourseById, formatPrice } from '@/lib/public-catalog';
import { Action, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';
import { StandalonePanel } from '@/components/ui/StandalonePanel';
import { paymentRedirect } from '@/lib/payment-checkout';

interface Line { courseId: string; cartItemId?: number; title: string; price: string; }

export default function CheckoutPage() {
  const [lines, setLines] = useState<Line[]>([]);
  const [total, setTotal] = useState('0.00');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [enrolled, setEnrolled] = useState(false);
  const [returnTo, setReturnTo] = useState('/checkout/');
  const submitting = useRef(false);
  const load = useCallback(async () => {
    setLoading(true); setError(''); setLines([]);
    setReturnTo('/checkout/' + window.location.search);
    if (!api.getToken()) { setNeedsLogin(true); setLoading(false); return; }
    try {
      const user = await api.getMe();
      if (user.role !== 'student') throw new Error('Course checkout is available to student accounts. Sign in with your student account.');
      setEmail(user.email); setNeedsLogin(false);
      const courseId = new URLSearchParams(window.location.search).get('course_id');
      if (courseId) {
        const course = await getPublicCourseById(courseId);
        setLines([{ courseId: String(course.id), title: course.title, price: course.price }]);
        setTotal(course.price);
      } else {
        const cart = await api.getCart();
        setLines(cart.items.map(item => ({ cartItemId: item.id, courseId: String(item.course.id), title: item.course.title, price: item.effective_price })));
        setTotal(cart.total);
      }
    } catch (err) {
      setNeedsLogin(err instanceof ApiError && err.status === 401);
      setError(err instanceof Error ? err.message : 'Could not confirm the order. Refresh checkout and try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function pay() {
    if (submitting.current || loading || !lines.length) return;
    submitting.current = true; setPaying(true); setError('');
    try {
      const direct = lines.length === 1 && lines[0].cartItemId === undefined;
      if (direct && Number(total) === 0) {
        await api.enrollInCourse(lines[0].courseId); setEnrolled(true); return;
      }
      const payment = direct
        ? await api.initializePayment({ course: lines[0].courseId, expected_total: total })
        : await api.checkoutCart(lines.map(line => line.cartItemId!), total);
      if (!('reference' in payment)) {
        if (Number(total) !== 0) throw new Error('The server did not return a payment order. No payment has been started. Contact support.');
        setEnrolled(true); return;
      }
      window.location.assign(paymentRedirect(payment, total));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start payment. Refresh checkout before trying again.');
    } finally { submitting.current = false; setPaying(false); }
  }
  return <StandalonePanel title="Review checkout" description="Prices are confirmed by the academy. Paid courses unlock only after your payment has been verified.">
    <Feedback error={error} />
    {loading ? <p role="status">Confirming your order...</p> : needsLogin ? <div className={styles.stack}>
      <p>Sign in or create an account before enrolling.</p><Link className={styles.action} href={'/login?next=' + encodeURIComponent(returnTo)}>Sign in</Link><Link className={styles.action} href={'/register?next=' + encodeURIComponent(returnTo)}>Create an account</Link>
    </div> : enrolled ? <div className={styles.stack}><Feedback message="Your free-course enrollment is complete." /><Link className={styles.action + ' ' + styles.primary} href="/dashboard/courses/">Open my courses</Link></div> : <div className={styles.stack}>
      {lines.length > 0 && <>
        <p className={styles.muted}>Enrolling as {email}</p>
        <ul className={styles.list}>{lines.map(line => <li className={styles.row + ' ' + styles.between} key={line.courseId}><span>{line.title}</span><strong>{formatPrice(line.price)}</strong></li>)}</ul>
        <p className={styles.row + ' ' + styles.between}><strong>Total</strong><strong>{formatPrice(total)}</strong></p>
        <Action intent="primary" loading={paying} onClick={pay}>{Number(total) === 0 ? 'Enroll for free' : 'Continue to Paystack — ' + formatPrice(total)}</Action>
        <p className={styles.muted}>Review the <Link href="/terms/">terms</Link> and <Link href="/refund-policy/">refund policy</Link> before paying.</p>
      </>}
      {!error && !lines.length && <p>No courses selected. Add a course to your cart to continue.</p>}
      <div className={styles.row}><Action disabled={paying} onClick={load}>Refresh checkout</Action><Link className={styles.action} href="/cart/">Back to cart</Link><Link className={styles.action} href="/courses/">Browse courses</Link></div>
    </div>}
  </StandalonePanel>;
}
