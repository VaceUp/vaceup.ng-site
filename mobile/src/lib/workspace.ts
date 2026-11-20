/** Types for the workspace and instructor endpoints, mirroring
 * apps/dashboard/member_views.py, teaching_views.py and views.py. */
export interface WorkspaceCourse {
  id: number;
  title: string;
  slug: string;
  description: string;
  instructor_name: string;
  category_name: string;
  thumbnail: string | null;
  image_url: string;
  is_published: boolean;
  level: string;
  duration: string;
  lesson_count: number | null;
  enrollment_status: string | null;
  enrollment_id: number | null;
  progress_percent: string | null;
  student_count: number | null;
}

export interface WorkspaceTask {
  kind: string;
  label: string;
  count: number;
  href: string;
}

export interface WorkspaceAgendaItem {
  kind: string;
  id: number;
  title: string;
  course_id: number;
  course_title: string;
  when: string | null;
  state: string;
  detail: string;
  href: string;
}

export interface WorkspaceApplication {
  id: number;
  course: number;
  course_title: string;
  course_slug: string;
  price: string;
  reviewed_at: string | null;
}

export interface WorkspaceOverview {
  role: string;
  counts: Record<string, number>;
  recent_courses: WorkspaceCourse[];
  upcoming_classes: Array<{ id: number; title: string; course_title: string; scheduled_start: string; duration_minutes: number; status: string; joinable: boolean }>;
  agenda: WorkspaceAgendaItem[];
  tasks: WorkspaceTask[];
  approved_applications: WorkspaceApplication[];
  updated_at: string;
}

export interface InstructorDashboard {
  courses: { total: number; published: number };
  students: number;
  enrollments: { active: number; completed: number };
  revenue: string;
  upcoming_classes: number;
  recent_enrollments: Array<{ student_name: string; course_title: string; progress_percent: string; enrolled_at: string }>;
}

export interface InstructorStudent {
  id: number;
  student: { id: number; full_name: string; email: string };
  course: { id: number; title: string; slug: string };
  status: string;
  progress_percent: string;
  enrolled_at: string;
}

export interface GradebookAssignment {
  id: number;
  title: string;
  due_at: string | null;
  max_score: number | null;
}

export interface GradebookRow {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  status: string;
  progress_percent: string;
  assignments: Record<string, { status: string; score: number | null; is_late: boolean; submitted_at: string | null }>;
  quizzes: Record<string, { status: string; total_score: number | null; passed: boolean }>;
}

export interface GradebookResponse {
  course: { id: number; title: string; slug: string };
  assignments: GradebookAssignment[];
  quizzes: Array<{ id: number; title: string }>;
  students: GradebookRow[];
}
