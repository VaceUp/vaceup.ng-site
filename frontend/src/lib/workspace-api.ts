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
  join_url?: string; recording_status?: 'pending' | 'processing' | 'ready' | 'failed';
  recording_available?: boolean; attended?: boolean;
}
export interface WorkspaceAgendaItem {
  kind: 'class' | 'assignment' | 'quiz'; id: number; title: string;
  course_id: number; course_title: string; when: string | null; state: string;
  detail: string; href: string;
}
export interface WorkspaceTask { kind: string; label: string; count: number; href: string; }
export interface WorkspaceApplication {
  id: number; course: number; course_title: string; course_slug: string;
  price: string; reviewed_at: string | null;
}
export interface WorkspaceOverview {
  role: 'student' | 'instructor'; counts: Record<string, number>;
  recent_courses: WorkspaceCourse[]; upcoming_classes: WorkspaceClass[];
  agenda: WorkspaceAgendaItem[]; tasks: WorkspaceTask[];
  approved_applications: WorkspaceApplication[]; updated_at: string;
}
export interface WorkspaceLesson {
  id: number; title: string; content: string; duration_seconds: number;
  video_url: string; has_video: boolean; locked: boolean;
}
export interface WorkspaceModule {
  id: number; title: string; week: number; duration_minutes: number;
  meeting_url: string; lessons: WorkspaceLesson[];
}
export interface WorkspaceCourseDetail {
  course: { id: number; title: string; description: string; instructor_name: string;
    modules: WorkspaceModule[] };
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
export interface GradebookAssignmentCell {
  status: string; score: string | null; percent: number | null;
  submitted_at: string | null; is_late: boolean;
}
export interface GradebookQuizCell {
  status: string; score: string | null; percent: number | null; passed: boolean;
}
export interface GradebookStudent {
  student_id: number; student_name: string; email: string; enrollment_status: string;
  progress_percent: string; enrolled_at: string;
  assignments: Record<string, GradebookAssignmentCell>;
  quizzes: Record<string, GradebookQuizCell>;
  graded_items: number; average_percent: number | null;
}
export interface Gradebook {
  course: { id: number; title: string };
  assignments: { id: number; title: string; due_at: string; max_score: string }[];
  quizzes: { id: number; title: string; status: string; pass_mark: string }[];
  students: GradebookStudent[];
  summary: {
    students: number; active: number; completed: number; average_progress: number;
    average_grade: number | null; awaiting_grading: number;
  };
}
export interface WorkspaceAnnouncement {
  id: number; title: string; body: string; target: string;
  priority: 'low' | 'normal' | 'high' | 'critical'; status: string;
  publish_at: string | null; expires_at: string | null;
  author_name: string; pin_to_top: boolean; allow_comments: boolean;
  has_read: boolean; unread: boolean;
  created_at: string; updated_at: string;
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
