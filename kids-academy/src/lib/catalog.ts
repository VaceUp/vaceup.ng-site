import { API_BASE_URL } from './config';

export interface KidsCategory {
  id: number;
  name: string;
  slug: string;
}

export interface KidsProgram {
  id: number;
  slug: string;
  title: string;
  description: string;
  tagline?: string;
  target_audience?: string;
  duration?: string;
  level?: string;
  price: string | number;
  thumbnail?: string | null;
  image_url?: string;
}

interface Page<T> {
  results: T[];
  next?: string | null;
}

async function request<T>(path: string, signal: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('The programme catalogue is temporarily unavailable. Please try again.');
  return response.json() as Promise<T>;
}

export async function getKidsPrograms(signal: AbortSignal) {
  const categories = await request<Page<KidsCategory>>('/categories/?page=1', signal);
  const category = categories.results.find((item) => item.name.toLowerCase() === 'kids tech academy');
  if (!category) return [];
  const courses = await request<Page<KidsProgram>>(`/courses/?is_published=true&category=${category.id}&page=1`, signal);
  return courses.results;
}

export function formatPrice(value: string | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value));
}

export function programImage(program: KidsProgram) {
  return program.thumbnail || program.image_url || '';
}
