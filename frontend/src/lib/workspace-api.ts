import { api } from './api';

export interface WorkspaceCourse {
  id: number; title: string; slug: string; description: string; instructor_name: string;
  category_name: string; thumbnail: string | null; image_url: string; is_published: boolean;
  level: string; duration: string; lesson_count: number | null; enrollment_id: number | null;
  enrollment_status: 'active' | 'completed' | 'suspended' | null;
  progress_percent: string | null; student_count: number | null;
}
export interface WorkspaceClass {
  id: number; course: number; title: string; course_title: string; description: string;
  scheduled_start: string; duration_minutes: number; scheduled_end?: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled'; joinable: boolean; provider?: string;
}
export interface WorkspaceOverview {
  role: 'student' | 'instructor'; counts: Record<string, number>;
  recent_courses: WorkspaceCourse[]; upcoming_classes: WorkspaceClass[]; updated_at: string;
}
export interface WorkspaceLesson {
  id: number; title: string; content: string; duration_seconds: number;
  video_url: string; has_video: boolean; locked: boolean;
}
export interface WorkspaceCourseDetail {
  course: { id: number; title: string; description: string; instructor_name: string;
    modules: { id: number; title: string; lessons: WorkspaceLesson[] }[] };
  enrollment_id: number | null; completed_lesson_ids: number[];
}
export interface WorkspaceStudent {
  student_id: number; student_name: string; email: string; course: number;
  course_title: string; status: string; progress_percent: string; enrolled_at: string;
}
export interface WorkspacePayment {
  reference: string; course_title: string; amount: string; currency: string;
  status: string; paid_at: string | null; created_at: string;
}
export interface WorkspaceCertificate {
  id: number; certificate_number: string; verification_code: string; status: string;
  course_title_at_issue: string; student_name_at_issue: string; issue_date: string;
  pdf_generated_at: string | null;
}
export interface WorkspacePage<T> { count: number; next: string | null; previous: string | null; results: T[]; }
export const courseWorkspaceHref = (id: number) => `/dashboard/learn?course=${id}`;
export const progressPercent = (value: string | number | null | undefined) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, Math.round(number))) : 0;
};
export function webUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, api.baseUrl);
    return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)) ? url.href : null;
  } catch { return null; }
}
export function formatWorkspaceDate(value: string | null | undefined, withTime = false) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-NG', { day: 'numeric', month: 'short', year: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit' as const } : {}) }).format(date);
}
