/**
 * Canonical course catalog — the single source of truth shared by the
 * homepage cards, courses list, course detail mocks, apply page and
 * checkout. IDs must stay in sync with courses/[id] mockCourses.
 */

export interface CanonicalCourse {
  id: string;
  title: string;
  price: number;
  duration: string;
  level: string;
}

export const CANONICAL_COURSES: CanonicalCourse[] = [
  { id: '1', title: 'Virtual Assistant', price: 80000, duration: '6 weeks', level: 'Beginner' },
  { id: '2', title: 'Data Analysis', price: 150000, duration: '10 weeks', level: 'Beginner' },
  { id: '3', title: 'UI/UX Design', price: 120000, duration: '8 weeks', level: 'Beginner' },
  { id: '4', title: 'Graphic Design', price: 100000, duration: '8 weeks', level: 'Beginner' },
  { id: '5', title: 'Web Development', price: 180000, duration: '12 weeks', level: 'Intermediate' },
];

/** Quick lookup by id for checkout and other flows. */
export const CANONICAL_FALLBACK: Record<string, { title: string; price: number }> =
  Object.fromEntries(CANONICAL_COURSES.map((c) => [c.id, { title: c.title, price: c.price }]));
