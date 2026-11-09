'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Route progress bar.
 *
 * Only the slim bar at the top of the viewport is drawn. The old build covered
 * the whole screen in near-white until the next route finished loading, so on a
 * slow connection every click read as a blank, stalled page.
 */

export function PageTransition() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const started = useRef(false);
  const interval = useRef<ReturnType<typeof setInterval>>();
  const safety = useRef<ReturnType<typeof setTimeout>>();
  const hide = useRef<ReturnType<typeof setTimeout>>();

  const stop = () => {
    clearInterval(interval.current);
    clearTimeout(safety.current);
  };

  const finish = () => {
    stop();
    setProgress(100);
    clearTimeout(hide.current);
    hide.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
      started.current = false;
    }, 260);
  };

  const start = () => {
    stop();
    clearTimeout(hide.current);
    started.current = true;
    setProgress(8);
    setVisible(true);
    interval.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 3 + Math.random() * 6 : p));
    }, 200);
    safety.current = setTimeout(finish, 6000);
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
    if (started.current) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-1"
      aria-hidden="true"
    >
      <div
        className="h-full bg-gold-brand transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

export default PageTransition;
