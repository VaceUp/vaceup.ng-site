/** Typed API client for the VaceUp backend, mirroring the web client's
 * contract: JWT pair with a single silent refresh, secure token storage,
 * and the same field-level error flattening so screens can show real
 * validation messages instead of a bare status code. */
import Constants from 'expo-constants';

import { clearTokens, readAccessToken, readRefreshToken, saveTokens } from './storage';
import type {
  AuthResponse, ChallengePortal, ChallengeRound, Course, DashboardCourse, DashboardStats,
  Enrollment, Notification, PaginatedResponse, User, WorkspaceCourseDetail,
} from './types';

const BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl
  || process.env.EXPO_PUBLIC_API_URL
  || 'https://api.vaceup.ng/api/v1';

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/** Same normalization as the web client: DRF field errors become
 * "field: message" lines joined with a middot; non-JSON bodies show a
 * readable snippet so the real cause is never a bare "HTTP 500". */
export function apiErrorMessage(data: unknown, status: number): string {
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const error = data as Record<string, unknown>;
    const raw = typeof error.raw === 'string' ? error.raw.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '';
    if (raw) {
      const snippet = raw.length > 220 ? `${raw.slice(0, 220)}...` : raw;
      return `The server answered HTTP ${status} with: ${snippet}`;
    }
    const nested = error.error as { detail?: unknown } | undefined;
    const detail = error.detail ?? nested?.detail ?? error.message;
    if (typeof detail === 'string' && detail.trim()) return detail;
    const messages = Object.entries(error).flatMap(([field, value]) => {
      const entries = Array.isArray(value) ? value : [value];
      const label = field === 'non_field_errors' ? '' : field.replaceAll('_', ' ');
      return entries
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => (label ? `${label}: ${entry}` : entry));
    });
    if (messages.length) return messages.join(' · ');
  }
  if (status === 400) return 'Your request could not be accepted. Check the form and try again.';
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 429) return 'Too many attempts. Please wait a moment before trying again.';
  if (status >= 500) return 'The service is temporarily unavailable. Please try again shortly.';
  return `Request failed (HTTP ${status}). Please check your connection and try again.`;
}

type AuthListener = () => void;

class ApiClient {
  private accessToken: string | null = null;
  private refreshListeners = new Set<AuthListener>();
  private refreshInFlight: Promise<boolean> | null = null;

  /** Screens subscribe to know when the signed-in identity changes. */
  onAuthChanged(listener: AuthListener): () => void {
    this.refreshListeners.add(listener);
    return () => this.refreshListeners.delete(listener);
  }

  private notify(): void {
    this.refreshListeners.forEach((listener) => listener());
  }

  async restoreSession(): Promise<boolean> {
    this.accessToken = await readAccessToken();
    if (!this.accessToken) return false;
    // A token that fails once will be refreshed by the request path itself.
    return true;
  }

  setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.notify();
    void saveTokens(access, refresh);
  }

  async setStoredSession(): Promise<void> {
    this.accessToken = await readAccessToken();
    this.notify();
  }

  clearSession(): void {
    this.accessToken = null;
    this.notify();
    void clearTokens();
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== null;
  }

  private async refreshAccessToken(): Promise<boolean> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      const refresh = await readRefreshToken();
      if (!refresh) return false;
      try {
        const response = await fetch(`${BASE_URL}/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!response.ok) return false;
        const data = (await response.json()) as { access?: string };
        if (!data.access) return false;
        this.accessToken = data.access;
        this.notify();
        void saveTokens(data.access, refresh);
        return true;
      } catch {
        return false;
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  async request<T>(path: string, options: RequestInit = {}, authenticated = true, retry = true): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) ?? {}),
    };
    if (authenticated && this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}${path}`, { ...options, headers });
    } catch {
      throw new ApiError('You appear to be offline. Check your connection and try again.', 0, {});
    }

    const raw = await response.text().catch(() => '');
    let data: unknown = {};
    if (response.status !== 204 && raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { raw };
      }
    }

    if (response.status === 401 && authenticated && retry) {
      const refreshed = await this.refreshAccessToken();
      if (refreshed) return this.request<T>(path, options, authenticated, false);
      // The refresh is dead: sign the user out with the friendly message
      // instead of surfacing the raw backend detail.
      this.clearSession();
      throw new ApiError('Your session has expired. Please sign in again.', 401, data);
    }

    if (!response.ok) throw new ApiError(apiErrorMessage(data, response.status), response.status, data);
    return (response.status === 204 ? undefined : data) as T;
  }

  // ---------------------------------------------------------------- auth
  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/login/', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }, false);
    if (response.access && response.refresh) this.setTokens(response.access, response.refresh);
    return response;
  }

  async register(fullName: string, email: string, phoneNumber: string, password: string): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/register/', {
      method: 'POST',
      body: JSON.stringify({ full_name: fullName, email, phone_number: phoneNumber, password, password2: password }),
    }, false);
  }

  async me(): Promise<User> {
    return this.request<User>('/auth/me/');
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout/', { method: 'POST' }).catch(() => undefined);
    this.clearSession();
  }

  // ------------------------------------------------------------- catalog
  async courses(params: { search?: string; page?: number } = {}): Promise<PaginatedResponse<Course>> {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.page) query.append('page', String(params.page));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<PaginatedResponse<Course>>(`/courses/${suffix}`, {}, false);
  }

  async course(id: string): Promise<Course> {
    return this.request<Course>(`/courses/${id}/`, {}, false);
  }

  async enroll(courseId: string): Promise<Enrollment> {
    return this.request<Enrollment>('/enrollments/', { method: 'POST', body: JSON.stringify({ course: courseId }) });
  }

  // ------------------------------------------------------------- learning
  async myEnrollments(): Promise<Enrollment[]> {
    return this.request<Enrollment[]>('/enrollments/my/');
  }

  async dashboardStats(): Promise<DashboardStats> {
    return this.request<DashboardStats>('/dashboard/stats/');
  }

  async dashboardCourses(): Promise<DashboardCourse[]> {
    return this.request<DashboardCourse[]>('/dashboard/courses/');
  }

  async courseDetail(enrollmentId: string): Promise<WorkspaceCourseDetail> {
    return this.request<WorkspaceCourseDetail>(`/dashboard/courses/${enrollmentId}/`);
  }

  async completeLesson(lessonId: string): Promise<void> {
    return this.request('/enrollments/complete-lesson/', { method: 'POST', body: JSON.stringify({ lesson: lessonId }) });
  }

  async lessonPlaybackUrl(lessonId: string): Promise<string | null> {
    try {
      const result = await this.request<{ playback_url: string }>(`/lessons/${lessonId}/play/`);
      return result.playback_url ?? null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------- notifications
  async notifications(params: { page?: number; is_read?: boolean } = {}): Promise<PaginatedResponse<Notification>> {
    const query = new URLSearchParams();
    if (params.page) query.append('page', String(params.page));
    if (params.is_read !== undefined) query.append('is_read', String(params.is_read));
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.request<PaginatedResponse<Notification>>(`/notifications/${suffix}`);
  }

  async markNotificationRead(id: number): Promise<void> {
    return this.request(`/notifications/${id}/read/`, { method: 'POST' });
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request('/notifications/read-all/', { method: 'POST' });
  }

  // ----------------------------------------------------------- challenge
  async challengeRounds(): Promise<ChallengeRound[]> {
    const response = await this.request<ChallengeRound[] | { results: ChallengeRound[] }>('/challenges/rounds/', {}, false);
    return Array.isArray(response) ? response : response.results;
  }

  async challengeAccessCode(roundSlug: string, email: string, code: string): Promise<string> {
    const response = await this.request<{ access_token: string }>('/challenges/access-code/', {
      method: 'POST',
      body: JSON.stringify({ round_slug: roundSlug, email, code }),
    }, false);
    return response.access_token;
  }

  async challengePortal(token: string): Promise<ChallengePortal> {
    return this.request<ChallengePortal>('/challenges/portal/', {
      headers: { 'X-Challenge-Token': token },
    }, false);
  }
}

export const api = new ApiClient();
