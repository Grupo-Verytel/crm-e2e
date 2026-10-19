import { apiRequest } from '../../lib/api/http-client';
import { buildQueryString } from '../../lib/format';
import type {
  BellReminderItem,
  ReminderGroup,
  RemindersCounts,
} from './types';

export type MyRemindersQuery = {
  page?: number;
  limit?: number;
  group?: ReminderGroup[];
};

export type PaginatedMyReminders = {
  items: BellReminderItem[];
  total: number;
  page: number;
  limit: number;
  counts: RemindersCounts;
};

/** GET /api/v1/reminders. `counts` ignores `group` and the page. */
export function fetchMyReminders(
  params: MyRemindersQuery = {},
): Promise<PaginatedMyReminders> {
  const query = buildQueryString({
    page: params.page,
    limit: params.limit,
    group: params.group?.length ? params.group.join(',') : undefined,
  });
  return apiRequest<PaginatedMyReminders>(`/reminders${query}`);
}

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
