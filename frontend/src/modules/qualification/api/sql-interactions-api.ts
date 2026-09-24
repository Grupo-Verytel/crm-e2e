import { apiRequest } from '../../../lib/api/http-client';
import type {
  CreateInteractionPayload,
  Interaction,
} from '../../demand-generation/types';

export function fetchSqlInteractions(sqlId: string): Promise<Interaction[]> {
  return apiRequest<Interaction[]>(`/qualification/sqls/${sqlId}/interactions`);
}

export function registerSqlInteraction(
  sqlId: string,
  payload: CreateInteractionPayload,
): Promise<Interaction> {
  return apiRequest<Interaction>(`/qualification/sqls/${sqlId}/interactions`, {
    method: 'POST',
    body: payload,
  });
}

export function createSqlInteractionReminder(
  sqlId: string,
  interactionId: string,
  payload: {
    event_at: string;
    remind_days_before: number;
    note?: string;
  },
): Promise<unknown> {
  return apiRequest(
    `/qualification/sqls/${sqlId}/interactions/${interactionId}/reminders`,
    { method: 'POST', body: payload },
  );
}
