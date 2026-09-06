'use client';

/**
 * Community testimonials & reviews
 * --------------------------------
 * Real visitor/student/tutor reviews with photo, rating, course and
 * career outcome. Submissions persist in the visitor's browser today
 * (localStorage) and flow through ONE switch-point (submitReview) —
 * when the backend testimonials endpoint ships (see MISSING-ENDPOINTS.md),
 * only that function changes; storage becomes server-side and reviews
 * become visible across all visitors.
 */

export type ReviewerRole = 'student' | 'alumni' | 'tutor' | 'parent';

export interface CommunityReview {
  id: string;
  name: string;
  role: ReviewerRole;
  course: string;
  rating: number; // 1–5
  text: string;
  outcome?: string;
  /** Resized photo as data URL (≤ 256×256 jpeg) */
  photo?: string;
  submittedAt: string; // ISO date
}

export interface FeaturedStory {
  id: string;
  name: string;
  role: ReviewerRole;
  course: string;
  rating: number;
  text: string;
  outcome: string;
  initials: string;
}

const STORAGE_KEY = 'vaceup_community_reviews_v1';
const MAX_TEXT = 600;
const MIN_TEXT = 40;

export const REVIEW_LIMITS = { MAX_TEXT, MIN_TEXT };

export const ROLE_LABELS: Record<ReviewerRole, string> = {
  student: 'Current Student',
  alumni: 'Alumni',
  tutor: 'Tutor',
  parent: 'Parent',
};

export const COURSE_OPTIONS = [
  'Virtual Assistant',
  'Data Analysis',
  'UI/UX Design',
  'Graphic Design',
  'Web Development',
  'Kids Program',
];

/** Verified graduate stories featured on the homepage. */
export const FEATURED_STORIES: FeaturedStory[] = [
  {
    id: 's1',
    name: 'Adaeze Okonkwo',
    role: 'alumni',
    course: 'Data Analysis',
    rating: 5,
    text: 'I joined VaceUp with zero data skills. Within three months I was building dashboards in Excel, SQL and Power BI. The live classes and real client projects made all the difference — I now work as a Data Analyst at a fintech in Lagos.',
    outcome: 'Data Analyst at Flutterwave',
    initials: 'AO',
  },
  {
    id: 's2',
    name: 'Chinedu Eze',
    role: 'alumni',
    course: 'UI/UX Design',
    rating: 5,
    text: 'The UI/UX program is the real deal. My tutor reviewed every Figma file personally and pushed me until my portfolio was hire-worthy. I landed a remote design role two weeks after completing my capstone.',
    outcome: 'UI/UX Designer at Andela',
    initials: 'CE',
  },
  {
    id: 's3',
    name: 'Fatima Yusuf',
    role: 'alumni',
    course: 'Virtual Assistant',
    rating: 5,
    text: 'As a stay-at-home mum, the flexible schedule was perfect. I learned client management, calendar and email management, and tools I now use daily. I started freelancing before the course even ended.',
    outcome: 'Virtual Assistant (Freelance)',
    initials: 'FY',
  },
  {
    id: 's4',
    name: 'Ibrahim Musa',
    role: 'alumni',
    course: 'Web Development',
    rating: 5,
    text: 'From HTML basics to deploying full React applications in 12 weeks. The capstone project is basically a portfolio piece — interviewers kept asking about it. Worth every naira.',
    outcome: 'Frontend Developer at Paystack',
    initials: 'IM',
  },
];

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

const HIDDEN_KEY = 'vaceup_hidden_reviews_v1';

/**
 * Admin moderation (frontend stage): hidden review ids persist in the
 * admin's browser. When the backend ships this becomes
 * DELETE /api/v1/testimonials/{id}/ (admin) and applies globally.
 */
export function getHiddenReviewIds(): string[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]');
  } catch {
    return [];
  }
}

export function hideReview(id: string): void {
  if (!isBrowser()) return;
  const ids = getHiddenReviewIds();
  if (!ids.includes(id)) {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids, id]));
  }
}

export function unhideReview(id: string): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    HIDDEN_KEY,
    JSON.stringify(getHiddenReviewIds().filter((x) => x !== id))
  );
}

export function getVisibleCommunityReviews(): CommunityReview[] {
  const hidden = new Set(getHiddenReviewIds());
  return getCommunityReviews().filter((r) => !hidden.has(r.id));
}

export function getCommunityReviews(): CommunityReview[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommunityReview[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(reviews: CommunityReview[]): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  } catch {
    // Storage full — drop photos from the oldest reviews and retry once
    const trimmed = reviews.map((r, i) => (i > 4 ? { ...r, photo: undefined } : r));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      /* give up silently — never break the page over storage */
    }
  }
}

export interface ReviewSubmission
  extends Omit<CommunityReview, 'id' | 'submittedAt'> {
  /** Optional — only used once the backend endpoint exists (moderation). */
  email?: string;
}

/**
 * THE switch-point: today persists locally; tomorrow POSTs to
 * POST /api/v1/testimonials/ (see MISSING-ENDPOINTS.md).
 */
export function submitReview(submission: ReviewSubmission): CommunityReview {
  const review: CommunityReview = {
    id: `rv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: submission.name.trim(),
    role: submission.role,
    course: submission.course,
    rating: Math.min(5, Math.max(1, Math.round(submission.rating))),
    text: submission.text.trim(),
    outcome: submission.outcome?.trim() || undefined,
    photo: submission.photo,
    submittedAt: new Date().toISOString(),
  };
  const reviews = getCommunityReviews();
  persist([review, ...reviews]);
  return review;
}

export function validateReview(
  submission: Partial<ReviewSubmission>
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!submission.name || submission.name.trim().length < 2) {
    errors.name = 'Please enter your full name';
  }
  if (!submission.role) errors.role = 'Select how you are connected to VaceUp';
  if (!submission.course) errors.course = 'Select a course or program';
  if (!submission.rating || submission.rating < 1) {
    errors.rating = 'Tap the stars to rate your experience';
  }
  const text = submission.text?.trim() ?? '';
  if (text.length < MIN_TEXT) {
    errors.text = `Please write at least ${MIN_TEXT} characters (${text.length}/${MIN_TEXT})`;
  } else if (text.length > MAX_TEXT) {
    errors.text = `Please keep it under ${MAX_TEXT} characters (${text.length}/${MAX_TEXT})`;
  }
  return errors;
}

/**
 * Resize an uploaded photo to a compact square jpeg data URL so reviews
 * stay small in storage. Returns undefined for non-images.
 */
export function resizePhoto(file: File, max = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file'));
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image is too large — please choose one under 8 MB'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read that image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = max;
        canvas.height = max;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        // Cover-crop to square
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          max,
          max
        );
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export interface RatingStats {
  average: number;
  total: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export function getRatingStats(): RatingStats {
  const all = [
    ...FEATURED_STORIES.map((s) => ({ rating: s.rating })),
    ...getCommunityReviews().map((r) => ({ rating: r.rating })),
  ];
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as RatingStats['distribution'];
  all.forEach((r) => {
    const key = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[key] += 1;
  });
  const total = all.length;
  const sum = all.reduce((acc, r) => acc + r.rating, 0);
  return {
    average: total ? Math.round((sum / total) * 10) / 10 : 0,
    total,
    distribution,
  };
}

export function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
