import { KIDS_API_BASE_URL } from './config';

export interface KidsProgram {
  id: number;
  slug: string;
  title: string;
  description: string;
  tagline?: string;
  learning_outcomes?: string;
  target_audience?: string;
  duration?: string;
  level?: string;
  price: string | number;
  image?: string | null;
  thumbnail?: string | null;
  image_url?: string;
}

async function request<T>(path: string, signal: AbortSignal) {
  const response = await fetch(`${KIDS_API_BASE_URL}${path}`, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('The programme catalogue is temporarily unavailable. Please try again.');
  return response.json() as Promise<T>;
}

export async function getKidsPrograms(signal: AbortSignal) {
  return request<KidsProgram[]>('/programs/', signal);
}

export function formatPrice(value: string | number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(Number(value));
}

export function programImage(program: KidsProgram) {
  return program.image || program.thumbnail || program.image_url || '';
}
