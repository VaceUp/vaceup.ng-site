import { api } from './api';

export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export interface ManagedCourse {
  id: number; slug: string; title: string; category: number; instructor: number;
  description: string; duration: string; image_url: string; thumbnail: string | null;
  level: CourseLevel; price: string; is_published: boolean;
}
export interface ManagedCategory { id: number; name: string; slug: string; }
export interface ManagedTutor { id: number; full_name: string; email: string; is_active: boolean; }
export interface ManagedLesson {
  id: number; module: number; title: string; content: string; order: number;
  video_url: string; video_key: string; duration_seconds: number; is_preview: boolean;
}
export interface ManagedModule { id: number; course: number; title: string; order: number; lessons: ManagedLesson[]; }
interface Page<T> { results: T[]; next: string | null; }

/** Keep pagination on our API origin; never forward credentials to a next URL. */
export async function managementList<T>(endpoint: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 1000; page++) {
    const response = await api.request<T[] | Page<T>>(`${endpoint}${endpoint.includes('?') ? '&' : '?'}page=${page}`, { cache: 'no-store' });
    if (Array.isArray(response)) return [...rows, ...response];
    if (!Array.isArray(response.results)) throw new Error('Unexpected list response. Refresh or contact support.');
    rows.push(...response.results);
    if (!response.next) return rows;
  }
  throw new Error('The list is too large to load safely. Contact support.');
}
export const managedCourses = () => managementList<ManagedCourse>('/admin/dashboard/courses/');
export const managedCategories = () => managementList<ManagedCategory>('/categories/');
export const managedTutors = async () => (await managementList<ManagedTutor>('/admin/dashboard/users/?role=instructor')).filter((tutor) => tutor.is_active);
export const courseEndpoint = (course: Pick<ManagedCourse, 'slug'>) => `/courses/${encodeURIComponent(course.slug)}/`;
export const failureMessage = (error: unknown) => error instanceof Error ? error.message : 'The change could not be saved. Please try again.';
