import { apiRequest } from '../../lib/api/http-client';

/** PATCH /api/v1/reminders/:id/complete. Shared by the OUV tab and the bell. */
export function completeReminder(reminderId: string): Promise<unknown> {
  return apiRequest(
    `/reminders/${encodeURIComponent(reminderId)}/complete`,
    { method: 'PATCH' },
  );
}

/** PATCH /api/v1/reminders/:id/cancel. Shared by the OUV tab and the bell. */
export function cancelReminder(reminderId: string): Promise<unknown> {
  return apiRequest(
    `/reminders/${encodeURIComponent(reminderId)}/cancel`,
    { method: 'PATCH' },
  );
}
