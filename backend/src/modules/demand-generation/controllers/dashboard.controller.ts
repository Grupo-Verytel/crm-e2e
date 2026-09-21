import { Body, Controller, Get, Put, Query, UseGuards } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import {
  MarketingDashboardDetailsQueryDto,
  MarketingDashboardDetailsResponseDto,
  MarketingDashboardQueryDto,
  MarketingDashboardResponseDto,
} from '../dtos/dashboard-response.dto';
import {
  MarketingDashboardTargetsResponseDto,
  UpdateMarketingDashboardTargetsDto,
} from '../dtos/marketing-dashboard-targets.dto';
import { DirectorMercadeoGuard } from '../guards/director-mercadeo.guard';
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

  @Get('marketing/targets')
  @CheckAbility({ action: 'read', subject: 'Lead' })
  marketingTargets(): Promise<MarketingDashboardTargetsResponseDto> {
    return this.demandGenerationService.getMarketingDashboardTargets();
  }

  @Put('marketing/targets')
  @UseGuards(DirectorMercadeoGuard)
  @CheckAbility({ action: 'update', subject: 'Lead' })
  updateMarketingTargets(
    @Body() dto: UpdateMarketingDashboardTargetsDto,
  ): Promise<MarketingDashboardTargetsResponseDto> {
    return this.demandGenerationService.updateMarketingDashboardTargets(dto);
  }
}
