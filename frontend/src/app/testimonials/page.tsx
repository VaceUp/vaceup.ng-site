'use client';

import React, { useCallback, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CommunityReview,
  FEATURED_STORIES,
  ReviewerRole,
  getRatingStats,
  getVisibleCommunityReviews,
  hideReview,
} from '@/lib/testimonials';
import { ReviewForm } from '@/components/testimonials/ReviewForm';
import { TestimonialCard, TestimonialCardData } from '@/components/testimonials/TestimonialCard';
import { cn } from '@/lib/utils';

type Filter = 'all' | ReviewerRole;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All reviews' },
  { value: 'student', label: 'Students' },
  { value: 'alumni', label: 'Alumni' },
  { value: 'tutor', label: 'Tutors' },
  { value: 'parent', label: 'Parents' },
];

function featuredAsCards(): TestimonialCardData[] {
  return FEATURED_STORIES.map((s) => ({
    id: s.id,
    name: s.name,
    role: s.role,
    course: s.course,
    rating: s.rating,
    text: s.text,
    outcome: s.outcome,
    submittedAt: new Date('2026-08-01').toISOString(),
    verified: true,
  }));
}

export default function TestimonialsPage() {
  const [community, setCommunity] = useState<CommunityReview[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  // Load locally-persisted community reviews after mount
  const refresh = useCallback(() => {
    setCommunity(
      getVisibleCommunityReviews()
        .slice()
        .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    );
  }, []);

  React.useEffect(() => {
    refresh();
    setHydrated(true);
  }, [refresh]);

  const stats = useMemo(() => getRatingStats(), [community]);

  const allCards: TestimonialCardData[] = useMemo(
    () => [...community.map((r) => ({ ...r })), ...featuredAsCards()],
    [community]
  );

  const visible = useMemo(
    () => (filter === 'all' ? allCards : allCards.filter((c) => c.role === filter)),
    [allCards, filter]
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <section className="bg-navy-950 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <span className="inline-block rounded-full bg-gold-brand/10 px-4 py-1.5 text-sm font-semibold text-gold-brand">
            Success Stories & Reviews
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">
            Real people. Real skills.{' '}
            <span className="text-gold-brand">Real outcomes.</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-navy-200">
            Every review below comes from a student, alumni, tutor or parent in the VaceUp
            community. Add yours and help the next person make the leap.
          </p>

          {/* Rating summary */}
          <div className="mx-auto mt-10 flex max-w-2xl flex-col items-center gap-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm sm:flex-row">
            <div className="text-center sm:w-40">
              <div className="text-6xl font-black text-gold-brand">{stats.average || '—'}</div>
              <div className="mt-1 flex justify-center gap-0.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <i
                    key={s}
                    className={cn(
                      'bi',
                      stats.average >= s ? 'bi-star-fill text-gold-brand' : 'bi-star text-white/25'
                    )}
                    aria-hidden="true"
                  />
                ))}
              </div>
              <div className="mt-1 text-xs text-navy-200">
                {stats.total} review{stats.total === 1 ? '' : 's'}
              </div>
            </div>
            <div className="w-full flex-1 space-y-2">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = stats.distribution[star];
                const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-10 text-navy-200">{star} star</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gold-brand"
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-navy-200">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 lg:grid-cols-5">
          {/* Form */}
          <div id="share" className="lg:col-span-2">
            <div className="lg:sticky lg:top-32">
              <ReviewForm onSubmitted={refresh} />
            </div>
          </div>

          {/* Reviews */}
          <div className="lg:col-span-3">
            {/* Filters */}
            <div className="mb-6 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-bold transition-all',
                    filter === f.value
                      ? 'bg-navy-950 text-white shadow-md'
                      : 'bg-white text-gray-600 hover:bg-navy-50'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              {visible.map((review, index) => (
                <TestimonialCard
                  key={review.id}
                  review={review}
                  index={index}
                  onRemove={
                    'submittedAt' in review && (review as CommunityReview).id.startsWith('rv_')
                      ? () => {
                          hideReview(review.id);
                          refresh();
                        }
                      : undefined
                }
                />
              ))}
            </div>

            {hydrated && filter !== 'all' && visible.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                No {FILTERS.find((f) => f.value === filter)?.label.toLowerCase()} reviews yet —
                be the first to share one!
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
