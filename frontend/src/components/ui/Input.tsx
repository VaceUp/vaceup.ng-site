'use client';

import React, { forwardRef, useId } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
  loading?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

const sizeStyles = {
  xs: 'h-8 px-2.5 text-xs',
  sm: 'h-9 px-3 text-sm',
  md: 'h-11 px-4',
  lg: 'h-12 px-4 text-lg',
};

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      hint,
      leftIcon,
      rightIcon,
      leftElement,
      rightElement,
      loading,
      size = 'md',
      fullWidth = true,
      className,
      id,
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const inputId = useId();
    const errorId = error ? `${id}-error` : undefined;
    const hintId = hint ? `${id}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={`
              block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5
              ${required && 'after:content-["*"] after:text-red-500 after:ml-0.5'}
            `}
          >
            {label}
          </label>
        )}

        <div className="relative">
          {leftElement && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500 z-10">
              {leftElement}
            </div>
          )}

          <input
            ref={ref}
            id={id}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={errorId}
            aria-disabled={disabled}
            aria-busy={false}
            className={cn(
              'w-full rounded-xl transition-all duration-200',
              'bg-white dark:bg-slate-900',
              'text-gray-900 dark:text-white',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'border border-gray-200 dark:border-slate-700',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'text-gray-900 dark:text-white',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'bg-white dark:bg-slate-900',
              'transition-all duration-200',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
              'transition-all duration-200',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
              'transition-all duration-200',
              'group focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:ring-offset-2 focus-within:ring-offset-white dark:focus-within:ring-offset-slate-950'
            )}
            {...props}
            ref={ref}
          />

          {leftElement && (
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-gray-400 dark:text-gray-500 z-10">
              {leftElement}
            </div>
          )}

          {loading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400" aria-hidden="true">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
            </div>
          )}

          {rightElement && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-gray-400">
              {rightElement}
            </div>
          )}

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 pointer-events-none">
              {rightIcon}
            </div>
          )}

          {loading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
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
            </div>
          )}
        </div>

        {error && (
          <p id={errorId} className="mt-1.5 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={hintId} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
export default Input;