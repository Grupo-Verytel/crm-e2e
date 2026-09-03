import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { DiscoveryModule } from '../discovery/discovery.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { ExecutionStatusController } from './controllers/execution-status.controller';
import { ProjectExecutionController } from './controllers/project-execution.controller';
import { PmoApiKeyGuard } from './guards/pmo-api-key.guard';
import { ProjectStatusEvent } from './models/project-status-event.model';
import { PmoApiClient } from './services/pmo-api.client';
import { ProjectExecutionService } from './services/project-execution.service';

@Module({
  imports: [
    SequelizeModule.forFeature([ProjectStatusEvent]),
    DiscoveryModule,
    WorkflowEngineModule,
  ],
  controllers: [ProjectExecutionController, ExecutionStatusController],
  providers: [ProjectExecutionService, PmoApiClient, PmoApiKeyGuard],
  exports: [ProjectExecutionService],
})
export class ImplementationModule {}
