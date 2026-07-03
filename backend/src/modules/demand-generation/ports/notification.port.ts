/** Business events that trigger a notification in this module. */
export enum NotificationEvent {
  MqlPendingReview = 'MQL_PENDING_REVIEW',
  SqlHandoff = 'SQL_HANDOFF',
  MqlRejected = 'MQL_REJECTED',
}

export interface NotificationMessage {
  event: NotificationEvent;
  /** Target a specific user (e.g. the responsible Gestor de Mercadeo). */
  recipientUserId?: string | null;
  /** Target a role when there is no single recipient (e.g. Director de Mercadeo). */
  recipientRole?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Minimal notification abstraction. The project has no shared notification
 * infrastructure yet, so demand-generation depends on this port instead of
 * coupling to a concrete channel (email, in-app, etc.).
 */
export interface NotificationPort {
  notify(message: NotificationMessage): Promise<void>;
}

export const NOTIFICATION_PORT = Symbol('NOTIFICATION_PORT');
