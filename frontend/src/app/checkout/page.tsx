'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { initializePayment } from '@/lib/paystack';
import { CANONICAL_FALLBACK } from '@/data/catalog';

interface Line {
  id: string;
  title: string;
  price: number;
  image?: string;
}

/**
 * Checkout (PRD §4.3.3): order summary → Paystack.
 * Tries the backend initialize endpoint first; falls back to Paystack
 * Inline with the public key if configured. Requires registration
 * (business rule) — unauthenticated users are sent to register first.
 */
export default function CheckoutPage() {
  const router = useRouter();
  const [lines, setLines] = useState<Line[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    // BUSINESS RULE: registration before payment
    if (!api.getToken()) {
      setAuthed(false);
      setLoading(false);
      return;
    }

    const load = async () => {
      const params = new URLSearchParams(window.location.search);
      const courseId = params.get('course_id');

      if (courseId) {
        const known = CANONICAL_FALLBACK[courseId];
        setLines([
          known
            ? { id: courseId, title: known.title, price: known.price }
            : { id: courseId, title: `Course #${courseId}`, price: 0 },
        ]);
        setLoading(false);
        return;
      }

      try {
        const cart = await api.getCart();
        setLines(
          (cart.items || []).map((item) => ({
            id: item.course?.id ?? item.id,
            title: item.course?.title ?? 'Course',
            price: item.price,
          }))
        );
      } catch {
        // backend offline — offer single-course flow via fallback catalog
        setLines([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const total = useMemo(() => lines.reduce((sum, l) => sum + l.price, 0), [lines]);

  const handlePay = async () => {
    setError('');
    if (lines.length === 0) {
      setError('Your cart is empty.');
      return;
    }
    if (!email.trim()) {
      setError('Enter the email for your receipt.');
      return;
    }

    setPaying(true);
    const courseId = lines[0].id;

    try {
      // Preferred: backend initializes a Paystack transaction (server-verified)
      const init = await api.initializePayment({
        course_id: courseId,
        email: email.trim(),
        amount: total,
        callback_url: `${window.location.origin}/payment/success`,
      });
      if (init.authorization_url) {
        window.location.href = init.authorization_url;
        return;
      }
      if (init.access_code) {
        // Inline fallback with the transaction access code
        initializePayment({
          email: email.trim(),
          amountInNgn: total,
          onSuccess: (reference) =>
            router.push(`/payment/success?reference=${encodeURIComponent(reference)}`),
          onClose: () => setPaying(false),
        });
        return;
      }
      throw new Error('No authorization returned');
    } catch {
      // Backend offline: fall back to Paystack Inline if a public key is configured
      const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;
      if (publicKey) {
        initializePayment({
          email: email.trim(),
          amountInNgn: total,
          onSuccess: (reference) =>
            router.push(`/payment/success?reference=${encodeURIComponent(reference)}`),
          onClose: () => setPaying(false),
        });
        return;
      }
      setError(
        'Payments are temporarily unavailable while our systems are being upgraded. Please try again shortly or contact info@vaceup.ng.'
      );
      setPaying(false);
    }
  };

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-6">
        <div className="max-w-md rounded-3xl border border-gray-100 bg-white p-10 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gold-brand/15">
            <i className="bi bi-lock-fill text-2xl text-gold-700" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-black text-navy-950">Create your account to continue</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">
            Enrollment and payments are tied to a VaceUp account so your courses, receipts and
            certificate stay safe.
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              href={`/register?next=${encodeURIComponent('/checkout' + window.location.search)}`}
              className="rounded-xl bg-gold-brand py-3.5 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover"
            >
              Create Account
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent('/checkout' + window.location.search)}`}
              className="rounded-xl border-2 border-navy-900 py-3.5 font-bold text-navy-900 transition-colors hover:bg-navy-50"
            >
              I already have an account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="text-3xl font-black text-navy-950">Checkout</h1>
        <p className="mt-1 text-sm text-gray-600">
          Secure payment via Paystack — card, transfer or USSD.
        </p>

        {loading ? (
          <div className="mt-10 animate-pulse space-y-4">
            <div className="h-24 rounded-2xl bg-gray-200" />
            <div className="h-16 rounded-2xl bg-gray-200" />
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            {/* Order summary */}
            <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="mb-4 font-black text-navy-950">Order summary</h2>
              {lines.length === 0 ? (
                <div className="text-center">
                  <p className="text-sm text-gray-500">Your cart is empty.</p>
                  <Link
                    href="/courses"
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-navy-950 px-6 py-3 text-sm font-bold text-white"
                  >
                    Browse courses <i className="bi bi-arrow-right" aria-hidden="true" />
                  </Link>
                </div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {lines.map((line) => (
                    <li key={line.id} className="flex items-center justify-between py-3">
                      <span className="text-sm font-semibold text-navy-950">{line.title}</span>
                      <span className="text-sm font-bold text-navy-950">
                        {line.price === 0
                          ? 'Free'
                          : new Intl.NumberFormat('en-NG', {
                              style: 'currency',
                              currency: 'NGN',
                              minimumFractionDigits: 0,
                            }).format(line.price)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {lines.length > 0 && (
                <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                  <span className="font-black text-navy-950">Total</span>
                  <span className="text-xl font-black text-navy-950">
                    {new Intl.NumberFormat('en-NG', {
                      style: 'currency',
                      currency: 'NGN',
                      minimumFractionDigits: 0,
                    }).format(total)}
                  </span>
                </div>
              )}
            </div>

            {/* Receipt email */}
            {lines.length > 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <label htmlFor="pay-email" className="mb-2 block text-sm font-bold text-navy-950">
                  Receipt email
                </label>
                <input
                  id="pay-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                />
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                {error}
              </div>
            )}

            {lines.length > 0 && (
              <button
                type="button"
                onClick={handlePay}
                disabled={paying}
                className="w-full rounded-xl bg-gold-brand py-4 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paying ? 'Redirecting to secure payment…' : `Pay ${new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', minimumFractionDigits: 0 }).format(total)}`}
              </button>
            )}

            <p className="text-center text-xs text-gray-400">
              By paying you accept our{' '}
              <Link href="/terms" className="underline">Terms</Link> and{' '}
              <Link href="/refund-policy" className="underline">Refund Policy</Link>.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
