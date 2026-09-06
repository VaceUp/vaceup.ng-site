'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Page transition indicator.
 * - A V-monogram (brand mark) draws itself end-to-end, arrow pointing up.
 * - A slim gold progress bar tracks progress across the top.
 * - Completes when the route actually changes (client-side Link navigation)
 *   or when the document finishes loading (full navigation), with a safety
 *   timeout so it can never hang.
 */

export function PageTransition() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setInterval>[]>([]);

  const clearTimers = () => {
    timers.current.forEach((t) => {
      clearInterval(t);
      clearTimeout(t);
    });
    timers.current = [];
  };

  const start = () => {
    setProgress(10);
    setLeaving(false);
    setActive(true);
    clearTimers();
    const interval = setInterval(() => {
      setProgress((p) => (p < 88 ? p + 4 + Math.random() * 8 : p));
    }, 200);
    const safety = setTimeout(finish, 6000);
    timers.current = [interval, safety];
  };

  const finish = () => {
    clearTimers();
    setProgress(100);
    setLeaving(true);
    setTimeout(() => {
      setActive(false);
      setLeaving(false);
    }, 420); // let the bar reach 100% and the monogram fade gracefully
  };

  // Start on any same-origin link click (covers Next <Link> client navigations
  // and plain <a> full loads alike)
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement)?.closest?.('a');
      if (
        anchor &&
        anchor.origin === window.location.origin &&
        anchor.href !== window.location.href &&
        !anchor.hasAttribute('download') &&
        anchor.target !== '_blank' &&
        !anchor.pathname.startsWith('/#')
      ) {
        start();
      }
    };
    window.addEventListener('click', onClick, true);
    return () => window.removeEventListener('click', onClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Complete when the route actually changes (client navigation)
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-300 ${
        leaving ? 'opacity-0' : 'opacity-95'
      }`}
      role="status"
      aria-label="Loading page"
    >
      {/* V-monogram draw animation */}
      <div className="flex flex-col items-center gap-4">
        <svg
          width="96"
          height="96"
          viewBox="0 0 100 100"
          fill="none"
          aria-hidden="true"
          className="overflow-visible"
        >
          {/* Teal V — draws top-left to bottom to top-right */}
          <path
            d="M18 18 L50 82 L82 18"
            stroke="#008B8B"
            strokeWidth="11"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            className="vu-draw"
            style={{ animationDelay: '0s' }}
          />
          {/* Gold arrow — sweeps up along the right stroke, pointing up */}
          <path
            d="M38 92 L72 44"
            stroke="#FFC72C"
            strokeWidth="9"
            strokeLinecap="round"
            pathLength="100"
            className="vu-draw"
            style={{ animationDelay: '0.55s' }}
          />
          <path
            d="M60 44 L72 30 L82 46"
            stroke="#FFC72C"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            pathLength="100"
            className="vu-draw"
            style={{ animationDelay: '0.95s' }}
          />
        </svg>

        <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-navy-900">
          VaceUp
        </p>
      </div>

      {/* Progress bar */}
      <div className="absolute left-0 top-0 h-1 w-full bg-gray-100">
        <div
          className="h-full bg-gold-brand transition-all duration-200 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <style jsx global>{`
        .vu-draw {
          stroke-dasharray: 100;
          stroke-dashoffset: 100;
          animation: vu-draw-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes vu-draw-in {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default PageTransition;
