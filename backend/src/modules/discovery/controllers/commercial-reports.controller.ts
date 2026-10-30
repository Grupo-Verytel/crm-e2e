import { Controller, Get, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import {
  CommercialReportDetailsQueryDto,
  CommercialReportQueryDto,
  PipelineHealthQueryDto,
} from '../dtos/commercial-report.dto';
import { CommercialReportsService } from '../services/commercial-reports.service';

@Controller('discovery/reports')
export class CommercialReportsController {
  constructor(private readonly reportsService: CommercialReportsService) {}

  @Get('committee')
  @CheckAbility({ action: 'read', subject: 'CommercialReport' })
  getCommittee(
    @Query() query: CommercialReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getCommittee(query, user);
  }

  @Get('pipeline-health')
  @CheckAbility({ action: 'read', subject: 'CommercialReport' })
  getPipelineHealth(
    @Query() query: PipelineHealthQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getPipelineHealth(query, user);
  }

  @Get('details')
  @CheckAbility({ action: 'read', subject: 'CommercialReport' })
  getDetails(
    @Query() query: CommercialReportDetailsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.getDetails(query, user);
  }
}
