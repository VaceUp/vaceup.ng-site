'use client';

import { useEffect, useRef, useState } from 'react';
import { initialsOf } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';
import styles from './team.module.css';

interface TeamPortraitProps {
  src?: string;
  name: string;
  role?: string;
  variant?: 'lead' | 'card';
  className?: string;
}

/**
 * A portrait that is always worth the space it takes: the real picture at a
 * large size, or the person's initials on the brand navy when the store cannot
 * deliver the file. The entrance reveal only runs when the frame is actually
 * below the fold, so content is never hidden by a script that failed to load.
 */
export function TeamPortrait({ src, name, role, variant = 'card', className }: TeamPortraitProps) {
  const frame = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  useEffect(() => {
    const node = frame.current;
    if (!node || typeof IntersectionObserver === 'undefined') return;
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    setRevealed(false);
    let fallback = 0;
    const show = () => {
      setRevealed(true);
      observer.disconnect();
      window.clearTimeout(fallback);
    };
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) show();
    }, { rootMargin: '0px 0px -8% 0px' });
    observer.observe(node);
    // A portrait is never left blank: if the observer cannot fire (a print,
    // a full-page capture, a hidden tab), the frame appears anyway.
    fallback = window.setTimeout(show, 2000);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  const showPicture = !!src && !failed;
  const label = role ? `${name}, ${role}` : name;

  return (
    <figure
      ref={frame}
      className={cn(styles.portrait, (variant === 'lead' ? styles.lead : styles.card), className)}
      data-reveal={revealed ? 'true' : 'false'}
    >
      <span className={styles.frame}>
        {showPicture ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            decoding="async"
            className={styles.photo}
            onError={() => setFailed(true)}
          />
        ) : (
          <span className={styles.monogram} role="img" aria-label={label}>
            {initialsOf(name) || '?'}
          </span>
        )}
      </span>
    </figure>
  );
}
