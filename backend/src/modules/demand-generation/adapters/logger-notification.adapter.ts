import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationMessage,
  NotificationPort,
} from '../ports/notification.port';

/**
 * Default NotificationPort implementation. Logs the notification until a real
 * channel (email / in-app) is introduced. Swapping the provider in the module
 * is enough to change delivery without touching business services.
 */
@Injectable()
export class LoggerNotificationAdapter implements NotificationPort {
  private readonly logger = new Logger('Notifications');

  async notify(message: NotificationMessage): Promise<void> {
    const target = message.recipientUserId
      ? `user:${message.recipientUserId}`
      : `role:${message.recipientRole ?? 'unknown'}`;

    this.logger.log(`[${message.event}] → ${target} — ${message.message}`);
    return Promise.resolve();
  }
}
