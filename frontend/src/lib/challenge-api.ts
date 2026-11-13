import { api } from './api';
import { apiErrorMessage } from './api-errors';
import { putFileWithProgress } from './upload';

export type ChallengeId = string | number;
export type ChallengeMode = 'hybrid' | 'quality_only';
export interface ChallengeCategory {
  id: ChallengeId;
  name: string;
  slug?: string;
  brief?: string;
  requirements?: string[];
  deliverables?: string[];
  rubric?: Array<{ id: string; label: string; max_points: number; description: string }>;
  accepted_extensions?: string[];
  enabled?: boolean;
  email_instructions?: string;
  brief_download_url?: string;
  brief_pdf_available?: boolean;
  winner_count?: number;
}
export interface ChallengeRound {
  id: ChallengeId;
  slug: string;
  title: string;
  description: string;
  status: string;
  mode: ChallengeMode;
  registration_opens_at: string;
  registration_closes_at: string;
  submission_closes_at: string;
  final_collection_starts_at: string;
  final_collection_ends_at: string;
  results_publish_at: string;
  hashtag?: string;
  linkedin_handle?: string;
  instagram_handle?: string;
  likes_target?: number | null;
  comments_target?: number | null;
  rules?: string;
  categories: ChallengeCategory[];
  is_published?: boolean;
  registration_open?: boolean;
  published_at?: string | null;
  frozen_at?: string | null;
  results_published_at?: string | null;
  participants_count?: number;
  results?: ChallengeResult[];
}
export interface ChallengeEvidence {
  id: ChallengeId;
  name: string;
  kind: 'project' | 'engagement';
  size_bytes?: number;
  status?: string;
  download_url?: string;
}
export interface ChallengeSubmission {
  id: ChallengeId;
  post_url: string;
  explanation: string;
  status: string;
  assessment_status?: string;
  participant_message?: string;
  submitted_at?: string;
  evidence?: ChallengeEvidence[];
}
export interface EngagementSnapshot {
  id: ChallengeId;
  likes: number | null;
  comments: number | null;
  shares?: number | null;
  views?: number | null;
  source: string;
  observed_at: string;
  status?: string;
  evidence?: ChallengeEvidence[];
  created_at?: string;
  declared_counts?: { likes?: number | null; comments?: number | null; shares?: number | null; views?: number | null };
  verification_status?: string;
}
export interface ChallengeResult {
  rank?: number;
  name: string;
  category?: string;
  total?: string | number | null;
  winner?: boolean;
  full_name?: string;
  category_name?: string;
  total_score?: number;
  quality_score?: number;
  engagement_score?: number;
  award?: string;
}
export interface ChallengePortal {
  registration: { id: ChallengeId; full_name: string; email: string; phone: string; category: ChallengeCategory; round: ChallengeRound; email_verified: boolean };
  submission: ChallengeSubmission | null;
  evidence?: ChallengeEvidence[];
  assets?: ChallengeEvidence[];
  engagement: EngagementSnapshot[];
  assessment_status: string;
  result?: ChallengeResult | null;
}
export interface ChallengeScoreRow {
  registration_id: ChallengeId;
  name: string;
  email?: string;
  category: string;
  category_id: ChallengeId;
  submission_id?: ChallengeId | null;
  post_url?: string;
  status: string;
  quality_points: string | number | null;
  likes?: number | null;
  comments?: number | null;
  engagement_points: string | number | null;
  total: string | number | null;
  engagement_source?: string;
  observed_at?: string | null;
  exception?: string;
  disqualified?: boolean;
  flags: string[];
  rank: number | null;
  winner: boolean;
  evidence?: ChallengeEvidence[];
  submission?: ChallengeSubmission | null;
  engagement?: EngagementSnapshot | null;
  assessment?: { criterion_scores: Array<{ id: string; points: string | number; reason: string; evidence_refs: string[] }>; reasons: Record<string, unknown>; flags: string[]; model: string } | null;
}
export interface ChallengeScorebook {
  round: ChallengeRound;
  rows: ChallengeScoreRow[];
  frozen: boolean;
  count?: number;
  next?: string | null;
  blockers?: string[];
  summary?: { registered?: number; submitted?: number; assessed?: number; exceptions?: number };
}

const BASE = '/challenges';
const pathPart = (value: ChallengeId) => encodeURIComponent(String(value));
const arrayOf = <T>(value: T[] | { results: T[] }): T[] => Array.isArray(value) ? value : value.results;

/** Guest challenge sessions are independent from academy login sessions. */
export async function challengeRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${api.baseUrl}${BASE}${path}`, {
    ...options,
    cache: 'no-store',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Challenge-Token': token } : {}), ...options.headers },
  });
  const data: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
  if (!response.ok) throw new Error(apiErrorMessage(data, response.status));
  return data as T;
}

export const challengeApi = {
  rounds: async () => arrayOf(await challengeRequest<ChallengeRound[] | { results: ChallengeRound[] }>('/rounds/')),
  round: (slug: string) => challengeRequest<ChallengeRound>(`/rounds/${pathPart(slug)}/`),
  results: (slug: string) => challengeRequest<{ results: ChallengeResult[] }>(`/rounds/${pathPart(slug)}/results/`),
  register: (body: { round_slug: string; category_id: ChallengeId; full_name: string; email: string; phone: string; accept_rules: boolean; make_public: boolean }) =>
    challengeRequest<{ detail: string }>('/register/', { method: 'POST', body: JSON.stringify(body) }),
  access: (round_slug: string, email: string) => challengeRequest<{ detail: string }>('/access/', { method: 'POST', body: JSON.stringify({ round_slug, email }) }),
  verify: (token: string) => challengeRequest<{ access_token: string; round_slug?: string }>('/verify/', { method: 'POST', body: JSON.stringify({ token }) }),
  portal: (token: string) => challengeRequest<ChallengePortal>('/portal/', {}, token),
  submit: (token: string, body: { post_url: string; explanation: string; evidence_ids: ChallengeId[]; checklist_confirmed: boolean }) =>
    challengeRequest<ChallengeSubmission>('/submissions/', { method: 'POST', body: JSON.stringify(body) }, token),
  engagement: (token: string, body: { likes: number | null; comments: number | null; shares: number | null; views: number | null; observed_at: string; evidence_ids: ChallengeId[] }) =>
    challengeRequest<EngagementSnapshot>('/engagement/', { method: 'POST', body: JSON.stringify(body) }, token),
  download: (token: string, id: ChallengeId) => challengeRequest<{ url: string }>(`/uploads/${pathPart(id)}/download/`, {}, token),
};

export async function uploadChallengeEvidence(token: string, file: File, kind: ChallengeEvidence['kind'], onProgress: (percent: number) => void): Promise<ChallengeEvidence> {
  const contentType = evidenceContentType(file);
  const initialized = await challengeRequest<ChallengeEvidence & { upload_url: string; content_type?: string; headers?: Record<string, string>; upload_headers?: Record<string, string> }>('/uploads/', {
    method: 'POST', body: JSON.stringify({ kind, name: file.name, content_type: contentType, size_bytes: file.size }),
  }, token);
  const target = new URL(initialized.upload_url);
  if (target.protocol !== 'https:' && !(target.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(target.hostname))) throw new Error('The upload destination is invalid. Please try again.');
  const upload = putFileWithProgress(initialized.upload_url, file, initialized.upload_headers ?? initialized.headers ?? { 'Content-Type': initialized.content_type || contentType }, (state) => onProgress(state.percent), () => onProgress(-1));
  await upload.promise;
  const completed = await challengeRequest<ChallengeEvidence>(`/uploads/${pathPart(initialized.id)}/complete/`, { method: 'POST', body: JSON.stringify({}) }, token);
  return { ...initialized, ...completed, name: completed.name || file.name, kind };
}

/** Admin requests use the existing staff authentication and refresh flow. */
export const challengeAdminApi = {
  rounds: async () => arrayOf(await api.request<ChallengeRound[] | { results: ChallengeRound[] }>(`${BASE}/admin/rounds/`)),
  save: (body: unknown, id?: ChallengeId) => api.request<ChallengeRound>(`${BASE}/admin/rounds/${id === undefined ? '' : `${pathPart(id)}/`}`, { method: id === undefined ? 'POST' : 'PATCH', body: JSON.stringify(body) }),
  saveCategory: (body: unknown, id?: ChallengeId) => api.request<ChallengeCategory>(`${BASE}/admin/categories/${id === undefined ? '' : `${pathPart(id)}/`}`, { method: id === undefined ? 'POST' : 'PATCH', body: JSON.stringify(body) }),
  scorebook: (id: ChallengeId) => api.request<ChallengeScorebook>(`${BASE}/admin/rounds/${pathPart(id)}/scorebook/`),
  action: (id: ChallengeId, action: string, body: unknown = {}) => api.request<ChallengeRound>(`${BASE}/admin/rounds/${pathPart(id)}/${action}/`, { method: 'POST', body: JSON.stringify(body) }),
  correction: (roundId: ChallengeId, registrationId: ChallengeId, body: unknown) => api.request(`${BASE}/admin/rounds/${pathPart(roundId)}/overrides/`, { method: 'POST', body: JSON.stringify({ registration_id: registrationId, ...body as object }) }),
  download: (id: ChallengeId) => api.request<{ url: string }>(`${BASE}/admin/assets/${pathPart(id)}/download/`),
};

function evidenceContentType(file: File): string {
  const extensions: Record<string, string> = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', csv: 'text/csv', txt: 'text/plain', zip: 'application/zip', mp4: 'video/mp4', webm: 'video/webm' };
  return extensions[file.name.split('.').pop()?.toLowerCase() || ''] || file.type || 'application/octet-stream';
}

export async function uploadChallengeBrief(categoryId: ChallengeId, file: File, onProgress: (value: number) => void): Promise<void> {
  const initialized = await api.request<{ id: string; upload_url: string; content_type: string }>(`${BASE}/admin/categories/${pathPart(categoryId)}/upload-brief/`, { method: 'POST', body: JSON.stringify({ name: file.name, content_type: 'application/pdf', size_bytes: file.size }) });
  await putFileWithProgress(initialized.upload_url, file, { 'Content-Type': initialized.content_type }, (state) => onProgress(state.percent), () => onProgress(-1)).promise;
  await api.request(`${BASE}/admin/categories/${pathPart(categoryId)}/complete-brief/`, { method: 'POST', body: JSON.stringify({ id: initialized.id }) });
}

export function challengeDate(value?: string | null): string {
  if (!value) return 'To be announced';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-NG', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date) + ' WAT' : 'To be announced';
}

export function challengeFailure(error: unknown): string {
  return error instanceof Error ? error.message : 'We could not complete that request. Please try again.';
}

export function engagementSource(source?: string): string {
  if (!source) return 'No observation recorded';
  if (source === 'public_observed' || source === 'public') return 'Publicly observed';
  if (source === 'api' || source === 'platform_api') return 'Connected platform';
  return 'Participant supplied';
}
