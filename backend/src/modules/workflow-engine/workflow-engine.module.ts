import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/models/user.model';
import { NotificationsController } from './controllers/notifications.controller';
import { WorkflowExceptionFilter } from './filters/workflow-exception.filter';
import { NotificationsGateway } from './gateway/notifications.gateway';
import { Notification } from './models/notification.model';
import { StatusHistory } from './models/status-history.model';
import { NotificationsQueryService } from './services/notifications-query.service';
import { StatusHistoryService } from './services/status-history.service';
import { NOTIFICATION_PUSH_PORT } from './side-effects/notification-push.port';
import { NotificationsPersister } from './side-effects/notifications-persister';
import { WorkflowEngineService } from './workflow-engine.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Notification, StatusHistory, User]),
    AuthModule,
    AuditModule,
  ],
  controllers: [NotificationsController],
  providers: [
    WorkflowEngineService,
    StatusHistoryService,
    NotificationsPersister,
    NotificationsQueryService,
    NotificationsGateway,
    {
      provide: NOTIFICATION_PUSH_PORT,
      useExisting: NotificationsGateway,
    },
    {
      provide: APP_FILTER,
      useClass: WorkflowExceptionFilter,
    },
  ],
  exports: [WorkflowEngineService, StatusHistoryService, SequelizeModule],
})
export class WorkflowEngineModule {}
