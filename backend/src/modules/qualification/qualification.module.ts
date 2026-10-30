import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/models/user.model';
import { DemandGenerationModule } from '../demand-generation/demand-generation.module';
import { Lead } from '../demand-generation/models/lead.model';
import { Mql } from '../demand-generation/models/mql.model';
import { Sql } from '../demand-generation/models/sql.model';
import { DiscoveryModule } from '../discovery/discovery.module';
import { Ouv } from '../discovery/models/ouv.model';
import { GraphIntegrationModule } from '../graph-integration/graph-integration.module';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { AssignedOuvsController } from './controllers/assigned-ouvs.controller';
import { QualificationDashboardController } from './controllers/qualification-dashboard.controller';
import { SqlsController } from './controllers/sqls.controller';
import { DefaultMeetingAttendeesController } from './controllers/default-meeting-attendees.controller';
import { DefaultMeetingAttendee } from './models/default-meeting-attendee.model';
import { SqlCita } from './models/sql-cita.model';
import { SqlCitaAttendee } from './models/sql-cita-attendee.model';
import { SqlAppointmentEvent } from './models/sql-appointment-event.model';
import { AssignedOuvsService } from './services/assigned-ouvs.service';
import { DefaultMeetingAttendeesService } from './services/default-meeting-attendees.service';
import { QualificationDashboardService } from './services/qualification-dashboard.service';
import { SqlsService } from './services/sqls.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Sql,
      Mql,
      Lead,
      SqlCita,
      SqlCitaAttendee,
      SqlAppointmentEvent,
      DefaultMeetingAttendee,
      User,
      Ouv,
    ]),
    AuthModule,
    DemandGenerationModule,
    DiscoveryModule,
    GraphIntegrationModule,
    WorkflowEngineModule,
  ],
  controllers: [
    SqlsController,
    QualificationDashboardController,
    AssignedOuvsController,
    DefaultMeetingAttendeesController,
  ],
  providers: [
    SqlsService,
    QualificationDashboardService,
    AssignedOuvsService,
    DefaultMeetingAttendeesService,
  ],
  exports: [SqlsService, QualificationDashboardService],
})
export class QualificationModule {}
