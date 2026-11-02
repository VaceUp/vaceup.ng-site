import { api, type PaginatedResponse } from './api';

/** Public website content served by apps.website (profile, team, events, blog). */

export interface AcademyProfile {
  id: number | null;
  name: string;
  tagline: string;
  mission: string;
  story: string;
  hero_title: string;
  location: string;
  founded_year: number | null;
  next_cohort_start?: string | null;
  email: string;
  phone: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  website_url: string;
}

/** One saved edit of the About page, holding the wording it replaced. */
export interface AboutRevision {
  id: number;
  target: 'profile' | 'team';
  object_id: number | null;
  label: string;
  changed_fields: string[];
  changed_by_name: string;
  created_at: string;
  created_at_label: string;
}

export interface AboutRestoreResult {
  detail: string;
  restored: AboutRevision;
  profile: AcademyProfile | null;
  member: Record<string, unknown> | null;
}

export interface TeamMember {
  id: number;
  name: string;
  role_title: string;
  bio: string;
  quote: string;
  image: string;
  linkedin_url: string;
  instagram_url: string;
  website_url: string;
  is_founder: boolean;
  order: number;
  is_published: boolean;
}

export interface WebsiteEvent {
  id: number;
  title: string;
  slug: string;
  summary: string;
  description: string;
  event_type: string;
  event_type_label: string;
  starts_at: string;
  ends_at: string | null;
  location: string;
  is_online: boolean;
  registration_url: string;
  capacity: number | null;
  seats_taken: number;
  is_full: boolean;
  is_past: boolean;
  image: string;
  is_featured: boolean;
  rsvp_enabled: boolean;
  live_platform?: 'external' | 'livekit';
  join_opens_at?: string | null;
  join_closes_at?: string | null;
  is_joinable?: boolean;
  join_ready?: boolean;
  meeting_url?: string;
  is_published?: boolean;
}

/** What the server hands the attendee who holds a valid seat link. */
export type EventAccess =
  | { provider: 'external'; url: string; display_name: string }
  | {
      provider: 'livekit';
      room: string;
      token: string;
      ws_url: string;
      identity: string;
      display_name: string;
      can_publish: boolean;
      is_host: boolean;
    };

export interface BlogPost {
  id: number;
  blogger_id: string;
  title: string;
  url: string;
  summary: string;
  author_name: string;
  labels: string[];
  thumbnail_url: string;
  published_at: string;
  is_visible: boolean;
  content_html?: string;
}

const publicGet = <T>(path: string) => api.request<T>(path, { cache: 'no-store' }, false);

/** Page through the academy's fixed 20-record pages without leaking credentials. */
async function walkPages<T>(firstPath: string, limit = 200): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await publicGet<PaginatedResponse<T> | T[]>(
      `${firstPath}${firstPath.includes('?') ? '&' : '?'}page=${page}`,
    );
    const batch = Array.isArray(response) ? response : response.results;
    rows.push(...batch);
    if (rows.length >= limit || (Array.isArray(response) ? true : !response.next)) return rows;
  }
  return rows;
}

export const getAcademyProfile = () => publicGet<AcademyProfile>('/website/profile/');
export const getPublishedTeam = () => walkPages<TeamMember>('/website/team/');

export async function getPublishedEvents(scope: 'upcoming' | 'past' | '') {
  const query = new URLSearchParams();
  if (scope) query.set('scope', scope);
  return publicGet<PaginatedResponse<WebsiteEvent>>(`/website/events/?${query}`);
}

export const getEvent = (slug: string) => publicGet<WebsiteEvent>(`/website/events/${encodeURIComponent(slug)}/`);

export function registerForEvent(
  slug: string,
  values: { name: string; email: string; phone: string; note: string; consent_marketing: boolean },
) {
  return api.request<{ detail: string; seats_taken: number; is_full: boolean; join_link?: string }>(
    `/website/events/${encodeURIComponent(slug)}/register/`,
    { method: 'POST', body: JSON.stringify(values) },
    false,
  );
}

/**
 * Open the room behind one seat. The token is the string from the attendee's
 * confirmation email, so a signed-in admin may also use this to rehearse.
 */
export const joinEvent = (slug: string, token: string) =>
  api.request<EventAccess>(`/website/events/${encodeURIComponent(slug)}/join/`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });

/** Re-issue a lost seat link. Never says whether the email is on the list. */
export const resendJoinLink = (slug: string, email: string) =>
  api.request<{ detail: string }>(
    `/website/events/${encodeURIComponent(slug)}/resend-link/`,
    { method: 'POST', body: JSON.stringify({ email }) },
    false,
  );

export const getBlogPosts = () => walkPages<BlogPost>('/website/posts/', 100);

export const getBlogPost = (id: number) => publicGet<BlogPost>(`/website/posts/${id}/`);

// --- About page edit history (admins only, so these carry credentials) ---

export const getAboutRevisions = () => api.request<AboutRevision[]>('/website/revisions/');

export const undoAboutChange = (target: { target?: 'profile' | 'team'; object_id?: number } = {}) =>
  api.request<AboutRestoreResult>('/website/revisions/undo/', { method: 'POST', body: JSON.stringify(target) });

export const restoreAboutRevision = (id: number) =>
  api.request<AboutRestoreResult>(`/website/revisions/${id}/restore/`, { method: 'POST', body: '{}' });

export const formatEventWindow = (event: Pick<WebsiteEvent, 'starts_at' | 'ends_at'>) => {
  const start = new Date(event.starts_at);
  if (!Number.isFinite(start.getTime())) return 'Date to be confirmed';
  const day = start.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const from = start.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
  const end = event.ends_at ? new Date(event.ends_at) : null;
  if (!end || !Number.isFinite(end.getTime())) return `${day} from ${from}`;
  const sameDay = end.toDateString() === start.toDateString();
  return sameDay
    ? `${day}, ${from} - ${end.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })}`
    : `${day}, ${from} - ${end.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}`;
};
