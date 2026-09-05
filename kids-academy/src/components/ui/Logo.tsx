'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

interface LogoProps { className?: string; size?: 'sm' | 'md' | 'lg'; showText?: boolean; }

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizeClasses = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const textSizeClasses = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };
  return <Link href="/" className={cn('flex items-center gap-2', className)} aria-label="VaceUp Kids Academy Home">
    <div className={cn('rounded-xl bg-gradient-to-br from-gold-brand to-orange-500 flex items-center justify-center', sizeClasses[size])}><Sparkles className="w-6 h-6 text-white" /></div>
    {showText && <span className={cn('font-black tracking-tight text-navy-950', textSizeClasses[size])}>VaceUp <span className="text-gold-brand">Kids</span></span>}
  </Link>;
}