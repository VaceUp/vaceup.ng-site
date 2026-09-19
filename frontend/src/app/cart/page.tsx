'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, type Cart } from '@/lib/api';
import { formatPrice } from '@/lib/public-catalog';
import { Action, Feedback, styles } from '@/components/Dashboard/admin/AuthoringUI';
import { StandalonePanel } from '@/components/ui/StandalonePanel';

export default function CartPage() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    if (!api.getToken()) { setNeedsLogin(true); setLoading(false); return; }
    try { setCart(await api.getCart()); setNeedsLogin(false); }
    catch (err) {
      setCart(null);
      setNeedsLogin(err instanceof ApiError && err.status === 401);
      setError(err instanceof Error ? err.message : 'Could not load your cart. Try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function remove(id?: number) {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      if (id === undefined) await api.clearCart();
      else await api.removeFromCart(String(id));
      setMessage(id === undefined ? 'Cart cleared.' : 'Course removed from your cart.');
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not remove the course. Refresh your cart and try again.'); }
    finally { setBusy(false); }
  }
  return <StandalonePanel title="Your cart" description="One enrollment per course, for your account. Review the academy's current prices before checkout.">
    <Feedback error={error} message={message} />
    {loading ? <p role="status">Loading your courses...</p> : needsLogin ? <div className={styles.stack}>
      <p>Sign in to see the courses saved to your account.</p><Link className={styles.action} href="/login?next=%2Fcart%2F">Sign in</Link>
    </div> : !cart ? <Action onClick={load}>Retry cart</Action> : cart.items.length === 0 ? <div className={styles.empty}>
      <h2>Your cart is empty</h2><p>Choose a course to start learning.</p><Link className={styles.action} href="/courses/">Browse courses</Link>
    </div> : <div className={styles.stack}>
      <ul className={styles.list}>{cart.items.map(item => <li key={item.id} className={styles.panel}>
        <div className={styles.row + ' ' + styles.between}><h2>{item.course.title}</h2><strong>{formatPrice(item.effective_price)}</strong></div>
        <div className={styles.row}><Link className={styles.action} href={'/course?slug=' + encodeURIComponent(item.course.slug)}>Course details</Link><Action intent="danger" disabled={busy || loading} onClick={() => remove(item.id)} aria-label={'Remove ' + item.course.title + ' from cart'}>Remove course</Action></div>
      </li>)}</ul>
      <p className={styles.row + ' ' + styles.between}><strong>Total</strong><strong>{formatPrice(cart.total)}</strong></p>
      <div className={styles.row}><Action intent="danger" loading={busy} onClick={() => remove()}>Clear cart</Action><Link className={styles.action + ' ' + styles.primary} aria-disabled={busy || loading} onClick={event => { if (busy || loading) event.preventDefault(); }} href="/checkout/">Review checkout</Link></div>
    </div>}
  </StandalonePanel>;
}
