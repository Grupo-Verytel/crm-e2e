import { Controller, Get, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QualificationDashboardResponseDto> {
    return this.dashboardService.getDashboard(query, user);
  }

  @Get('details')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  getDashboardDetails(
    @Query() query: QualificationDashboardDetailsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getDashboardDetails(query, user);
  }
}
