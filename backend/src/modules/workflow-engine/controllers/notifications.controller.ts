import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  NotificationResponseDto,
  NotificationsQueryDto,
  PaginatedNotificationsResponseDto,
} from '../dtos/notification.dto';
import { NotificationsQueryService } from '../services/notifications-query.service';

/**
 * HTTP fallback + initial load for in-app notifications (EARS-11 / EARS-12).
 * Always scoped to the authenticated recipient (spec §6).
 */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsQueryService: NotificationsQueryService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: NotificationsQueryDto,
  ): Promise<PaginatedNotificationsResponseDto> {
    return this.notificationsQueryService.listForUser(user.userId, query);
  }

  @Patch(':id/read')
  markRead(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NotificationResponseDto> {
    return this.notificationsQueryService.markRead(id, user.userId);
  }
}
