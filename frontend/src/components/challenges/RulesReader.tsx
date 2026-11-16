'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseRules } from '@/lib/challenge-rules';
import { Action, styles } from './ChallengeUI';

/** Paginated rulebook: a section index, one section at a time, and a small
 * staggered text reveal so long rules read like pages instead of a wall.
 * The reveal arms only when the reader scrolls into view, and content stays
 * fully visible without JavaScript or under reduced motion. */
export function RulesReader({ rules }: { rules: string }) {
  const parsed = useMemo(() => parseRules(rules), [rules]);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const total = parsed.sections.length;
  const safeIndex = Math.min(index, total - 1);
  const section = parsed.sections[safeIndex];
  const single = total <= 1;

  useEffect(() => {
    const node = root.current;
    if (!node) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setShown(true); observer.disconnect(); }
    }, { rootMargin: '0px 0px -6% 0px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = event.key === 'ArrowRight' ? Math.min(total - 1, safeIndex + 1) : Math.max(0, safeIndex - 1);
    setIndex(next);
    document.getElementById(`rules-tab-${next}`)?.focus();
  };

  if (!section) return null;
  return <div ref={root} className={styles.reader} data-shown={shown ? 'true' : undefined}>
    {parsed.documentTitle && <p className={styles.readerDocTitle}>{parsed.documentTitle}</p>}
    {!single && <div className={styles.readerProgress} role="presentation"><div className={styles.readerProgressBar} style={{ inlineSize: `${((safeIndex + 1) / total) * 100}%` }} /></div>}
    <div className={single ? styles.readerBody : styles.readerGrid}>
      {!single && <div className={styles.readerIndex} role="tablist" aria-label="Rules sections" onKeyDown={onKeys}>
        {parsed.sections.map((item, position) => <button key={`${item.number}-${item.title}`} type="button" role="tab" id={`rules-tab-${position}`} className={styles.readerTab} aria-selected={position === safeIndex} aria-controls="rules-panel" tabIndex={position === safeIndex ? 0 : -1} onClick={() => setIndex(position)}>
          {item.number && <span className={styles.readerCount} aria-hidden="true">{item.number}</span>}
          <span>{item.title}</span>
        </button>)}
      </div>}
      <div className={styles.readerStack}>
        <div id="rules-panel" role="tabpanel" aria-labelledby={`rules-tab-${safeIndex}`} className={styles.readerArticle} key={safeIndex}>
          {!section.items.length && <p className={styles.muted} style={{ '--i': 0 } as CSSProperties}>This section has no further detail yet.</p>}
          {section.items.map((item, position) => item.kind === 'bullet'
            ? <p key={position} className={`${styles.readerItem} ${item.nested ? styles.readerNested : ''}`.trim()} style={{ '--i': position } as CSSProperties}><span className={styles.readerDot} aria-hidden="true" /><span>{item.text}</span></p>
            : item.kind === 'number'
              ? <p key={position} className={styles.readerItem} style={{ '--i': position } as CSSProperties}><span className={styles.readerMarker} aria-hidden="true">{item.marker}</span><span>{item.text}</span></p>
              : <p key={position} className={styles.readerParagraph} style={{ '--i': position } as CSSProperties}>{item.text}</p>)}
        </div>
        {!single && <nav className={styles.readerNav} aria-label="Rules pagination">
          <Action size="sm" onClick={() => setIndex(Math.max(0, safeIndex - 1))} disabled={safeIndex === 0}><ChevronLeft className={styles.icon} aria-hidden="true" />Previous</Action>
          <span className={styles.muted}>Section {safeIndex + 1} of {total}</span>
          <Action size="sm" onClick={() => setIndex(Math.min(total - 1, safeIndex + 1))} disabled={safeIndex === total - 1}>Next<ChevronRight className={styles.icon} aria-hidden="true" /></Action>
        </nav>}
      </div>
    </div>
  </div>;
}
