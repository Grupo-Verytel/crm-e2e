import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { DemandGenerationModule } from '../demand-generation/demand-generation.module';
import { Lead } from '../demand-generation/models/lead.model';
import { Mql } from '../demand-generation/models/mql.model';
import { Sql } from '../demand-generation/models/sql.model';
import { DiscoveryModule } from '../discovery/discovery.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { SqlsController } from './controllers/sqls.controller';
import { SqlCita } from './models/sql-cita.model';
import { SqlInteraction } from './models/sql-interaction.model';
import { SqlInteractionsService } from './services/sql-interactions.service';
import { SqlsService } from './services/sqls.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Sql, Mql, Lead, SqlCita, SqlInteraction]),
    AuthModule,
    DemandGenerationModule,
    DiscoveryModule,
    WorkflowEngineModule,
  ],
  controllers: [SqlsController],
  providers: [SqlsService, SqlInteractionsService],
  exports: [SqlsService, SqlInteractionsService],
})
export class QualificationModule {}
