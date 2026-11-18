/** API shapes mirrored from the web client's lib/api.ts so both frontends
 * track one backend contract. */
export type Role = 'admin' | 'instructor' | 'student';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role?: Role;
  phone_number?: string;
  avatar?: string;
  is_verified: boolean;
  is_active: boolean;
  date_joined: string;
}

export interface AuthResponse {
  access?: string;
  refresh?: string;
  user?: User;
  detail?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Course {
  id: string;
  title: string;
  slug: string;
  category: string;
  tagline: string;
  level: string;
  duration: string;
  price: string;
  numeric_price: number;
  description: string;
  image: string;
  learning_outcomes?: string;
  outline?: string;
  is_published?: boolean;
}

export interface Enrollment {
  id: string;
  course: Course;
  enrolled_at: string;
  completed_at?: string;
  progress: number;
  is_completed: boolean;
  certificate_issued: boolean;
}

export interface DashboardStats {
  courses_enrolled: number;
  hours_learned: number;
  certificates_earned: number;
  streak: number;
}

export interface DashboardCourse {
  id: string;
  title: string;
  thumbnail: string;
  progress: number;
  next_lesson: string;
  instructor: string;
  total_lessons: number;
  completed_lessons: number;
}

export interface WorkspaceLesson {
  id: string;
  title: string;
  content: string;
  has_video: boolean;
}

export interface WorkspaceModule {
  id: string;
  week: number;
  title: string;
  lessons: WorkspaceLesson[];
}

export interface WorkspaceCourseDetail {
  course: { title: string; description?: string; modules: WorkspaceModule[] };
  completed_lesson_ids: string[];
}

export interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  object_id: number | null;
}

export interface ChallengeCategory {
  id: number;
  slug: string;
  name: string;
  enabled?: boolean;
}

export interface ChallengeRound {
  id: number;
  title: string;
  slug: string;
  description: string;
  status: string;
  mode: 'hybrid' | 'quality_only';
  registration_open?: boolean;
  categories: ChallengeCategory[];
}

export interface ChallengePortal {
  registration: {
    id: string;
    full_name: string;
    email: string;
    category: { id: number; name: string; brief?: string };
    round: ChallengeRound;
    email_verified: boolean;
  };
  submission: { id: string; revision: number; post_url: string; status: string } | null;
  assessment_status: string;
  result?: { rank?: number; winner?: boolean; total?: string | null; award?: string } | null;
  engagement: Array<{ id: string; likes: number | null; comments: number | null; observed_at: string; source: string }>;
}
