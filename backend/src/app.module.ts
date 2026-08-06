import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DemandGenerationModule } from './modules/demand-generation/demand-generation.module';
import { QualificationModule } from './modules/qualification/qualification.module';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditModule,
    DemandGenerationModule,
    QualificationModule,
    WorkflowEngineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
