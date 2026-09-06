'use client';

import React, { useEffect, useState } from 'react';

/**
 * Page transition indicator — an animated VaceUp logo with a slim gold
 * progress bar, shown while a new page loads. Works with the static
 * export's full-document navigations (no router events needed).
 */
export function PageTransition() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let progressTimer: ReturnType<typeof setInterval>;
    let minShowTimer: ReturnType<typeof setTimeout>;

    const start = () => {
      setProgress(12);
      setVisible(true);
      setLoading(true);
      progressTimer = setInterval(() => {
        setProgress((p) => (p < 85 ? p + Math.random() * 12 : p));
      }, 180);
    };

    const done = () => {
      setProgress(100);
      progressTimer && clearInterval(progressTimer);
      minShowTimer = setTimeout(() => {
        setVisible(false);
        setLoading(false);
      }, 350);
    };

    // Show on any internal link click
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a');
      if (
        anchor &&
        anchor.origin === window.location.origin &&
        anchor.href !== window.location.href &&
        !anchor.hasAttribute('download') &&
        anchor.target !== '_blank'
      ) {
        start();
      }
    };

    // Show on back/forward navigation
    const onPop = () => start();

    window.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('load', done);
    document.addEventListener('DOMContentLoaded', done);
    // Fallback: hide if something went wrong
    const safety = setTimeout(() => done(), 8000);

    // Initial page load finishing
    if (document.readyState === 'complete') {
      // first paint already done — nothing to show
    }

    return () => {
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('load', done);
      document.removeEventListener('DOMContentLoaded', done);
      clearTimeout(safety);
      clearInterval(progressTimer);
      clearTimeout(minShowTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300"
      role="status"
      aria-label="Loading page"
      style={{ opacity: loading || progress < 100 ? 1 : 0 }}
    >
      {/* Animated logo */}
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-20 w-20 animate-pulse">
          <img
            src="/logo.webp"
            alt=""
            className="h-20 w-20 object-contain [animation:spin_2.4s_ease-in-out_infinite]"
            style={{ animationName: 'logoLoad', animationDuration: '1.6s', animationIterationCount: 'infinite', animationTimingFunction: 'ease-in-out' }}
          />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-navy-900">
          Loading your academy…
        </p>
      </div>

      {/* Progress bar */}
      <div
        className="absolute left-0 top-0 h-1 bg-gold-brand transition-all duration-200"
        style={{ width: `${progress}%` }}
      />

      <style jsx global>{`
        @keyframes logoLoad {
          0% {
            transform: scale(1) rotate(0deg);
            filter: drop-shadow(0 0 0 rgba(255, 199, 44, 0));
          }
          50% {
            transform: scale(1.12) rotate(6deg);
            filter: drop-shadow(0 6px 14px rgba(255, 199, 44, 0.45));
          }
          100% {
            transform: scale(1) rotate(0deg);
            filter: drop-shadow(0 0 0 rgba(255, 199, 44, 0));
          }
        }
      `}</style>
    </div>
  );
}

export default PageTransition;
