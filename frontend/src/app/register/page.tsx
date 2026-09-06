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
import { dockSpring } from '@/components/ui/Reveal';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    agreeTerms: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? e.target.checked : value }));
    setError('');
  };

  const validateForm = () => {
    if (!formData.fullName.trim()) return 'Full name is required';
    if (!formData.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) return 'Invalid email format';
    if (!formData.phone.trim()) return 'Phone number is required';
    if (formData.password.length < 8) return 'Password must be at least 8 characters';
    if (formData.password !== formData.confirmPassword) return 'Passwords do not match';
    if (!formData.agreeTerms) return 'You must agree to the Terms of Service and Privacy Policy';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await register({
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.fullName.trim(),
        phone_number: formData.phone.trim(),
      });
      // Account created — continue where the user was headed (e.g. application)
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/') ? next : '/apply?registered=true');
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.toLowerCase().includes('already exists')) {
        setError('An account with this email already exists — please sign in instead.');
      } else if (err?.status === 400 && msg.toLowerCase().includes('password')) {
        setError(msg);
      } else {
        setError(msg || 'Unable to create your account right now. Please try again.');
      }
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
              <div className="text-center mb-8">
                <Link href="/">
                  <img src="/logo.webp" alt="VaceUp" className="h-12 w-12 mx-auto mb-4 object-contain" />
                </Link>
                <h1 className="text-2xl font-black text-navy-950 mb-2">Create Your Account</h1>
                <p className="text-gray-600">Start building your tech career with expert mentors</p>
              </div>

              {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2">
                  <LordIconComponent src={LordIcons.alert} size={18} colors="primary:#ef4444" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="fullName" className="block text-sm font-semibold text-navy-900 mb-2">Full Name</label>
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={formData.fullName}
                    onChange={handleChange}
                    required
                    leftIcon={<LordIconComponent src={LordIcons.user} size={20} colors="primary:#00088A" />}
                  />
                </div>

                <div>
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
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-navy-900 mb-2">Phone Number</label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+234 800 000 0000"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    leftIcon={<LordIconComponent src={LordIcons.phone} size={20} colors="primary:#00088A" />}
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-semibold text-navy-900 mb-2">Password</label>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    minLength={8}
                    leftIcon={<LordIconComponent src={LordIcons.shield} size={20} colors="primary:#00088A" />}
                  />
                  <p className="mt-1 text-xs text-gray-500">Must be at least 8 characters</p>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-navy-900 mb-2">Confirm Password</label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="••••••••"
                    autoComplete="new-password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    leftIcon={<LordIconComponent src={LordIcons.shield} size={20} colors="primary:#00088A" />}
                  />
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="agreeTerms"
                    name="agreeTerms"
                    checked={formData.agreeTerms}
                    onChange={handleChange}
                    required
                    className="mt-1 w-4 h-4 rounded border-gray-200 text-navy-950 focus:ring-2 focus:ring-navy-900/20"
                  />
                  <label htmlFor="agreeTerms" className="text-sm text-gray-600 mt-1">
                    I agree to the{' '}
                    <Link href="/terms" className="text-navy-900 hover:text-gold-brand underline">Terms of Service</Link>{' '}
                    and{' '}
                    <Link href="/privacy" className="text-navy-900 hover:text-gold-brand underline">Privacy Policy</Link>
                  </label>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm flex items-center gap-2">
                    <LordIconComponent src={LordIcons.alert} size={18} colors="primary:#ef4444" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-gold-brand text-navy-950 hover:bg-gold-hover font-bold"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-500">Or continue with</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="border-gray-200 hover:border-navy-200"
                  >
                    <LordIconComponent src={LordIcons.google} size={20} colors="primary:#4285F4" className="mr-2" />
                    Google
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="border-gray-200 hover:border-navy-200"
                  >
                    <LordIconComponent src={LordIcons.github} size={20} colors="primary:#333" className="mr-2" />
                    GitHub
                  </Button>
                </div>
              </form>

              <div className="mt-8 text-center text-sm text-gray-600">
                <p>Already have an account?{' '}
                  <Link href="/login" className="font-semibold text-navy-900 hover:text-gold-brand transition-colors">
                    Sign in
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
</motion.div>

          <div className="mt-6 text-center text-sm text-gray-500">
            <p>By signing up, you agree to our <Link href="/terms" className="text-navy-600 hover:underline">Terms of Service</Link> and <Link href="/privacy" className="text-navy-600 hover:underline">Privacy Policy</Link>.</p>
          </div>
        </div>
      </main>

    </div>
  );
}