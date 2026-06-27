import { Module, forwardRef } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { AuditLogController } from './controllers/audit-log.controller';
import { AuditContextService } from './context/audit-context.service';
import { AuditContextInterceptor } from './interceptors/audit-context.interceptor';
import { AuditLog } from './models';
import { AuditHooksService } from './services/audit-hooks.service';
import { AuditService } from './services/audit.service';
import { AuditWriterService } from './services/audit-writer.service';

@Module({
  imports: [SequelizeModule.forFeature([AuditLog]), forwardRef(() => AuthModule)],
  controllers: [AuditLogController],
  providers: [
    AuditContextService,
    AuditWriterService,
    AuditHooksService,
    AuditService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditContextInterceptor,
    },
  ],
  exports: [AuditService],
})
export class AuditModule {}
