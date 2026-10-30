import { api, type PaginatedResponse } from './api';

/** Public website content served by apps.website (profile, team, events, blog). */

export interface AcademyProfile {
  id: number | null;
  name: string;
  tagline: string;
  mission: string;
  story: string;
  location: string;
  founded_year: number | null;
  email: string;
  phone: string;
  linkedin_url: string;
  instagram_url: string;
  facebook_url: string;
  website_url: string;
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
  meeting_url?: string;
  is_published?: boolean;
}

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

export function registerForEvent(slug: string, values: { name: string; email: string; phone: string; note: string }) {
  return api.request<{ detail: string; seats_taken: number; is_full: boolean }>(
    `/website/events/${encodeURIComponent(slug)}/register/`,
    { method: 'POST', body: JSON.stringify(values) },
    false,
  );
}

export const getBlogPosts = () => walkPages<BlogPost>('/website/posts/', 100);

export const getBlogPost = (id: number) => publicGet<BlogPost>(`/website/posts/${id}/`);

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
