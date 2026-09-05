'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'kids';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-semibold rounded-xl transition-all duration-200 focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantStyles = {
      primary: 'bg-navy-900 text-white hover:bg-navy-950 focus:ring-navy-900/50 shadow-lg shadow-navy-900/25',
      secondary: 'bg-teal-brand text-white hover:bg-teal-brand/90 focus:ring-teal-brand/50 shadow-lg shadow-teal-brand/25',
      outline: 'border-2 border-navy-900 text-navy-900 hover:bg-navy-50 focus:ring-navy-900/50',
      ghost: 'text-navy-900 hover:bg-navy-50 focus:ring-navy-900/50',
      kids: 'bg-gold-brand text-navy-950 font-black hover:bg-gold-hover focus:ring-gold-brand/50 shadow-lg shadow-gold-brand/25',
    };

    const sizeStyles = { sm: 'px-4 py-2 text-sm gap-1.5', md: 'px-6 py-3 text-base gap-2', lg: 'px-8 py-4 text-lg gap-2' };

    return (
      <button ref={ref} className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)} disabled={disabled || loading} {...props}>
        {loading ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg> : leftIcon ? <span className="flex-shrink-0">{leftIcon}</span> : null}
        {children}
        {!loading && rightIcon && <span className="flex-shrink-0">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';