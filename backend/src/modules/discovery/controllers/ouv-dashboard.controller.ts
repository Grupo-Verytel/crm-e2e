import { Controller, Get, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OuvDashboardQueryDto } from '../dtos/ouv-dashboard.dto';
import { OuvDashboardService } from '../services/ouv-dashboard.service';

@Controller('discovery/ouv-dashboard')
export class OuvDashboardController {
  constructor(private readonly dashboardService: OuvDashboardService) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  getDashboard(
    @Query() query: OuvDashboardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.dashboardService.getDashboard(query, user);
  }
}
