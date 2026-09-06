'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await api.requestPasswordReset({ email: email.trim() });
      setSent(true);
    } catch (err: any) {
      // Never reveal whether an email exists — show generic guidance either way
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <main className="py-12">
        <div className="mx-auto max-w-md px-6">
          <Card className="bg-white border-gray-100 shadow-xl">
            <CardContent className="p-8">
              <div className="mb-8 text-center">
                <Link href="/">
                  <img src="/logo.webp" alt="VaceUp" className="mx-auto mb-4 h-12 w-12 object-contain" />
                </Link>
                <h1 className="mb-2 text-2xl font-black text-navy-950">Reset your password</h1>
                <p className="text-sm text-gray-600">
                  Enter your registered email and we&apos;ll send you a secure reset link.
                </p>
              </div>

              {sent ? (
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-brand/10">
                    <i className="bi bi-envelope-check-fill text-2xl text-teal-brand" aria-hidden="true" />
                  </div>
                  <h2 className="mb-2 text-lg font-black text-navy-950">Check your inbox</h2>
                  <p className="mx-auto mb-6 max-w-sm text-sm text-gray-600">
                    If <span className="font-bold">{email}</span> is registered with us, a
                    password reset link is on its way. The link expires in 1 hour.
                  </p>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-navy-900 hover:bg-navy-50"
                  >
                    <i className="bi bi-arrow-left" aria-hidden="true" /> Back to sign in
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                      <LordIconComponent src={LordIcons.alert} size={18} colors="primary:#ef4444" />
                      {error}
                    </div>
                  )}

                  <div>
                    <label htmlFor="email" className="mb-2 block text-sm font-semibold text-navy-900">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3.5 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full rounded-xl bg-gold-brand py-4 font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isLoading ? 'Sending reset link…' : 'Send Reset Link'}
                  </button>

                  <p className="text-center text-sm text-gray-600">
                    Remembered it?{' '}
                    <Link href="/login" className="font-semibold text-navy-900 hover:text-gold-brand">
                      Back to sign in
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
