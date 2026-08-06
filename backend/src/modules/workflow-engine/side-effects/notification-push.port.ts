/**
 * Payload pushed to a user room after transaction commit (EARS-07).
 * Implemented by NotificationsGateway in ETAPA 2.4.
 */
export type NotificationPushPayload = {
  notification_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  entity_label: string;
  titulo: string;
  mensaje: string;
  estado_anterior: string | null;
  estado_nuevo: string;
  metadata: Record<string, unknown> | null;
  created_at: Date;
};

export interface NotificationPushPort {
  emitToUser(userId: string, notification: NotificationPushPayload): void;
}

export const NOTIFICATION_PUSH_PORT = Symbol('NOTIFICATION_PUSH_PORT');
