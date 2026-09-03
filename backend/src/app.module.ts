import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuditModule } from './modules/audit/audit.module';
import { DemandGenerationModule } from './modules/demand-generation/demand-generation.module';
import { DiscoveryModule } from './modules/discovery/discovery.module';
import { ImplementationModule } from './modules/implementation/implementation.module';
import { QualificationModule } from './modules/qualification/qualification.module';
import { WorkflowEngineModule } from './modules/workflow-engine/workflow-engine.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    AuditModule,
    AccountsModule,
    DemandGenerationModule,
    DiscoveryModule,
    QualificationModule,
    ImplementationModule,
    WorkflowEngineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
