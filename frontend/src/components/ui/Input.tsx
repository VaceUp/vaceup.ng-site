'use client';

import React, { forwardRef, useId, useState } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
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
  xs: 'min-h-[36px] px-3 py-1.5 text-xs',
  sm: 'min-h-[44px] px-4 py-2.5 text-sm',
  md: 'min-h-[52px] px-5 py-3.5 text-base',
  lg: 'min-h-[58px] px-5 py-4 text-lg',
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
      type,
      ...props
    },
    ref
  ) => {
    const inputId = useId();
    const resolvedId = id || inputId;
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);
    const inputType = isPassword && showPassword ? 'text' : type;
    const errorId = error ? `${resolvedId}-error` : undefined;
    const hintId = hint ? `${resolvedId}-hint` : undefined;
    const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

    const left = leftIcon || leftElement;
    const right = rightIcon || rightElement;

    return (
      <div className={cn(fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={resolvedId}
            className={cn(
              'mb-2.5 block text-sm font-semibold text-navy-900',
              required && 'after:text-red-500 after:content-["*"] after:ml-0.5'
            )}
          >
            {label}
          </label>
        )}

        <div className="relative">
          {left && (
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-4 text-gray-400">
              {left}
            </div>
          )}

          <input
            ref={ref}
            type={inputType}
            id={resolvedId}
            disabled={disabled}
            required={required}
            aria-invalid={!!error}
            aria-describedby={describedBy}
            aria-disabled={disabled}
            aria-busy={false}
            className={cn(
              'w-full rounded-xl border bg-white text-gray-900 transition-all duration-200',
              'placeholder:text-gray-400',
              'border-gray-200',
              'focus:outline-none focus:ring-2 focus:ring-navy-900/20 focus:border-navy-900',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              sizeStyles[size],
              left && 'pl-12',
              (right || loading || isPassword) && 'pr-12',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500/20',
              className
            )}
            {...props}
          />

          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-navy-900 transition-colors"
              tabIndex={-1}
            >
              <i className={cn('bi', showPassword ? 'bi-eye-slash' : 'bi-eye', 'text-lg')} aria-hidden="true" />
            </button>
          )}

          {right && !isPassword && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400">
              {right}
            </div>
          )}

          {loading && (
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400" aria-hidden="true">
              <svg className="h-5 w-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
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
          <p id={errorId} className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={hintId} className="mt-2 text-sm text-gray-500">
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
