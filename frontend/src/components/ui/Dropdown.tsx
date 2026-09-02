'use client';

import React, { useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, X } from 'react-bootstrap-icons';

export interface DropdownProps {
  trigger: React.ReactNode;
  content: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  side?: 'top' | 'bottom' | 'left' | 'right';
  offset?: number;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dropdown({
  trigger,
  content,
  align = 'left',
  side = 'bottom',
  offset = 8,
  open,
  onOpenChange,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(open ?? false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open !== undefined) {
      setIsOpen(open);
    }
  }, [open]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        contentRef.current &&
        !contentRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        onOpenChange?.(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleClickOutside = (event: MouseEvent) => {
    if (
      triggerRef.current &&
      !triggerRef.current.contains(event.target as Node) &&
      contentRef.current &&
      !contentRef.current.contains(event.target as Node)
    ) {
      setIsOpen(false);
    }
  };

  const handleEscape = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const toggleOpen = () => {
    setIsOpen((prev) => !prev);
    onOpenChange?.(!isOpen);
  };

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        ref={triggerRef}
        onClick={toggleOpen}
        className="inline-flex"
      >
        {trigger}
      </div>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div
            ref={contentRef}
            className={cn(
              'fixed z-50 min-w-[200px] max-w-[360px]',
              'bg-white dark:bg-slate-900',
              'rounded-xl shadow-xl border border-gray-200 dark:border-slate-700',
              'py-2 shadow-xl',
              'animate-in fade-in zoom-in-95 duration-200',
              'data-[side=bottom]:slide-in-from-top-2',
              'data-[side=top]:slide-in-from-bottom-2',
              'data-[side=left]:slide-in-from-right-2',
              'data-[side=right]:slide-in-from-left-2',
            )}
            style={{
              // Position would be calculated by a proper positioning library
              // This is a simplified version
            }}
            ref={contentRef}
          >
            <div className="py-1">
              {content}
            </div>
          </div>
        </>
      )}
    </div>
  );
}