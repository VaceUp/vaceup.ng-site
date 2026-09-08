import { api, type PaginatedResponse } from './api';

export interface CatalogCategory { id: number; name: string; slug: string; }
export interface CatalogCourse {
  id: number; slug: string; title: string; description: string; category: string;
  category_name?: string; instructor_name: string; level: string; price: string;
  thumbnail?: string | null; image_url?: string; duration?: string; is_published: boolean;
  modules?: { id: number; title: string; lessons: { id: number; title: string }[] }[];
}
export const formatPrice = (price: string | number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(Number(price));
export const courseImage = (course: CatalogCourse) => course.thumbnail || course.image_url || '/logo.webp';
export const courseHref = (course: CatalogCourse) => `/course?slug=${encodeURIComponent(course.slug)}`;
export function getPublicCourses(params: Record<string, string | number> = {}) {
  const query = new URLSearchParams(Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])));
  query.set('is_published', 'true');
  return api.request<PaginatedResponse<CatalogCourse>>(`/courses/?${query}`, {}, false);
}
export function getPublicCourse(slug: string) { return api.request<CatalogCourse>(`/courses/${encodeURIComponent(slug)}/`, {}, false); }
export async function getPublicCourseById(id: string) {
  const result = await getPublicCourses({ id });
  if (!result.results[0]) throw new Error('This course is not available for enrollment. Please choose a published course.');
  return result.results[0];
}
export async function getCategories(): Promise<CatalogCategory[]> {
  const result: CatalogCategory[] = [];
  for (let page = 1; ; page++) {
    const response = await api.request<PaginatedResponse<CatalogCategory>>(`/categories/?page=${page}`, {}, false);
    result.push(...response.results);
    if (!response.next) return result;
  }
}
