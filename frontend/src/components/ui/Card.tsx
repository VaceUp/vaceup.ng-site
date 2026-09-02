'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'glass' | 'glass-dark' | 'primary' | 'bordered' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  hover?: boolean;
  interactive?: boolean;
  children: React.ReactNode;
}

const paddingStyles = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-8 md:p-10',
};

const variantStyles = {
  default: 'bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700',
  glass: 'bg-white/70 dark:bg-slate-950/70 backdrop-blur-xl border-white/30 dark:border-slate-700/20 shadow-glass',
  'glass-dark': 'bg-slate-950/70 backdrop-blur-xl border-slate-700/20 shadow-glass-dark',
  primary: 'bg-primary-500/10 backdrop-blur-xl border-primary-500/30 shadow-glass-primary',
  bordered: 'bg-white dark:bg-slate-900 border-2 border-gray-200 dark:border-slate-700',
  elevated: 'bg-white dark:bg-slate-900 shadow-xl dark:shadow-slate-900/50',
};

const hoverStyles = {
  true: 'transition-all duration-300 hover:shadow-xl hover:-translate-y-1',
  false: '',
};

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      hover = false,
      interactive = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-2xl transition-all duration-300',
          'backdrop-blur-xl',
          variantStyles[variant],
          paddingStyles[padding],
          hoverStyles[hover],
          interactive && 'cursor-pointer active:scale-[0.98]',
          className
        )}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-start justify-between gap-4 mb-6',
          className
        )}
        {...props}
      >
        <div className="flex-1 min-w-0">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white truncate">
            {title}
          </h3>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <div className="flex-shrink-0 ml-4">
            {action}
          </div>
        )}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('', className)} {...props} />
    );
  }
);

CardContent.displayName = 'CardContent';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-slate-700',
          className
        )}
        {...props}
      />
    );
  }
);

CardFooter.displayName = 'CardFooter';

export { Card };