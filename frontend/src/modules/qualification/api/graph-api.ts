import { apiRequest } from '../../../lib/api/http-client';

export type GraphStatus = {
  configured: boolean;
  missingEnv: string[];
  domains: string[];
  timeZone: string;
  organizerUpn: string | null;
  canCreateMeetings: boolean;
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

export async function fetchGraphStatus(): Promise<GraphStatus> {
  return apiRequest<GraphStatus>('/graph/status');
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
