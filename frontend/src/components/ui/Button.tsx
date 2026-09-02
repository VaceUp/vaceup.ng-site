'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { designSystem } from '@/lib/design-system';

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
  primary: 'bg-primary-500 text-white hover:bg-primary-600 active:bg-primary-700 focus:ring-primary-500/50 shadow-primary-glow',
  secondary: 'bg-secondary-500 text-white hover:bg-secondary-600 active:bg-secondary-700 focus:ring-secondary-500/50',
  outline: 'border-2 border-primary-500 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:ring-primary-500/50',
  ghost: 'text-gray-700 hover:bg-gray-100 dark:hover:bg-slate-800/50 focus:ring-gray-500/50',
  destructive: 'bg-red-500 text-white hover:bg-red-600 active:bg-red-700 focus:ring-red-500/50 shadow-red-glow',
  success: 'bg-green-500 text-white hover:bg-green-600 active:bg-green-700 focus:ring-green-500/50 shadow-green-glow',
  link: 'text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 underline-offset-2 hover:underline',
};

const glassStyles = {
  light: 'bg-white/70 backdrop-blur-xl border-white/30 shadow-glass',
  lightStrong: 'bg-white/85 backdrop-blur-2xl border-white/40 shadow-glass-lg',
  dark: 'bg-slate-950/70 backdrop-blur-xl border-slate-700/20 shadow-glass-dark',
  darkStrong: 'bg-slate-950/85 backdrop-blur-2xl border-slate-700/30 shadow-glass-xl',
  primary: 'bg-primary-500/10 backdrop-blur-xl border-primary-500/30 shadow-glass-primary',
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
    const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');
    const glassStyle = glass[isDark ? 'dark' : 'light'];

    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled || loading}
        className={cn(
          'inline-flex items-center justify-center font-semibold transition-all duration-200 ease-out',
          'focus-visible:outline-none focus-visible:ring-2 focus:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          'active:scale-[0.98]',
          'aria-busy:animate-pulse',
          sizeStyles[size],
          variantStyles[variant],
          glass ? glassStyles[isDark ? 'dark' : 'light'] : glassStyles.none,
          fullWidth && 'w-full',
          className
        )}
        disabled={disabled || loading}
        aria-busy={loading}
        {...props}
        ref={ref}
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-4 w-4"
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
            <span className="sr-only">Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && (
              <span className="flex-shrink-0" aria-hidden="true">
                {leftIcon}
              </span>
            )}
            <span className="truncate">{children}</span>
            {rightIcon && (
              <span className="flex-shrink-0" aria-hidden="true">
                {rightIcon}
              </span>
            )}
          </>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;