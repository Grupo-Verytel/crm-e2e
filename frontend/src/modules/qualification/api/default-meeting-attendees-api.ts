import { apiRequest } from '../../../lib/api/http-client';
import { ApiError } from '../../auth/types';

export type DefaultMeetingAttendee = {
  default_meeting_attendee_id: string;
  email: string;
  name: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type DefaultMeetingAttendeeList = {
  items: DefaultMeetingAttendee[];
};

const BASE = '/qualification/default-meeting-attendees';

export async function listDefaultMeetingAttendees(): Promise<DefaultMeetingAttendeeList> {
  return apiRequest(BASE);
}

export async function createDefaultMeetingAttendee(payload: {
  email: string;
  name?: string | null;
}): Promise<DefaultMeetingAttendee> {
  return apiRequest(BASE, { method: 'POST', body: payload });
}

export async function updateDefaultMeetingAttendee(
  id: string,
  payload: { name?: string | null; is_active?: boolean },
): Promise<DefaultMeetingAttendee> {
  return apiRequest(`${BASE}/${id}`, { method: 'PATCH', body: payload });
}

export async function removeDefaultMeetingAttendee(
  id: string,
): Promise<{ deleted: true }> {
  return apiRequest(`${BASE}/${id}`, { method: 'DELETE' });
}

/** Service errors expose one string. class-validator exposes one entry per message. */
export function readApiErrorMessages(error: unknown, fallback: string): string[] {
  if (error instanceof ApiError) {
    const listed = error.messages?.filter((item) => item.trim().length > 0);
    if (listed && listed.length > 0) {
      return listed;
    }
    if (error.message.trim().length > 0) {
      return [error.message];
    }
  }
  if (error instanceof Error && error.message.trim().length > 0) {
    return [error.message];
  }
  return [fallback];
}
