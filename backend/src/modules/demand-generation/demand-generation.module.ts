import { Module, forwardRef } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthModule } from '../auth/auth.module';
import { DiscoveryModule } from '../discovery/discovery.module';
import { GraphIntegrationModule } from '../graph-integration/graph-integration.module';
import { User } from '../auth/models/user.model';
import { WorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { LoggerNotificationAdapter } from './adapters/logger-notification.adapter';
import { DashboardController } from './controllers/dashboard.controller';
import { CampaignsController } from './controllers/campaigns.controller';
import { LeadsController } from './controllers/leads.controller';
import { RemindersController } from './controllers/reminders.controller';
import { MqlsController } from './controllers/mqls.controller';
import { SegmentsController } from './controllers/segments.controller';
import { Campaign } from './models/campaign.model';
import { Interaction } from './models/interaction.model';
import { Reminder } from './models/reminder.model';
import { Lead } from './models/lead.model';
import { LeadContact } from './models/lead-contact.model';
import { LeadChecklist } from './models/lead-checklist.model';
import { Mql } from './models/mql.model';
import { Segment } from './models/segment.model';
import { MarketingDashboardTarget } from './models/marketing-dashboard-target.model';
import { Sql } from './models/sql.model';
import { Subsegment } from './models/subsegment.model';
import { NOTIFICATION_PORT } from './ports/notification.port';
import { CampaignsService } from './services/campaigns.service';
import { DashboardService } from './services/dashboard.service';
import { DemandGenerationService } from './services/demand-generation.service';
import { InteractionsService } from './services/interactions.service';
import { LeadChecklistService } from './services/lead-checklist.service';
import { LeadImportJobService } from './services/lead-import-job.service';
import { LeadStateMachineService } from './services/lead-state-machine.service';
import { LeadsService } from './services/leads.service';
import { MarketingDashboardTargetsService } from './services/marketing-dashboard-targets.service';
import { MqlsService } from './services/mqls.service';
import { OutlookReminderSyncService } from './services/outlook-reminder-sync.service';
import { RemindersService } from './services/reminders.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Lead,
      LeadContact,
      Campaign,
      Interaction,
      Reminder,
      LeadChecklist,
      Mql,
      Sql,
      Segment,
      Subsegment,
      User,
      MarketingDashboardTarget,
    ]),
    AccountsModule,
    forwardRef(() => AuthModule),
    forwardRef(() => DiscoveryModule),
    GraphIntegrationModule,
    WorkflowEngineModule,
  ],
  controllers: [
    LeadsController,
    RemindersController,
    CampaignsController,
    MqlsController,
    DashboardController,
    SegmentsController,
  ],
  providers: [
    LeadsService,
    CampaignsService,
    InteractionsService,
    RemindersService,
    OutlookReminderSyncService,
    LeadChecklistService,
    LeadStateMachineService,
    MqlsService,
    DashboardService,
    MarketingDashboardTargetsService,
    LeadImportJobService,
    DemandGenerationService,
    { provide: NOTIFICATION_PORT, useClass: LoggerNotificationAdapter },
  ],
  exports: [DemandGenerationService, SequelizeModule],
})
export class DemandGenerationModule {}
