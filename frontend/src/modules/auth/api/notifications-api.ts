import { apiRequest } from '../../../lib/api/http-client';
import { buildQueryString } from '../../../lib/format';

export type InAppNotification = {
  notification_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  titulo: string;
  mensaje: string;
  actor_user_id: string | null;
  metadata: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export type PaginatedNotifications = {
  items: InAppNotification[];
  total: number;
  page: number;
  limit: number;
};

export async function fetchNotifications(opts?: {
  read?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedNotifications> {
  return apiRequest<PaginatedNotifications>(
    `/notifications${buildQueryString({
      read: opts?.read,
      page: opts?.page ?? 1,
      limit: opts?.limit ?? 20,
    })}`,
  );
}

export async function markNotificationRead(
  notificationId: string,
): Promise<InAppNotification> {
  return apiRequest<InAppNotification>(
    `/notifications/${notificationId}/read`,
    { method: 'PATCH' },
  );
}
