import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AuthModule } from '../auth/auth.module';
import { User } from '../auth/models/user.model';
import { LoggerNotificationAdapter } from './adapters/logger-notification.adapter';
import { DashboardController } from './controllers/dashboard.controller';
import { CampaignsController } from './controllers/campaigns.controller';
import { LeadsController } from './controllers/leads.controller';
import { MqlsController } from './controllers/mqls.controller';
import { Campaign } from './models/campaign.model';
import { Interaction } from './models/interaction.model';
import { Lead } from './models/lead.model';
import { LeadChecklist } from './models/lead-checklist.model';
import { Mql } from './models/mql.model';
import { Sql } from './models/sql.model';
import { NOTIFICATION_PORT } from './ports/notification.port';
import { CampaignsService } from './services/campaigns.service';
import { DashboardService } from './services/dashboard.service';
import { DemandGenerationService } from './services/demand-generation.service';
import { InteractionsService } from './services/interactions.service';
import { LeadChecklistService } from './services/lead-checklist.service';
import { LeadImportJobService } from './services/lead-import-job.service';
import { LeadStateMachineService } from './services/lead-state-machine.service';
import { LeadsService } from './services/leads.service';
import { MqlsService } from './services/mqls.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Lead,
      Campaign,
      Interaction,
      LeadChecklist,
      Mql,
      Sql,
      User,
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [
    LeadsController,
    CampaignsController,
    MqlsController,
    DashboardController,
  ],
  providers: [
    LeadsService,
    CampaignsService,
    InteractionsService,
    LeadChecklistService,
    LeadStateMachineService,
    MqlsService,
    DashboardService,
    LeadImportJobService,
    DemandGenerationService,
    { provide: NOTIFICATION_PORT, useClass: LoggerNotificationAdapter },
  ],
  exports: [DemandGenerationService],
})
export class DemandGenerationModule {}
