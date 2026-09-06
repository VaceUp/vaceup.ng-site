'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ROLE_LABELS, ReviewerRole, timeAgo } from '@/lib/testimonials';

export interface TestimonialCardData {
  id: string;
  name: string;
  role: ReviewerRole;
  course: string;
  rating: number;
  text: string;
  outcome?: string;
  photo?: string;
  submittedAt: string;
  verified?: boolean;
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      aria-label={`Rated ${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <i
          key={star}
          className={cn(
            'bi',
            rating >= star ? 'bi-star-fill text-gold-brand' : 'bi-star text-gray-300'
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

const ROLE_BADGE_STYLES: Record<ReviewerRole, string> = {
  student: 'bg-navy-50 text-navy-900',
  alumni: 'bg-teal-brand/10 text-teal-700',
  tutor: 'bg-gold-brand/15 text-gold-800',
  parent: 'bg-pink-100 text-pink-700',
};

export function TestimonialCard({
  review,
  index = 0,
  onRemove,
}: {
  review: TestimonialCardData;
  index?: number;
  /** Admin-only moderation action */
  onRemove?: () => void;
}) {
  const initials = review.name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.06, 0.3) }}
      className="group relative flex h-full flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Header: photo, name, meta */}
      <div className="flex items-start gap-4">
        {review.photo ? (
          <img
            src={review.photo}
            alt={`${review.name}'s photo`}
            className="h-14 w-14 flex-shrink-0 rounded-full border-2 border-gold-brand/60 object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-navy-950 text-sm font-black text-gold-brand"
            aria-hidden="true"
          >
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate font-bold text-navy-950">{review.name}</h3>
            {review.verified && (
              <span
                className="inline-flex items-center gap-0.5 rounded-full bg-teal-brand/10 px-2 py-0.5 text-[10px] font-bold text-teal-700"
                title="Verified VaceUp graduate"
              >
                <i className="bi bi-patch-check-fill" aria-hidden="true" /> Verified
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-bold',
                ROLE_BADGE_STYLES[review.role]
              )}
            >
              {ROLE_LABELS[review.role]}
            </span>
            <span className="flex items-center gap-1">
              <i className="bi bi-book" aria-hidden="true" /> {review.course}
            </span>
            <span aria-hidden="true">•</span>
            <span>{timeAgo(review.submittedAt)}</span>
          </div>
        </div>
      </div>

      {/* Rating */}
      <Stars rating={review.rating} className="mt-4" />

      {/* Review */}
      <p className="mt-3 flex-1 text-sm leading-relaxed text-gray-700">
        “{review.text}”
      </p>

      {/* Admin moderation */}
      {onRemove && (
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Remove this review from the site?')) onRemove();
          }}
          className="absolute right-3 top-3 rounded-lg bg-white/90 p-2 text-gray-300 opacity-0 shadow-sm transition-all hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100"
          aria-label="Remove review (admin)"
          title="Remove review (admin)"
        >
          <i className="bi bi-trash3" aria-hidden="true" />
        </button>
      )}

      {/* Outcome */}
      {review.outcome && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-gold-light px-3 py-2.5">
          <i className="bi bi-rocket-takeoff text-gold-700" aria-hidden="true" />
          <p className="text-xs font-bold text-navy-900">{review.outcome}</p>
        </div>
      )}
    </motion.article>
  );
}

export default TestimonialCard;
