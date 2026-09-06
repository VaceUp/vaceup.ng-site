/**
 * VaceUp API Client - Complete backend integration
 * Auto-generated from backend API specification
 */

// Normalize: tolerate env values with or without the /api/v1 prefix
const RAW_API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://api.vaceup.ng').replace(/\/$/, '');
const API_BASE_URL = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

class ApiClient {
  baseUrl: string;
  token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) localStorage.setItem('auth_token', token);
      else localStorage.removeItem('auth_token');
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    let response = await fetch(url, { ...options, headers });

    // Access tokens are short-lived (15 min) — refresh once and retry on 401
    if (response.status === 401 && this.token && !(options as any).__retried) {
      await this.refreshToken(); // throws ApiError('Session expired') if refresh fails
      return this.request<T>(endpoint, {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${this.token}` },
        __retried: true,
      } as RequestInit);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.detail || errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }

    if (response.status === 204) return undefined as T;
    return response.json();
  }

  // ============================================
  // AUTHENTICATION
  // ============================================
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.access) this.setToken(response.access);
    return response;
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    return this.request<VerifyEmailResponse>('/auth/verify-email/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendVerification(data: ResendVerificationRequest): Promise<ResendVerificationResponse> {
    return this.request<ResendVerificationResponse>('/auth/resend-verification/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetResponse> {
    return this.request<PasswordResetResponse>('/auth/password-reset/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<PasswordResetConfirmResponse> {
    return this.request<PasswordResetConfirmResponse>('/auth/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout/', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me/');
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    const refresh =
      typeof window !== 'undefined'
        ? localStorage.getItem('refresh_token')
        : null;
    if (!refresh) throw new ApiError('No refresh token', 401);
    // Direct fetch — going through request() would recurse on 401
    const res = await fetch(`${this.baseUrl}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    });
    if (!res.ok) {
      this.setToken(null);
      if (typeof window !== 'undefined') localStorage.removeItem('refresh_token');
      throw new ApiError('Session expired', 401);
    }
    const data: RefreshTokenResponse = await res.json();
    this.setToken(data.access);
    return data;
  }

  // User Profile
  async updateProfile(data: Partial<UserProfile>): Promise<User> {
    return this.request<User>('/users/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.request<void>('/users/me/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // COURSES
  // ============================================
  async getCourses(params?: CourseListParams): Promise<PaginatedResponse<Course>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<Course>>(`/courses/?${searchParams}`);
  }

  async getCourse(id: string): Promise<Course> {
    return this.request<Course>(`/courses/${id}/`);
  }

  async enrollInCourse(courseId: string): Promise<Enrollment> {
    return this.request<Enrollment>(`/courses/${courseId}/enroll/`, { method: 'POST' });
  }

  async getMyEnrollments(): Promise<Enrollment[]> {
    return this.request<Enrollment[]>('/enrollments/my/');
  }

  async getEnrollment(id: string): Promise<Enrollment> {
    return this.request<Enrollment>(`/enrollments/${id}/`);
  }

  // ============================================
  // PAYMENTS
  // ============================================
  async initializePayment(data: InitializePaymentRequest): Promise<PaymentInitializationResponse> {
    return this.request<PaymentInitializationResponse>('/payments/initialize/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    return this.request<PaymentVerificationResponse>(`/payments/verify/${reference}/`);
  }

  async getPaymentHistory(): Promise<Payment[]> {
    return this.request<Payment[]>('/payments/history/');
  }

  // ============================================
  // CERTIFICATES
  // ============================================
  async getMyCertificates(): Promise<Certificate[]> {
    return this.request<Certificate[]>('/certificates/my/');
  }

  async getCertificate(id: string): Promise<Certificate> {
    return this.request<Certificate>(`/certificates/${id}/`);
  }

  async downloadCertificate(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/certificates/${id}/download/`, {
      headers: { 'Authorization': `Bearer ${this.token}` },
    });
    if (!response.ok) throw new ApiError('Failed to download certificate', response.status);
    return response.blob();
  }

  // ============================================
  // LIVE CLASSES
  // ============================================
  async getLiveClasses(params?: LiveClassListParams): Promise<PaginatedResponse<LiveClass>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<LiveClass>>(`/live-classes/?${searchParams}`);
  }

  async getLiveClass(id: string): Promise<LiveClass> {
    return this.request<LiveClass>(`/live-classes/${id}/`);
  }

  async joinLiveClass(id: string): Promise<LiveClassSession> {
    return this.request<LiveClassSession>(`/live-classes/${id}/join/`, { method: 'POST' });
  }

  // ============================================
  // MESSAGING
  // ============================================
  // NOTE: Message model is direct user-to-user (sender/recipient).
  async getConversations(): Promise<any[]> {
    return this.request<any[]>('/messages/');
  }

  async getThread(withUserId: string): Promise<any[]> {
    const res = await this.request<any>(`/messages/thread/?with=${encodeURIComponent(withUserId)}`);
    return res.results ?? res;
  }

  async sendUserMessage(recipientId: string, body: string): Promise<any> {
    return this.request<any>('/messages/', {
      method: 'POST',
      body: JSON.stringify({ recipient: recipientId, body }),
    });
  }

  async getUnreadCount(): Promise<number> {
    const res = await this.request<{ unread: number }>('/messages/unread-count/');
    return res.unread ?? 0;
  }

  async createConversation(userId: string): Promise<Conversation> {
    // No conversation-creation endpoint — direct messages start on first send.
    void userId;
    throw new Error('Start a chat by sending the first message instead.');
  }

  // ============================================
  // DASHBOARD
  // ============================================
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats/');
  }

  async getDashboardCourses(): Promise<DashboardCourse[]> {
    return this.request<DashboardCourse[]>('/dashboard/courses/');
  }

  // ============================================
  // CART
  // ============================================
  async getCart(): Promise<Cart> {
    return this.request<Cart>('/cart/');
  }

  async addToCart(data: AddToCartRequest): Promise<CartItem> {
    return this.request<CartItem>('/cart/items/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCartItem(itemId: string, quantity: number): Promise<CartItem> {
    return this.request<CartItem>(`/cart/items/${itemId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeFromCart(itemId: string): Promise<void> {
    return this.request<void>(`/cart/items/${itemId}/`, { method: 'DELETE' });
  }

  async clearCart(): Promise<void> {
    return this.request<void>('/cart/', { method: 'DELETE' });
  }

  // ============================================
  // APPLICATIONS (admissions)
  // ============================================
  async getApplications(params?: ApplicationListParams): Promise<PaginatedResponse<Application>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<Application>>(`/applications/?${searchParams}`);
  }

  async submitApplication(data: SubmitApplicationRequest): Promise<Application> {
    return this.request<Application>('/applications/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ============================================
  // ANNOUNCEMENTS (backend: apps.announcements)
  // ============================================
  async getAnnouncements(params?: AnnouncementListParams): Promise<PaginatedResponse<Announcement>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<Announcement>>(`/announcements/?${searchParams}`);
  }

  async getAnnouncement(id: string): Promise<Announcement> {
    return this.request<Announcement>(`/announcements/${id}/`);
  }

  // ============================================
  // ASSIGNMENTS & QUIZZES (backend: apps.assignments)
  // ============================================
  async getAssignments(params?: AssignmentListParams): Promise<PaginatedResponse<Assignment>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<Assignment>>(`/assignments/?${searchParams}`);
  }

  async getAssignment(id: string): Promise<Assignment> {
    return this.request<Assignment>(`/assignments/${id}/`);
  }

  async getSubmissions(params?: AssignmentListParams): Promise<PaginatedResponse<Submission>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<Submission>>(`/submissions/?${searchParams}`);
  }

  async submitAssignment(assignmentId: string, data: SubmitAssignmentRequest): Promise<Submission> {
    // NOTE: confirm the exact submit action path against /api/schema/ once the
    // backend is redeployed — DefaultRouter usually exposes POST /submissions/.
    return this.request<Submission>('/submissions/', {
      method: 'POST',
      body: JSON.stringify({ assignment: assignmentId, ...data }),
    });
  }

  async getQuizzes(params?: AssignmentListParams): Promise<PaginatedResponse<Quiz>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<Quiz>>(`/quizzes/?${searchParams}`);
  }

  async getQuizAttempts(params?: AssignmentListParams): Promise<PaginatedResponse<QuizAttempt>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<QuizAttempt>>(`/quiz-attempts/?${searchParams}`);
  }

  // ============================================
  // CODE EDITOR & WHITEBOARD (backend REST sessions; realtime runs over WebSocket)
  // ============================================
  async getCodeEditorSessions(params?: AssignmentListParams): Promise<PaginatedResponse<CollabSession>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<CollabSession>>(`/code-editor/sessions/?${searchParams}`);
  }

  async getWhiteboardSessions(params?: AssignmentListParams): Promise<PaginatedResponse<CollabSession>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<CollabSession>>(`/whiteboard/sessions/?${searchParams}`);
  }

  // ============================================
  // NOTIFICATIONS
  // ============================================
  async getNotifications(params?: NotificationListParams): Promise<PaginatedResponse<Notification>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) searchParams.append(key, String(value));
      });
    }
    return this.request<PaginatedResponse<Notification>>(`/notifications/?${searchParams}`);
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`/notifications/${id}/read/`, { method: 'POST' });
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/notifications/read-all/', { method: 'POST' });
  }

  // ============================================
  // HEALTH CHECK
  // ============================================
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/healthz/');
  }
}

// ============================================
// TYPES
// ============================================

export class ApiError extends Error {
  constructor(public message: string, public status: number, public data?: any) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
  phone_number?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface VerifyEmailRequest { token: string; }
export interface VerifyEmailResponse { detail: string; }
export interface ResendVerificationRequest { email: string; }
export interface ResendVerificationResponse { detail: string; }
export interface PasswordResetRequest { email: string; }
export interface PasswordResetResponse { detail: string; }
export interface PasswordResetConfirmRequest { token: string; new_password: string; }
export interface PasswordResetConfirmResponse { detail: string; }
export interface RefreshTokenResponse { access: string; }

export interface User {
  id: string;
  email: string;
  full_name: string;
  role?: 'admin' | 'instructor' | 'student';
  phone_number?: string;
  avatar?: string;
  is_verified: boolean;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
}

export interface UserProfile {
  full_name?: string;
  phone_number?: string;
  avatar?: string;
  bio?: string;
  date_of_birth?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
  confirm_password: string;
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
  learnings: string[];
  modules: CourseModule[];
  benefits: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseModule { title: string; topics?: string[]; }

export interface CourseListParams {
  page?: number; page_size?: number; category?: string;
  level?: string; search?: string; ordering?: string; limit?: number;
}

export interface PaginatedResponse<T> {
  count: number; next: string | null; previous: string | null; results: T[];
}

export interface Enrollment {
  id: string; course: Course; enrolled_at: string; completed_at?: string;
  progress: number; is_completed: boolean; certificate_issued: boolean; certificate?: Certificate;
}

export interface Certificate {
  id: string; course: Course; student_name: string; issued_at: string;
  certificate_number: string; verification_code: string; status: string;
  instructor: string; instructor_avatar: string; skills: string[]; grade: string;
}

export interface InitializePaymentRequest {
  course_id: string; email: string; amount: number; currency?: string; callback_url?: string;
}

export interface PaymentInitializationResponse {
  authorization_url: string; access_code: string; reference: string;
}

export interface PaymentVerificationResponse {
  status: string; reference: string; amount: number; currency: string;
  paid_at: string; course: Course;
}

export interface Payment { id: string; course: Course; amount: number; currency: string; status: string; reference: string; paid_at: string; }

export interface LiveClass {
  id: string; title: string; instructor: string; instructor_avatar: string;
  scheduled_at: string; duration: number; status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  enrolled: boolean; thumbnail: string; description: string; enrolled_count: number; max_students: number;
}

export interface LiveClassListParams { page?: number; page_size?: number; status?: string; search?: string; }

export interface LiveClassSession { id: string; live_class: LiveClass; join_url: string; started_at?: string; ended_at?: string; }

export interface Conversation {
  id: string; participant: { id: string; name: string; avatar: string; online: boolean; };
  last_message: string; timestamp: string; unread_count: number;
}

export interface Message {
  id: string;
  sender: string;
  sender_name: string;
  recipient: string;
  body: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ConversationSummary {
  user_id: string;
  full_name: string;
  role: string;
  unread: number;
  last_message: string;
  last_at: string;
  last_from_me: boolean;
}

export interface DashboardStats { courses_enrolled: number; hours_learned: number; certificates_earned: number; streak: number; }

export interface DashboardCourse { id: string; title: string; thumbnail: string; progress: number; next_lesson: string; instructor: string; total_lessons: number; completed_lessons: number; }

export interface Cart { id: string; items: CartItem[]; subtotal: number; discount: number; total: number; item_count: number; }

export interface CartItem { id: string; course: Course; quantity: number; price: number; }

export interface AddToCartRequest { course_id: string; quantity?: number; }

export interface Application { id: string; course_title: string; course_thumbnail: string; student_name: string; student_avatar: string; submitted_at: string; status: 'submitted' | 'under_review' | 'approved' | 'rejected'; motivation: string; reviewed_at?: string; reviewed_by?: string; }

export interface ApplicationListParams { page?: number; page_size?: number; status?: string; }

export interface SubmitApplicationRequest { course_id: string; motivation: string; }

export interface Announcement {
  id: string;
  title: string;
  body: string;
  target: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  status: 'draft' | 'scheduled' | 'published' | 'archived';
  publish_at?: string;
  created_at?: string;
}

export interface AnnouncementListParams { page?: number; page_size?: number; priority?: string; target?: string; }

export interface Assignment {
  id: string;
  title: string;
  description: string;
  course: string;
  due_date?: string;
  max_score?: number;
  created_at?: string;
}

export interface Submission {
  id: string;
  assignment: string;
  student: string;
  content?: string;
  file?: string;
  submitted_at?: string;
  grade?: number | null;
  feedback?: string;
  status: string;
}

export interface Quiz {
  id: string;
  title: string;
  course: string;
  description?: string;
  time_limit?: number;
  pass_score?: number;
}

export interface QuizAttempt {
  id: string;
  quiz: string;
  student: string;
  score?: number;
  passed?: boolean;
  started_at?: string;
  completed_at?: string;
}

export interface CollabSession {
  id: string;
  title: string;
  course?: string;
  created_by?: string;
  created_at?: string;
}

export interface AssignmentListParams { page?: number; page_size?: number; course?: string; search?: string; }

export interface SubmitAssignmentRequest { content?: string; file_url?: string; }

export interface Notification { id: string; title: string; message: string; type: string; is_read: boolean; created_at: string; related_object_id?: string; related_object_type?: string; }

export interface NotificationListParams { page?: number; page_size?: number; is_read?: boolean; }

export interface HealthCheckResponse { status: string; version: string; timestamp: string; }

// Create singleton instance
export const api = new ApiClient();
export function getApiClient(): ApiClient { return api; }