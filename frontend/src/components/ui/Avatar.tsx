'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const sizeStyles = {
  xs: 'w-6 h-6 text-xs',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-xl',
};

const statusColors = {
  online: 'bg-green-500 border-white dark:border-slate-900',
  offline: 'bg-gray-400',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

const statusSizes = {
  xs: 'w-1.5 h-1.5',
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
  xl: 'w-3.5 h-3.5',
  '2xl': 'w-4 h-4',
};

const shapeStyles = {
  circle: 'rounded-full',
  square: 'rounded-none',
  rounded: 'rounded-xl',
};

const statusPositions = {
  'bottom-right': 'bottom-0 right-0 -translate-x-1/2 translate-y-1/2',
  'bottom-left': 'bottom-0 left-0 translate-x-1/2 translate-y-1/2',
  'top-right': 'top-0 right-0 -translate-y-1/2 -translate-x-1/2',
  'top-left': 'top-0 left-0 -translate-y-1/2 translate-x-1/2',
};

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square' | 'rounded';
  status?: 'online' | 'offline' | 'busy' | 'away';
  statusPosition?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  fallback?: React.ReactNode;
  srcSet?: string;
}

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      shape = 'circle',
      status,
      statusPosition = 'bottom-right',
      fallback,
      srcSet,
      className,
      ...props
    }, ref) => {
      return (
        <div
          ref={ref}
          className={cn(
            'relative inline-flex shrink-0 overflow-hidden',
            'bg-gray-100 dark:bg-slate-800',
            'bg-cover bg-center',
            sizeStyles[size],
            shapeStyles[shape],
            className
          )}
          {...props}
        >
          {src ? (
            <img
              src={src}
              srcSet={srcSet}
              alt={alt || name || 'Avatar'}
              className={cn(
                'w-full h-full object-cover',
                shapeStyles[shape]
              )}
            />
          ) : (
            <div
              className={cn(
                'w-full h-full flex items-center justify-center',
                'bg-primary-100 dark:bg-primary-900/30',
                'text-primary-600 dark:text-primary-400',
                'font-medium'
              )}
            >
              {fallback || (
                <span className="font-medium">
                  {name
                    ? name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : '?'}
                </span>
              )}
            </div>
          )}

          {status && (
            <span
              className={cn(
                'absolute rounded-full border-2 border-white dark:border-slate-900',
                statusColors[status],
                statusSizes[size],
                statusPositions[statusPosition]
              )}
            />
          )}
        </div>
      );
    }
);

Avatar.displayName = 'Avatar';