'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps { className?: string; size?: 'sm' | 'md' | 'lg'; showText?: boolean; }

export function Logo({ className, size = 'md', showText = true }: LogoProps) {
  const sizeClasses = { sm: 'w-8 h-8', md: 'w-10 h-10', lg: 'w-12 h-12' };
  const textSizeClasses = { sm: 'text-lg', md: 'text-xl', lg: 'text-2xl' };
  return <Link href="/" className={cn('flex items-center gap-2', className)} aria-label="VaceUp Kids Academy Home">
    <div className={cn('relative overflow-hidden rounded-xl bg-white ring-1 ring-line', sizeClasses[size])}><Image src="/IMG-20260708-WA0000.jpg" alt="" fill sizes="48px" className="object-contain" /></div>
    {showText && <span className={cn('font-black tracking-tight text-navy-950', textSizeClasses[size])}>VaceUp <span className="text-gold-brand">Kids</span></span>}
  </Link>;
}
