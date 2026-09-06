'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { LordIconComponent, LordIcons, LordIconSpec } from '@/components/ui/LordIcon';

/**
 * The single source of truth for academy statistics (see PRD §4).
 * Do not add competing stat strips elsewhere — edit this band only.
 */
const stats = [
  { value: 30, suffix: '', label: 'Students Trained', icon: LordIcons.graduation },
  { value: 5, suffix: '', label: 'Expert Instructors', icon: LordIcons.userGroup },
  { value: 8, suffix: '', label: 'Courses & Programs', icon: LordIcons.book },
  { value: 98, suffix: '%', label: 'Student Satisfaction', icon: LordIcons.star },
  { value: 3, suffix: '', label: 'Countries Reached', icon: LordIcons.globe },
];

function useCountUp(target: number, start: boolean, duration = 1200) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!start) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setValue(target);
      return;
    }
    let frame: number;
    const t0 = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - t0) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [start, target, duration]);

  return value;
}

function StatItem({
  value,
  suffix,
  label,
  icon,
  start,
  index,
}: {
  value: number;
  suffix: string;
  label: string;
  icon: string | LordIconSpec;
  start: boolean;
  index: number;
}) {
  const display = useCountUp(value, start);

  return (
    <div
      className={cn(
        'text-center p-6 rounded-2xl transition-all duration-300 hover:scale-105',
        index % 2 === 0 ? 'bg-navy-50' : 'bg-gray-50'
      )}
    >
      <LordIconComponent
        src={icon}
        size={48}
        colors="primary:#00088A,secondary:#FFC72C"
        className="mb-3"
      />
      <div className="text-4xl sm:text-5xl font-black text-navy-950 mb-1 tabular-nums">
        {display}
        {suffix}
      </div>
      <div className="text-gray-600 font-medium">{label}</div>
    </div>
  );
}

export function Stats() {
  const sectionRef = useRef<HTMLElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStart(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="py-16 bg-white border-y border-gray-100"
      aria-label="Trust Statistics"
    >
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {stats.map((stat, index) => (
            <StatItem key={stat.label} {...stat} start={start} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
