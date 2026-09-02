'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ options, placeholder, className, value, onChange, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          'px-3 py-2 border border-gray-300 dark:border-slate-700 rounded-xl',
          'bg-white dark:bg-slate-800 text-gray-900 dark:text-white',
          'focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500 focus:outline-none',
          'transition-colors duration-200',
          'hover:border-gray-400 dark:hover:border-slate-600',
          className
        )}
        value={value}
        onChange={onChange}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }
);

Select.displayName = 'Select';