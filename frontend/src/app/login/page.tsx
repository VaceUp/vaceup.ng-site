'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Card, CardContent } from '@/components/ui/Card';
import { LordIconComponent, LordIcons } from '@/components/ui/LordIcon';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { dockSpring, staggerContainer, fieldItem } from '@/components/ui/Reveal';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login({ email: formData.email, password: formData.password });
      // Send the user back where they came from (e.g. /apply) or to the dashboard
      const params = new URLSearchParams(window.location.search);
      const next = params.get('next');
      router.push(next && next.startsWith('/') ? next : '/dashboard');
    } catch (err: any) {
      setError(
        err?.status === 401
          ? 'Invalid email or password. Please try again.'
          : err?.message || 'Unable to sign in right now. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      
      <main className="py-12">
        <div className="mx-auto max-w-md px-6">
          <motion.div
            initial={{ opacity: 0, y: 72, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={dockSpring}
          >
          <Card className="bg-white border-gray-100 shadow-xl">
            <CardContent className="p-8">
              <motion.div
                className="text-center mb-8"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={fieldItem}>
                  <Link href="/">
                    <img src="/logo.webp" alt="VaceUp" className="h-12 w-12 mx-auto mb-4 object-contain" />
                  </Link>
                </motion.div>
                <motion.h1 variants={fieldItem} className="text-2xl font-black text-navy-950 mb-2">Welcome Back</motion.h1>
                <motion.p variants={fieldItem} className="text-gray-600">Sign in to access your dashboard and courses</motion.p>
              </motion.div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2"
                >
                  <LordIconComponent src={LordIcons.alert} size={18} colors="primary:#ef4444" />
                  <span>{error}</span>
                </motion.div>
              )}

              <motion.form
                onSubmit={handleSubmit}
                className="space-y-6"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                <motion.div variants={fieldItem}>
                  <label htmlFor="email" className="block text-sm font-semibold text-navy-900 mb-2">Email Address</label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    leftIcon={<LordIconComponent src={LordIcons.mail} size={20} colors="primary:#00088A" />}
                  />
                </motion.div>

                <motion.div variants={fieldItem}>
                  <div className="flex items-center justify-between mb-2">
                    <label htmlFor="password" className="block text-sm font-semibold text-navy-900">Password</label>
                    <Link href="/forgot-password" className="text-sm text-navy-600 hover:text-gold-brand transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="current-password"
                    leftIcon={<LordIconComponent src={LordIcons.shield} size={20} colors="primary:#00088A" />}
                  />
                </motion.div>

                <motion.div variants={fieldItem} className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      name="rememberMe"
                      checked={formData.rememberMe}
                      onChange={(e) => setFormData(prev => ({ ...prev, rememberMe: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-200 text-navy-950 focus:ring-2 focus:ring-navy-900/20"
                    />
                    <span className="text-sm text-gray-600">Remember me</span>
                  </label>
                </motion.div>

                <motion.div variants={fieldItem}>
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full font-bold"
                    loading={isLoading}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Signing in…' : 'Sign In'}
                  </Button>
                </motion.div>

                <motion.div variants={fieldItem} className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">New to VaceUp?</span>
                  </div>
                </motion.div>

                <motion.div variants={fieldItem}>
                  <Link href="/register" className="block">
                    <Button type="button" variant="outline" size="lg" className="w-full">
                      Create Your Account
                    </Button>
                  </Link>
                </motion.div>
              </motion.form>

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { delay: 0.4 } }}
                className="mt-8 text-center text-sm text-gray-600"
              >
                <p>Don't have an account?{' '}
                  <Link href="/register" className="font-semibold text-navy-900 hover:text-gold-brand transition-colors">
                    Sign up
                  </Link>
                </p>
              </motion.div>
            </CardContent>
          </Card>
          </motion.div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By signing in, you agree to our <Link href="/terms" className="text-navy-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-navy-600 hover:underline">Privacy Policy</Link>.</p>
          </div>
        </div>
      </main>

    </div>
  );
}