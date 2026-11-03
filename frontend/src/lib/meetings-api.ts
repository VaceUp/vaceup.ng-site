import { api } from './api';

/**
 * Staff meetings: a call between an administrator and the tutors, held inside
 * the platform. Nothing here carries a room address — the meeting id plus the
 * signed-in account is the whole ticket, so a forwarded link opens nothing.
 */

export interface MeetingPerson {
  id: number;
  full_name: string;
  role: string;
}

export interface MeetingParticipantRow {
  person: MeetingPerson;
  invited_at: string | null;
  joined_at: string | null;
  opened_room: boolean;
}

export interface Meeting {
  id: number;
  title: string;
  agenda: string;
  status: 'scheduled' | 'ended' | 'cancelled';
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  host: MeetingPerson;
  participants: MeetingParticipantRow[];
  my_role: 'host' | 'invited' | 'none';
  can_enter: boolean;
  entry_reason: string;
  is_open: boolean;
  created_at: string;
}

export interface MeetingWriteResult extends Meeting {
  invited?: string[];
  invitation_email_failed?: string[];
  cancellation_email_failed?: string[];
}

export interface MeetingRoomAccess {
  provider: 'livekit';
  room: string;
  token: string;
  ws_url: string;
  identity: string;
  display_name: string;
  can_publish: boolean;
  is_host: boolean;
}

export interface MeetingBooking {
  title: string;
  agenda: string;
  starts_at: string;
  duration_minutes: number;
  invitees: number[];
}

/**
 * The writes are listed here; the reads go through `useWorkspaceResource`,
 * which owns the retry and refresh behaviour every other workspace screen has.
 */
export const bookMeeting = (booking: MeetingBooking) =>
  api.request<MeetingWriteResult>('/meetings/', { method: 'POST', body: JSON.stringify(booking) });

export const changeMeeting = (id: number, changes: Partial<MeetingBooking>) =>
  api.request<MeetingWriteResult>(`/meetings/${id}/`, { method: 'PATCH', body: JSON.stringify(changes) });

export const openMeetingRoom = (id: number) =>
  api.request<MeetingRoomAccess>(`/meetings/${id}/token/`, { method: 'POST', body: '{}' });

export const endMeeting = (id: number) =>
  api.request<MeetingWriteResult>(`/meetings/${id}/end/`, { method: 'POST', body: '{}' });

export const cancelMeeting = (id: number) =>
  api.request<MeetingWriteResult>(`/meetings/${id}/cancel/`, { method: 'POST', body: '{}' });
