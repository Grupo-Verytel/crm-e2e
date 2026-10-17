import { apiRequest } from '../../../lib/api/http-client';
import type { OuvReminderItem } from '../types/ouv-reminder.types';

export function fetchOuvRecordatorios(
  ouvId: string,
): Promise<OuvReminderItem[]> {
  return apiRequest<OuvReminderItem[]>(
    `/discovery/ouvs/${ouvId}/recordatorios`,
  );
}
