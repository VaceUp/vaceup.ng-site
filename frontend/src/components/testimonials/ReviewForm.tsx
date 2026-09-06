'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  COURSE_OPTIONS,
  REVIEW_LIMITS,
  ROLE_LABELS,
  ReviewerRole,
  resizePhoto,
  submitReview,
  validateReview,
} from '@/lib/testimonials';
import { cn } from '@/lib/utils';

const ROLES = Object.entries(ROLE_LABELS) as [ReviewerRole, string][];

export function ReviewForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: '',
    role: '' as ReviewerRole | '',
    course: '',
    rating: 0,
    text: '',
    outcome: '',
    email: '',
  });
  const [photo, setPhoto] = useState<string | undefined>(undefined);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof form, value: string | number) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handlePhoto = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await resizePhoto(file);
      setPhoto(dataUrl);
      setErrors((prev) => {
        const n = { ...prev };
        delete n.photo;
        return n;
      });
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, photo: err?.message || 'Upload failed' }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateReview({ ...form, role: form.role || undefined });
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setSubmitting(true);
    // Give the UI a beat so the button state is perceivable
    await new Promise((r) => setTimeout(r, 350));
    submitReview({
      name: form.name,
      role: form.role as ReviewerRole,
      course: form.course,
      rating: form.rating,
      text: form.text,
      outcome: form.outcome,
      photo,
      email: form.email || undefined,
    });
    setSubmitting(false);
    setSubmitted(true);
    onSubmitted?.();
  };

  const textLen = form.text.trim().length;

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="rounded-3xl border border-teal-brand/20 bg-teal-brand/5 p-10 text-center"
        role="status"
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-brand/15">
          <i className="bi bi-check-circle-fill text-3xl text-teal-brand" aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-black text-navy-950">Thank you, {form.name.split(' ')[0]}! 🎉</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
          Your review is now live on this page. Stories like yours are what help the next
          student take the leap.
        </p>
        <button
          type="button"
          onClick={() => {
            setSubmitted(false);
            setForm({ name: '', role: '', course: '', rating: 0, text: '', outcome: '', email: '' });
            setPhoto(undefined);
            setErrors({});
          }}
          className="mt-6 rounded-xl border-2 border-navy-900 px-6 py-2.5 text-sm font-bold text-navy-900 transition-colors hover:bg-navy-50"
        >
          Write another review
        </button>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8"
      noValidate
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-brand/15">
          <i className="bi bi-pencil-square text-xl text-gold-700" aria-hidden="true" />
        </div>
        <div>
          <h3 className="text-lg font-black text-navy-950">Share Your Experience</h3>
          <p className="text-xs text-gray-500">
            Students, alumni, tutors and parents — your honest review helps others decide.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {/* Photo upload */}
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 flex-shrink-0">
            {photo ? (
              <>
                <img
                  src={photo}
                  alt="Your profile preview"
                  className="h-20 w-20 rounded-full border-2 border-gold-brand object-cover"
                />
                <button
                  type="button"
                  onClick={() => setPhoto(undefined)}
                  aria-label="Remove photo"
                  className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-navy-950 text-white transition-transform hover:scale-110"
                >
                  <i className="bi bi-x-lg text-[10px]" aria-hidden="true" />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-50 text-gray-400 transition-colors hover:border-gold-brand hover:text-gold-700"
                aria-label="Upload your photo"
              >
                {uploading ? (
                  <i className="bi bi-arrow-repeat animate-spin text-xl" aria-hidden="true" />
                ) : (
                  <i className="bi bi-camera text-2xl" aria-hidden="true" />
                )}
              </button>
            )}
          </div>
          <div>
            <p className="text-sm font-bold text-navy-950">Your photo</p>
            <p className="mt-0.5 text-xs text-gray-500">
              Show the community who you are. JPG or PNG.
            </p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-1.5 text-xs font-bold text-teal-brand hover:underline"
            >
              {photo ? 'Change photo' : 'Upload photo'}
            </button>
            {errors.photo && (
              <p className="mt-1 text-xs text-red-600">{errors.photo}</p>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
        </div>

        {/* Rating */}
        <div>
          <label className="mb-2 block text-sm font-bold text-navy-950">
            Your rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-1" onMouseLeave={() => setHoveredStar(0)}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => set('rating', star)}
                onMouseEnter={() => setHoveredStar(star)}
                aria-label={`Rate ${star} star${star > 1 ? 's' : ''}`}
                aria-pressed={form.rating >= star}
                className="p-0.5 transition-transform hover:scale-110 active:scale-90"
              >
                <i
                  className={cn(
                    'bi text-2xl',
                    (hoveredStar || form.rating) >= star
                      ? 'bi-star-fill text-gold-brand'
                      : 'bi-star text-gray-300'
                  )}
                  aria-hidden="true"
                />
              </button>
            ))}
            {form.rating > 0 && (
              <span className="ml-2 text-sm font-bold text-navy-900">{form.rating}.0</span>
            )}
          </div>
          {errors.rating && <p className="mt-1 text-xs text-red-600">{errors.rating}</p>}
        </div>

        {/* Name */}
        <div>
          <label htmlFor="rv-name" className="mb-2 block text-sm font-bold text-navy-950">
            Full name <span className="text-red-500">*</span>
          </label>
          <input
            id="rv-name"
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Adaeze Okonkwo"
            className={cn(
              'w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2',
              errors.name
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-200 focus:border-navy-900 focus:ring-navy-900/20'
            )}
          />
          {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
        </div>

        {/* Role */}
        <div>
          <label htmlFor="rv-role" className="mb-2 block text-sm font-bold text-navy-950">
            I am a… <span className="text-red-500">*</span>
          </label>
          <select
            id="rv-role"
            value={form.role}
            onChange={(e) => set('role', e.target.value)}
            className={cn(
              'w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2',
              errors.role
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-200 focus:border-navy-900 focus:ring-navy-900/20'
            )}
          >
            <option value="">Select your role</option>
            {ROLES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.role && <p className="mt-1 text-xs text-red-600">{errors.role}</p>}
        </div>

        {/* Course */}
        <div>
          <label htmlFor="rv-course" className="mb-2 block text-sm font-bold text-navy-950">
            Course / program <span className="text-red-500">*</span>
          </label>
          <select
            id="rv-course"
            value={form.course}
            onChange={(e) => set('course', e.target.value)}
            className={cn(
              'w-full rounded-xl border bg-gray-50 px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2',
              errors.course
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-200 focus:border-navy-900 focus:ring-navy-900/20'
            )}
          >
            <option value="">Select a course</option>
            {COURSE_OPTIONS.map((course) => (
              <option key={course} value={course}>
                {course}
              </option>
            ))}
          </select>
          {errors.course && <p className="mt-1 text-xs text-red-600">{errors.course}</p>}
        </div>

        {/* Outcome */}
        <div>
          <label htmlFor="rv-outcome" className="mb-2 block text-sm font-bold text-navy-950">
            Career outcome <span className="font-normal text-gray-400">(optional)</span>
          </label>
          <input
            id="rv-outcome"
            type="text"
            value={form.outcome}
            onChange={(e) => set('outcome', e.target.value)}
            placeholder="e.g. Data Analyst at Flutterwave"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
          />
        </div>
      </div>

      {/* Review text */}
      <div className="mt-5">
        <label htmlFor="rv-text" className="mb-2 block text-sm font-bold text-navy-950">
          Your review <span className="text-red-500">*</span>
        </label>
        <textarea
          id="rv-text"
          rows={4}
          value={form.text}
          onChange={(e) => set('text', e.target.value)}
          placeholder="What did you learn? How was the teaching? What are you able to do now that you couldn't before?"
          className={cn(
            'w-full resize-y rounded-xl border bg-gray-50 px-4 py-3.5 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2',
            errors.text
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
              : 'border-gray-200 focus:border-navy-900 focus:ring-navy-900/20'
          )}
        />
        <div className="mt-1 flex items-center justify-between">
          {errors.text ? (
            <p className="text-xs text-red-600">{errors.text}</p>
          ) : (
            <p className="text-xs text-gray-400">
              Minimum {REVIEW_LIMITS.MIN_TEXT} characters — specifics help future students.
            </p>
          )}
          <span
            className={cn(
              'text-xs tabular-nums',
              textLen > REVIEW_LIMITS.MAX_TEXT ? 'text-red-600' : 'text-gray-400'
            )}
          >
            {textLen}/{REVIEW_LIMITS.MAX_TEXT}
          </span>
        </div>
      </div>

      {/* Email (optional, for verification when the backend ships) */}
      <div className="mt-4">
        <label htmlFor="rv-email" className="mb-2 block text-sm font-bold text-navy-950">
          Email <span className="font-normal text-gray-400">(optional — never shown)</span>
        </label>
        <input
          id="rv-email"
          type="email"
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm transition-all focus:border-navy-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-navy-900/20"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || uploading}
        className="mt-6 w-full rounded-xl bg-gold-brand py-4 text-base font-bold text-navy-950 shadow-md transition-all hover:bg-gold-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Publishing your review…' : 'Publish My Review'}
      </button>
      <p className="mt-3 text-center text-xs text-gray-400">
        By posting you agree to our community guidelines. Reviews are tied to your browser
        until our verification system launches.
      </p>
    </form>
  );
}

export default ReviewForm;
