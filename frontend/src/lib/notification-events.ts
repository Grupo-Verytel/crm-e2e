/** Dispatched when a push notification arrives (bandeja auto-refresh). */
export const IN_APP_NOTIFICATION_EVENT = 'crm:in-app-notification';

export type InAppNotificationEventDetail = {
  event_type: string;
  entity_type: string;
  entity_id: string;
  titulo: string;
};

export function emitInAppNotification(
  detail: InAppNotificationEventDetail,
): void {
  window.dispatchEvent(
    new CustomEvent(IN_APP_NOTIFICATION_EVENT, { detail }),
  );
}
