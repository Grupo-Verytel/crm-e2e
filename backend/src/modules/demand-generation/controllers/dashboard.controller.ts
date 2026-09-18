import { Controller, Get, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import {
  MarketingDashboardDetailsQueryDto,
  MarketingDashboardDetailsResponseDto,
  MarketingDashboardQueryDto,
  MarketingDashboardResponseDto,
} from '../dtos/dashboard-response.dto';
import { DemandGenerationService } from '../services/demand-generation.service';

@Controller('dashboard')
export class DashboardController {
  constructor(
    private readonly demandGenerationService: DemandGenerationService,
  ) {}

  @Get('marketing')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  marketing(
    @Query() query: MarketingDashboardQueryDto,
  ): Promise<MarketingDashboardResponseDto> {
    return this.demandGenerationService.getMarketingDashboard(query);
  }

  @Get('marketing/details')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  marketingDetails(
    @Query() query: MarketingDashboardDetailsQueryDto,
  ): Promise<MarketingDashboardDetailsResponseDto> {
    return this.demandGenerationService.getMarketingDashboardDetails(query);
  }
}
