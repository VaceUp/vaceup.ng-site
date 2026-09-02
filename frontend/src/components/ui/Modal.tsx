'use client';

import React, { Fragment, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { X } from 'react-bootstrap-icons';
import { motion, AnimatePresence } from 'framer-motion';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  className,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = `${window.innerWidth - document.documentElement.clientWidth}px`;
      modalRef.current?.focus();

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && closeOnEscape) {
          onClose();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        document.body.style.paddingRight = '';
        previousActiveElement.current?.focus();
      };
    }
  }, [isOpen, closeOnEscape]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    full: 'max-w-4xl',
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-50 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
          onClick={onClose}
          aria-hidden="true"
        >
          <div className="relative z-50 max-h-[90vh] overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                'relative w-full max-h-[90vh] overflow-hidden rounded-2xl',
                'bg-white dark:bg-slate-950',
                'shadow-2xl',
                'backdrop-blur-xl',
                'bg-white/95 dark:bg-slate-950/95',
                'backdrop-blur-xl',
                'border border-white/20 dark:border-slate-800/50',
                'shadow-2xl',
                'rounded-2xl',
                'overflow-hidden'
              )}
            >
              <div className="flex items-start justify-between p-4 md:p-6 border-b border-gray-200 dark:border-slate-700/50">
                <div className="flex-1 min-w-0">
                  {title && (
                    <h2
                      id="modal-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {description}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className={`
                      p-2 rounded-xl
                      text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                      hover:bg-gray-100 dark:hover:bg-slate-800/50
                      transition-colors duration-200
                      focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-offset-2
                      focus:ring-offset-white dark:focus:ring-offset-slate-950
                    `}
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="max-h-[calc(90vh-140px)] overflow-y-auto p-4 md:p-6">
                {children}
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  Modal.displayName = 'Modal';

  // Export alert/confirm/prompt helpers
  export function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    variant: 'default' | 'destructive' = 'default',
    onConfirm,
    loading = false,
  }: {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'default' | 'destructive';
    onConfirm: () => Promise<void> | void;
    loading?: boolean;
  }) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        size="sm"
        closeOnOverlayClick={false}
        closeOnEscape={false}
      >
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mt-2 mb-6">{children}</p>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-xl hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={async () => {
              await onConfirm();
              onClose();
            }}
            disabled={loading}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              variant === 'destructive'
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            disabled={loading}
          >
            {loading ? (
              <>
                <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </Modal>
    );
  }