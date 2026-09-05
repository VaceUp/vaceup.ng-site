'use client';

import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function Logo({ className, size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-auto',
    md: 'h-10 w-auto',
    lg: 'h-12 w-auto',
  };

  return (
    <Link href="/" className={cn('flex items-center gap-2', className)} aria-label="VaceUp Home">
      <Image
        src="/logo.webp.png"
        alt="VaceUp Digital Academy"
        width={size === 'sm' ? 32 : size === 'md' ? 40 : 48}
        height={size === 'sm' ? 32 : size === 'md' ? 40 : 48}
        className={cn('object-contain', sizeClasses[size])}
        priority
      />
      <span className="hidden sm:block font-black text-xl text-navy-950 tracking-tight">
        VaceUp
      </span>
    </Link>
  );
}