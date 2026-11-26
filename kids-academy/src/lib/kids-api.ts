import { KIDS_API_BASE_URL } from './config';
import type { KidsProgram } from './catalog';

const TOKEN_KEY = 'kids_access_token';

export interface KidsParent {
  id: number;
  email: string;
  full_name: string;
  phone: string;
  relationship: string;
  consent_status: string;
  consented_at: string | null;
}

export interface KidsLearner {
  id: number;
  full_name: string;
  preferred_name: string;
  date_of_birth: string | null;
  status: string;
  created_at: string;
}

export interface KidsAdmission {
  id: number;
  learner: number;
  learner_name: string;
  course: number;
  course_title: string;
  intake: number | null;
  intake_title: string;
  payment_preference: 'pay_now' | 'pay_later';
  status: string;
  parent_note: string;
  created_at: string;
  reviewed_at: string | null;
}

export interface KidsEnrollment {
  id: number;
  learner: number;
  learner_name: string;
  course: number;
  course_title: string;
  status: string;
  current_stage: number;
  progress_percent: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface KidsPortal {
  parent: KidsParent;
  learners: KidsLearner[];
  admissions: KidsAdmission[];
  enrollments: KidsEnrollment[];
}

function token() {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(TOKEN_KEY) || '';
}

export function hasKidsSession() {
  return Boolean(token());
}

export function clearKidsSession() {
  if (typeof window !== 'undefined') window.localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}, authenticated = true): Promise<T> {
  const headers: HeadersInit = {
    ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
    ...options.headers,
  };
  const access = token();
  if (authenticated && access) (headers as Record<string, string>).Authorization = `Bearer ${access}`;
  const response = await fetch(`${KIDS_API_BASE_URL}${path}`, { ...options, headers });
  const raw = await response.text();
  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch { body = { detail: raw }; }
  if (!response.ok) {
    const detail = body?.detail || Object.values(body || {}).flat().join(' ') || 'The Kids Academy service is unavailable.';
    throw new Error(String(detail));
  }
  return body as T;
}

export async function registerParent(data: { email: string; full_name: string; password: string; phone?: string; relationship?: string }) {
  return request<{ detail: string; verification_email_queued: boolean }>('/auth/register/', { method: 'POST', body: JSON.stringify(data) }, false);
}

export async function verifyKidsEmail(tokenValue: string) {
  return request<{ detail: string }>('/auth/verify-email/', { method: 'POST', body: JSON.stringify({ token: tokenValue }) }, false);
}

export async function resendKidsVerification(email: string) {
  return request<{ detail: string }>('/auth/resend-verification/', { method: 'POST', body: JSON.stringify({ email }) }, false);
}

export async function loginParent(email: string, password: string) {
  const result = await request<{ access: string }>('/auth/login/', { method: 'POST', body: JSON.stringify({ email, password }) }, false);
  if (typeof window !== 'undefined') window.localStorage.setItem(TOKEN_KEY, result.access);
  return result;
}

export async function logoutParent() {
  try { await request('/auth/logout/', { method: 'POST' }); } finally { clearKidsSession(); }
}

export function getKidsMe() {
  return request<{ user: { id: number; email: string; full_name: string }; parent: KidsParent; learners: KidsLearner[] }>('/auth/me/');
}

export function getKidsPortal() {
  return request<KidsPortal>('/portal/');
}

export function createLearner(data: { full_name: string; preferred_name?: string; date_of_birth?: string }) {
  return request<KidsLearner>('/learners/', { method: 'POST', body: JSON.stringify(data) });
}

export function getPrograms() {
  return request<KidsProgram[]>('/programs/', {}, false);
}

export function getProgram(slug: string) {
  return request<KidsProgram>(`/programs/${encodeURIComponent(slug)}/`, {}, false);
}

export function submitAdmission(data: { learner: number; course: number; payment_preference: 'pay_now' | 'pay_later'; parent_note?: string }) {
  return request<KidsAdmission>('/admissions/', { method: 'POST', body: JSON.stringify(data) });
}
