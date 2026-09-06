'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'iconOnly' | 'iconOnlySm' | 'iconOnlyLg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  glass?: 'light' | 'dark' | 'primary' | 'none';
}

const sizeStyles = {
  xs: 'h-7 px-2.5 text-xs gap-1.5',
  sm: 'h-9 px-3 text-sm gap-2',
  md: 'h-11 px-5 gap-2.5',
  lg: 'h-12 px-7 text-lg gap-3',
  xl: 'h-14 px-9 text-xl gap-3.5',
  iconOnly: 'w-10 h-10 p-0',
  iconOnlySm: 'w-8 h-8',
  iconOnlyLg: 'w-12 h-12',
};

const variantStyles = {
  // Brand system: primary CTA = Gold (navy text for WCAG contrast), secondary = Navy
  primary: 'bg-gold-brand text-navy-950 hover:bg-gold-hover active:bg-gold-700 focus:ring-gold-500/50 shadow-md font-bold',
  secondary: 'bg-navy-900 text-white hover:bg-navy-950 active:bg-navy-800 focus:ring-navy-900/50',
  outline: 'border-2 border-navy-900 text-navy-900 hover:bg-navy-50 active:bg-navy-100 focus:ring-navy-900/50',
  ghost: 'text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800/50 focus:ring-gray-500/50',
  destructive: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500/50',
  success: 'bg-teal-brand text-white hover:bg-teal-700 active:bg-teal-800 focus:ring-teal-brand/50',
  link: 'text-navy-900 hover:text-navy-700 underline-offset-2 hover:underline',
};

const glassStyles: Record<string, string> = {
  light: 'bg-white/70 backdrop-blur-xl border-white/30 shadow-glass',
  lightStrong: 'bg-white/85 backdrop-blur-2xl border-white/40 shadow-glass-lg',
  dark: 'bg-navy-950/70 backdrop-blur-xl border-white/20 shadow-glass-dark',
  darkStrong: 'bg-navy-950/85 backdrop-blur-2xl border-white/30 shadow-glass-xl',
  primary: 'bg-gold-500/10 backdrop-blur-xl border-gold-500/30 shadow-glass-gold',
  none: '',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'link';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'iconOnly' | 'iconOnlySm' | 'iconOnlyLg';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  glass?: 'light' | 'dark' | 'primary' | 'none';
  children: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      glass = 'none',
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        aria-busy={loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98]',
          'aria-busy:animate-pulse',
          sizeStyles[size],
          variantStyles[variant],
          glassStyles[glass] || glassStyles.none,
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && (
          <svg
            className="animate-spin h-4 w-4 flex-shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {leftIcon && !loading && (
          <span className="flex-shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}
        <span className="truncate">{children}</span>
        {rightIcon && !loading && (
          <span className="flex-shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;