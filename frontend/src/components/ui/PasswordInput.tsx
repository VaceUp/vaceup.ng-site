'use client';

import React, { forwardRef, useState } from 'react';
import { Input, InputProps } from './Input';
import { cn } from '@/lib/utils';

export interface PasswordInputProps
  extends Omit<InputProps, 'type' | 'rightElement' | 'rightIcon'> {}

/**
 * Password field with a show/hide toggle. Drop-in replacement for
 * <Input type="password"> — same props, same styling.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-12', className)}
        rightElement={
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            onMouseDown={(e) => e.preventDefault()}
            aria-label={visible ? 'Hide password' : 'Show password'}
            title={visible ? 'Hide password' : 'Show password'}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-navy-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-900/30"
          >
            <i className={cn('bi', visible ? 'bi-eye-slash' : 'bi-eye')} aria-hidden="true" />
          </button>
        }
        {...props}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';

export default PasswordInput;
