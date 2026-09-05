'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'kids' | 'kids-blue' | 'kids-purple' | 'kids-green' | 'kids-pink' | 'kids-orange';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', children, ...props }, ref) => {
    const variantStyles = {
      default: 'bg-white border border-gray-100 shadow-sm',
      glass: 'glass-light',
      kids: 'bg-white border border-gray-100 shadow-lg shadow-gold-brand/10 hover:shadow-gold-brand/20 transition-all duration-300',
      'kids-blue': 'bg-white border border-blue-100 shadow-lg shadow-blue-100/20 hover:shadow-blue-100/30 transition-all duration-300',
      'kids-purple': 'bg-white border border-purple-100 shadow-lg shadow-purple-100/20 hover:shadow-purple-100/30 transition-all duration-300',
      'kids-green': 'bg-white border border-green-100 shadow-lg shadow-green-100/20 hover:shadow-green-100/30 transition-all duration-300',
      'kids-pink': 'bg-white border border-pink-100 shadow-lg shadow-pink-100/20 hover:shadow-pink-100/30 transition-all duration-300',
      'kids-orange': 'bg-white border border-orange-100 shadow-lg shadow-orange-100/20 hover:shadow-orange-100/30 transition-all duration-300',
    };

    return <div ref={ref} className={cn('rounded-2xl overflow-hidden', variantStyles[variant], className)} {...props}>{children}</div>;
  }
);

Card.displayName = 'Card';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(({ className, children, ...props }, ref) => <div ref={ref} className={cn('p-6', className)} {...props}>{children}</div>);
CardContent.displayName = 'CardContent';