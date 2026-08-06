import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/sequelize';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { User } from '../../auth/models/user.model';
import type {
  NotificationPushPayload,
  NotificationPushPort,
} from '../side-effects/notification-push.port';

interface JwtPayload {
  sub: string;
  role: string;
}

/**
 * Socket.IO gateway: JWT on handshake, room per user `user:{userId}` (EARS-07/09).
 */
@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, NotificationPushPort
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);
      const user = await this.userModel.findByPk(payload.sub);
      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      const userId = user.userId;
      client.data.userId = userId;
      await client.join(`user:${userId}`);
      this.logger.debug(`WS connected user:${userId} socket:${client.id}`);
    } catch (error) {
      this.logger.warn(
        `WS handshake rejected: ${error instanceof Error ? error.message : 'unknown'}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = client.data?.userId as string | undefined;
    if (userId) {
      this.logger.debug(`WS disconnected user:${userId} socket:${client.id}`);
    }
  }

  emitToUser(userId: string, notification: NotificationPushPayload): void {
    this.server
      .to(`user:${userId}`)
      .emit('notification', notification);
    this.logger.log(
      `emitToUser notification_id=${notification.notification_id} user=${userId} at=${new Date().toISOString()}`,
    );
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.length > 0) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;
    if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
      return authorization.slice('Bearer '.length);
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.length > 0) {
      return queryToken;
    }

    return null;
  }
}
