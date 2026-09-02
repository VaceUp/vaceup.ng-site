'use client';

import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  offset?: number;
  delayDuration?: number;
  skipDelayDuration?: number;
  sideOffset?: number;
  alignOffset?: number;
  collisionPadding?: number | { top: number; right: number; bottom: number; left: number };
  avoidCollisions?: boolean;
  sticky?: boolean;
  hideWhenDetached?: boolean;
}

export function Tooltip({
  content,
  children,
  side = 'top',
  align = 'center',
  offset = 8,
  delayDuration = 200,
  skipDelayDuration = 100,
  sideOffset = 4,
  alignOffset = 0,
  collisionPadding = 4,
  avoidCollisions = true,
  sticky = false,
  hideWhenDetached = true,
}: TooltipProps {
  const [isOpen, setIsOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const open = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const close = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  const handleMouseEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => setIsOpen(false), 100);
  };

  return (
    <div
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleMouseEnter}
      onBlur={handleMouseLeave}
    >
      {children}
      {isOpen && (
        <div
          className="fixed z-50"
          style={{
            // Position would be calculated by a proper positioning library
            // This is a simplified version
          }}
        >
          <div
            ref={contentRef}
            className={`
              z-50
              max-w-xs
              px-3 py-2
              text-sm
              text-white
              bg-gray-900
              rounded-md
              shadow-lg
              animate-in fade-in-0 zoom-in-95 duration-150
              data-[side=bottom]:slide-in-from-top-2
              data-[side=left]:slide-in-from-right-2
              data-[side=right]:slide-in-from-left-2
              data-[side=top]:slide-in-from-bottom-2
            `}
          >
            {content}
          </div>
        </div>
      )}
    </div>
  );
}