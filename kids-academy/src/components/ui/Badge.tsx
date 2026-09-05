'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'kids' | 'kids-blue' | 'kids-purple' | 'kids-green' | 'kids-pink' | 'kids-orange';
  size?: 'sm' | 'md' | 'lg';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant = 'default', size = 'md', children, ...props }, ref) => {
  const variantStyles = {
    default: 'bg-navy-100 text-navy-900', secondary: 'bg-gray-100 text-gray-900', outline: 'bg-transparent border-2 border-navy-900 text-navy-900',
    success: 'bg-green-100 text-green-800', warning: 'bg-yellow-100 text-yellow-800',
    kids: 'bg-gold-brand text-navy-950 font-bold', 'kids-blue': 'bg-blue-100 text-blue-800',
    'kids-purple': 'bg-purple-100 text-purple-800', 'kids-green': 'bg-green-100 text-green-800',
    'kids-pink': 'bg-pink-100 text-pink-800', 'kids-orange': 'bg-orange-100 text-orange-800',
  };
  const sizeStyles = { sm: 'px-2.5 py-1 text-xs', md: 'px-3 py-1 text-sm', lg: 'px-4 py-1.5 text-base' };
  return <span ref={ref} className={cn('inline-flex items-center font-semibold rounded-full', variantStyles[variant], sizeStyles[size], className)} {...props}>{children}</span>;
});
Badge.displayName = 'Badge';