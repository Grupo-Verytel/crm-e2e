import { Controller, Get, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { QualificationDashboardDetailsQueryDto } from '../dtos/qualification-dashboard-detail.dto';
import {
  QualificationDashboardQueryDto,
  QualificationDashboardResponseDto,
} from '../dtos/qualification-dashboard.dto';
import { QualificationDashboardService } from '../services/qualification-dashboard.service';

@Controller('qualification/dashboard')
export class QualificationDashboardController {
  constructor(
    private readonly dashboardService: QualificationDashboardService,
  ) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  getDashboard(
    @Query() query: QualificationDashboardQueryDto,
  ): Promise<QualificationDashboardResponseDto> {
    return this.dashboardService.getDashboard(query);
  }

  @Get('details')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  getDashboardDetails(@Query() query: QualificationDashboardDetailsQueryDto) {
    return this.dashboardService.getDashboardDetails(query);
  }
}
