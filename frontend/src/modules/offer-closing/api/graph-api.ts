// Cliente del proxy de Microsoft Graph del backend (`api/v1/graph/*`).
// El agendamiento del Kickoff lo usa para buscar personas de los dominios de
// la organización, leer disponibilidad real de calendarios y salas, y crear la
// reunión de Teams.
import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';

export type GraphRoom = {
  id: string;
  nombre: string;
  email: string;
};

export type GraphStatus = {
  configured: boolean;
  missingEnv: string[];
  domains: string[];
  timeZone: string;
  organizerUpn: string | null;
  roles: string[];
  canCreateMeetings: boolean;
  rooms: GraphRoom[];
};

export type GraphUser = {
  id: string;
  displayName: string;
  email: string;
  jobTitle: string | null;
  domain: string;
};

export type GraphScheduleItem = {
  status: string;
  subject: string | null;
  start: string;
  end: string;
};

export type GraphSchedule = {
  email: string;
  availabilityView: string | null;
  items: GraphScheduleItem[];
  error: string | null;
};

export type GraphAvailability = {
  startTime: string;
  endTime: string;
  timeZone: string;
  intervalMinutes: number;
  schedules: GraphSchedule[];
};

export type GraphMeeting = {
  eventId: string;
  subject: string;
  start: string;
  end: string;
  timeZone: string;
  organizer: { name: string | null; email: string | null };
  attendees: { name: string | null; email: string | null; type: string }[];
  joinUrl: string | null;
  webLink: string | null;
  location: string | null;
};

export type CreateGraphMeetingPayload = {
  organizerUpn?: string;
  subject: string;
  /** Hora local del tenant: `YYYY-MM-DDTHH:mm`. */
  startTime: string;
  endTime: string;
  timeZone?: string;
  attendees: {
    email: string;
    name?: string;
    type?: 'required' | 'optional' | 'resource';
  }[];
  room?: string;
  location?: string;
  body?: string;
  isOnlineMeeting?: boolean;
};

export async function fetchGraphStatus(): Promise<GraphStatus> {
  return apiRequest<GraphStatus>('/graph/status');
}

export async function searchGraphUsers(
  params: { search?: string; domain?: string; limit?: number } = {},
): Promise<GraphUser[]> {
  const response = await apiRequest<{ users: GraphUser[] }>(
    `/graph/users${buildQueryString(params)}`,
  );
  return response.users;
}

export async function fetchGraphAvailability(payload: {
  schedules: string[];
  startTime: string;
  endTime: string;
  timeZone?: string;
  organizerUpn?: string;
}): Promise<GraphAvailability> {
  return apiRequest<GraphAvailability>('/graph/availability', {
    method: 'POST',
    body: payload,
  });
}

export async function createGraphMeeting(
  payload: CreateGraphMeetingPayload,
): Promise<GraphMeeting> {
  return apiRequest<GraphMeeting>('/graph/meetings', {
    method: 'POST',
    body: payload,
  });
}

/**
 * Reprograma la reunión ya creada. Se usa en lugar de cancelar y volver a
 * crear para que los invitados reciban una actualización de la convocatoria
 * (y no un aviso de cancelación) y el enlace de Teams no cambie.
 */
export async function updateGraphMeeting(
  eventId: string,
  payload: CreateGraphMeetingPayload,
): Promise<GraphMeeting> {
  return apiRequest<GraphMeeting>(
    `/graph/meetings/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: payload },
  );
}

export async function cancelGraphMeeting(
  eventId: string,
  organizerUpn?: string,
): Promise<void> {
  await apiRequest<void>(
    `/graph/meetings/${encodeURIComponent(eventId)}${buildQueryString({
      organizerUpn,
    })}`,
    { method: 'DELETE' },
  );
}

export type GraphAttendee = {
  name: string | null;
  email: string | null;
  totalAttendanceInSeconds: number;
  role: string | null;
  intervals: number;
};

export type GraphAttendance = {
  meetingId: string;
  /** `null` mientras Teams no publique el informe (la reunión no ha cerrado). */
  reportId: string | null;
  meetingStartDateTime: string | null;
  meetingEndDateTime: string | null;
  totalParticipantCount: number | null;
  attendees: GraphAttendee[];
};

/** Asistencia real a la reunión de Teams del Kickoff. */
export async function fetchMeetingAttendance(params: {
  organizerUpn: string;
  meetingId?: string;
  joinUrl?: string;
}): Promise<GraphAttendance> {
  return apiRequest<GraphAttendance>(
    `/graph/meetings/attendance${buildQueryString(params)}`,
  );
}
