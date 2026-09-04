/**
 * VaceUp API Client
 * Centralized API client for communicating with the VaceUp backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.vaceup.ng';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on initialization
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('auth_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
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

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiError(
        errorData.detail || errorData.message || `HTTP ${response.status}`,
        response.status,
        errorData
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }

  // Auth endpoints
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.request<AuthResponse>('/api/v1/auth/register/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/api/v1/auth/login/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (response.access) {
      this.setToken(response.access);
    }
    return response;
  }

  async verifyEmail(data: VerifyEmailRequest): Promise<VerifyEmailResponse> {
    return this.request<VerifyEmailResponse>('/api/v1/auth/verify-email/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendVerification(data: ResendVerificationRequest): Promise<ResendVerificationResponse> {
    return this.request<ResendVerificationResponse>('/api/v1/auth/resend-verification/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async requestPasswordReset(data: PasswordResetRequest): Promise<PasswordResetResponse> {
    return this.request<PasswordResetResponse>('/api/v1/auth/password-reset/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async confirmPasswordReset(data: PasswordResetConfirmRequest): Promise<PasswordResetConfirmResponse> {
    return this.request<PasswordResetConfirmResponse>('/api/v1/auth/password-reset/confirm/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout(): Promise<void> {
    try {
      await this.request('/api/v1/auth/logout/', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<User> {
    return this.request<User>('/api/v1/auth/me/');
  }

  async refreshToken(): Promise<RefreshTokenResponse> {
    return this.request<RefreshTokenResponse>('/api/v1/auth/refresh/', {
      method: 'POST',
    });
  }

  // User profile
  async updateProfile(data: Partial<UserProfile>): Promise<User> {
    return this.request<User>('/api/v1/users/me/', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: ChangePasswordRequest): Promise<void> {
    return this.request<void>('/api/v1/users/me/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Courses
  async getCourses(params?: CourseListParams): Promise<PaginatedResponse<Course>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<Course>>(`/api/v1/courses/?${searchParams}`);
  }

  async getCourse(id: string): Promise<Course> {
    return this.request<Course>(`/api/v1/courses/${id}/`);
  }

  async enrollInCourse(courseId: string): Promise<Enrollment> {
    return this.request<Enrollment>(`/api/v1/courses/${courseId}/enroll/`, {
      method: 'POST',
    });
  }

  async getMyEnrollments(): Promise<Enrollment[]> {
    return this.request<Enrollment[]>('/api/v1/enrollments/my/');
  }

  async getEnrollment(id: string): Promise<Enrollment> {
    return this.request<Enrollment>(`/api/v1/enrollments/${id}/`);
  }

  // Payments
  async initializePayment(data: InitializePaymentRequest): Promise<PaymentInitializationResponse> {
    return this.request<PaymentInitializationResponse>('/api/v1/payments/initialize/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyPayment(reference: string): Promise<PaymentVerificationResponse> {
    return this.request<PaymentVerificationResponse>(`/api/v1/payments/verify/${reference}/`);
  }

  async getPaymentHistory(): Promise<Payment[]> {
    return this.request<Payment[]>('/api/v1/payments/history/');
  }

  // Certificates
  async getMyCertificates(): Promise<Certificate[]> {
    return this.request<Certificate[]>('/api/v1/certificates/my/');
  }

  async getCertificate(id: string): Promise<Certificate> {
    return this.request<Certificate>(`/api/v1/certificates/${id}/`);
  }

  async downloadCertificate(id: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/api/v1/certificates/${id}/download/`, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
      },
    });
    if (!response.ok) {
      throw new ApiError('Failed to download certificate', response.status);
    }
    return response.blob();
  }

  // Live Classes
  async getLiveClasses(params?: LiveClassListParams): Promise<PaginatedResponse<LiveClass>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<LiveClass>>(`/api/v1/live-classes/?${searchParams}`);
  }

  async getLiveClass(id: string): Promise<LiveClass> {
    return this.request<LiveClass>(`/api/v1/live-classes/${id}/`);
  }

  async joinLiveClass(id: string): Promise<LiveClassSession> {
    return this.request<LiveClassSession>(`/api/v1/live-classes/${id}/join/`, {
      method: 'POST',
    });
  }

  // Announcements
  async getAnnouncements(params?: AnnouncementListParams): Promise<PaginatedResponse<Announcement>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<Announcement>>(`/api/v1/announcements/?${searchParams}`);
  }

  // Notifications
  async getNotifications(params?: NotificationListParams): Promise<PaginatedResponse<Notification>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<Notification>>(`/api/v1/notifications/?${searchParams}`);
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request<void>(`/api/v1/notifications/${id}/read/`, {
      method: 'POST',
    });
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request<void>('/api/v1/notifications/read-all/', {
      method: 'POST',
    });
  }

  // Cart
  async getCart(): Promise<Cart> {
    return this.request<Cart>('/api/v1/cart/');
  }

  async addToCart(data: AddToCartRequest): Promise<CartItem> {
    return this.request<CartItem>('/api/v1/cart/items/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCartItem(itemId: string, quantity: number): Promise<CartItem> {
    return this.request<CartItem>(`/api/v1/cart/items/${itemId}/`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  }

  async removeFromCart(itemId: string): Promise<void> {
    return this.request<void>(`/api/v1/cart/items/${itemId}/`, {
      method: 'DELETE',
    });
  }

  async clearCart(): Promise<void> {
    return this.request<void>('/api/v1/cart/', {
      method: 'DELETE',
    });
  }

  // Applications
  async getApplications(params?: ApplicationListParams): Promise<PaginatedResponse<Application>> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
    }
    return this.request<PaginatedResponse<Application>>(`/api/v1/applications/?${searchParams}`);
  }

  async submitApplication(data: SubmitApplicationRequest): Promise<Application> {
    return this.request<Application>('/api/v1/applications/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard
  async getDashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/api/v1/dashboard/stats/');
  }

  async getDashboardCourses(): Promise<DashboardCourse[]> {
    return this.request<DashboardCourse[]>('/api/v1/dashboard/courses/');
  }

  // Health check
  async healthCheck(): Promise<HealthCheckResponse> {
    return this.request<HealthCheckResponse>('/healthz/');
  }
}

// Types
export interface ApiError extends Error {
  status: number;
  data?: any;
}

export class ApiError extends Error {
  status: number;
  data?: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// Auth types
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

export interface VerifyEmailRequest {
  token: string;
}

export interface VerifyEmailResponse {
  detail: string;
}

export interface ResendVerificationRequest {
  email: string;
}

export interface ResendVerificationResponse {
  detail: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetResponse {
  detail: string;
}

export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

export interface PasswordResetConfirmResponse {
  detail: string;
}

export interface RefreshTokenResponse {
  access: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
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

// Course types
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

export interface CourseModule {
  title: string;
  topics?: string[];
}

export interface CourseListParams {
  page?: number;
  page_size?: number;
  category?: string;
  level?: string;
  search?: string;
  ordering?: string;
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface Enrollment {
  id: string;
  course: Course;
  enrolled_at: string;
  completed_at?: string;
  progress: number;
  is_completed: boolean;
  certificate_issued: boolean;
  certificate?: Certificate;
}

export interface Certificate {
  id: string;
  course: Course;
  student_name: string;
  issued_at: string;
  certificate_number: string;
  verification_code: string;
  status: string;
  instructor: string;
  instructor_avatar: string;
  skills: string[];
  grade: string;
}

// Payment types
export interface InitializePaymentRequest {
  course_id: string;
  email: string;
  amount: number;
  currency?: string;
  callback_url?: string;
}

export interface PaymentInitializationResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaymentVerificationResponse {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string;
  course: Course;
}

export interface Payment {
  id: string;
  course: Course;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  paid_at: string;
}

// Live Class types
export interface LiveClass {
  id: string;
  title: string;
  instructor: string;
  instructor_avatar: string;
  scheduled_at: string;
  duration: number;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  enrolled: boolean;
  thumbnail: string;
  description: string;
  enrolled_count: number;
  max_students: number;
}

export interface LiveClassListParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

export interface LiveClassSession {
  id: string;
  live_class: LiveClass;
  join_url: string;
  started_at?: string;
  ended_at?: string;
}

// Announcement types
export interface Announcement {
  id: string;
  title: string;
  body: string;
  target: string;
  target_courses: string[];
  priority: string;
  status: string;
  publish_at: string;
  expires_at?: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  read_count: number;
  total_recipients: number;
  created_at: string;
  updated_at: string;
}

export interface AnnouncementListParams {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

// Notification types
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
  related_object_id?: string;
  related_object_type?: string;
}

export interface NotificationListParams {
  page?: number;
  page_size?: number;
  is_read?: boolean;
}

// Cart types
export interface Cart {
  id: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  item_count: number;
}

export interface CartItem {
  id: string;
  course: Course;
  quantity: number;
  price: number;
}

export interface AddToCartRequest {
  course_id: string;
  quantity?: number;
}

// Application types
export interface Application {
  id: string;
  course_title: string;
  course_thumbnail: string;
  student_name: string;
  student_avatar: string;
  submitted_at: string;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  motivation: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export interface ApplicationListParams {
  page?: number;
  page_size?: number;
  status?: string;
}

export interface SubmitApplicationRequest {
  course_id: string;
  motivation: string;
}

// Dashboard types
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

export interface DashboardCourseListParams {
  page?: number;
  page_size?: number;
}

// Health check
export interface HealthCheckResponse {
  status: string;
  version: string;
  timestamp: string;
}

// Create singleton instance
export const api = new ApiClient();

// Helper function to get the API client
export function getApiClient(): ApiClient {
  return api;
}