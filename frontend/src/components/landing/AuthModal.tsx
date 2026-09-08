'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/auth-context';
import { dockSpring, staggerContainer, fieldItem } from '@/components/ui/Reveal';
import { PasswordInput } from '@/components/ui/PasswordInput';
import RegistrationNotice from './RegistrationNotice';
import { X } from 'lucide-react';

/**
 * Global auth modal — rendered once in the root layout.
 * Any page/CTA can open it via `useAuth().openAuth('signin' | 'signup')`.
 * Submits to the real backend through the shared auth context.
 */
export default function AuthModal() {
  const router = useRouter();
  const { isOpen, mode, closeAuth, login, register } = useAuth();
  const [isSignUp, setIsSignUp] = useState(mode === 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const [emailQueued, setEmailQueued] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsSignUp(mode === 'signup');
      setError('');
      setRegisteredEmail('');
    }
  }, [isOpen, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const result = await register({ email, password, full_name: name });
        setEmailQueued(result.verification_email_queued !== false);
        setRegisteredEmail(email.trim());
        return;
      } else {
        await login({ email, password });
      }
      closeAuth();
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
      <>
      {/* Backdrop */}
      <motion.div
        key="backdrop"
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.18 } }}
        onClick={closeAuth}
      >
        {/* Panel — macOS dock-style spring pop */}
        <motion.div
          key="panel"
          className="bg-white rounded-3xl max-w-md w-full p-8 shadow-2xl relative border border-gray-100 text-[#0A1128]"
          initial={{ opacity: 0, y: 96, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 56, scale: 0.92, transition: { duration: 0.16 } }}
          transition={dockSpring}
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
        {/* Close Button */}
        <button
          type="button"
          onClick={closeAuth}
          aria-label="Close"
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 text-lg font-bold transition-transform hover:scale-110 active:scale-90"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {registeredEmail ? <RegistrationNotice email={registeredEmail} queued={emailQueued} onContinue={closeAuth} /> : <>
        <div className="text-center space-y-2 mb-6">
          <h3 className="text-2xl font-black text-navy-950">
            {isSignUp ? 'Create Your Account' : 'Welcome Back'}
          </h3>
          <p className="text-xs text-gray-500">
            {isSignUp
              ? 'Join VaceUp Digital Academy and start your tech career.'
              : 'Sign in to access your dashboard and active courses.'}
          </p>
        </div>

        <motion.form
          onSubmit={handleSubmit}
          className="space-y-4 text-xs"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {isSignUp && (
            <motion.div variants={fieldItem}>
              <label htmlFor="auth-name" className="block font-bold text-gray-700 mb-1">Full Name</label>
              <input
                type="text"
                id="auth-name"
                maxLength={150}
                required
                placeholder="Abubakar Aminu"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:bg-white transition-all"
              />
            </motion.div>
          )}

          <motion.div variants={fieldItem}>
            <label htmlFor="auth-email" className="block font-bold text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              id="auth-email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3.5 text-base text-gray-800 focus:outline-none focus:ring-2 focus:ring-navy-900 focus:bg-white transition-all"
            />
          </motion.div>

          <motion.div variants={fieldItem}>
            <label htmlFor="auth-password" className="block font-bold text-gray-700 mb-1">Password</label>
            <PasswordInput
              id="auth-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              className="w-full bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white"
            />
          </motion.div>

          {isSignUp && (
            <motion.div variants={fieldItem}>
              <label htmlFor="auth-confirm-password" className="block font-bold text-gray-700 mb-1">Confirm Password</label>
              <PasswordInput
                id="auth-confirm-password"
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                className="w-full bg-gray-50 border border-gray-200 text-gray-800 focus:bg-white"
              />
            </motion.div>
          )}

          {error && (
            <motion.div
              role="alert"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-red-500 text-xs text-center bg-red-50 px-3 py-2 rounded-lg"
            >
              {error}
            </motion.div>
          )}

          <motion.div variants={fieldItem}>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 bg-gold-brand text-navy-950 font-bold rounded-xl hover:bg-gold-hover transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {isLoading ? 'Please wait…' : isSignUp ? 'Create Account & Continue →' : 'Sign In to Dashboard →'}
            </button>
          </motion.div>
        </motion.form>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { delay: 0.35 } }}
          className="text-center mt-6 text-xs text-gray-500"
        >
          {isSignUp ? (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-teal-brand font-bold hover:underline"
              >
                Sign In
              </button>
            </p>
          ) : (
            <p>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-teal-brand font-bold hover:underline"
              >
                Sign Up
              </button>
            </p>
          )}
        </motion.div>
        </>}
        </motion.div>
      </motion.div>
      </>
      )}
    </AnimatePresence>
  );
}
