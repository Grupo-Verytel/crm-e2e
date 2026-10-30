import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import type { AppAbility } from '../../auth/casl/casl-ability.factory';
import {
  MarketingDashboardDetailsQueryDto,
  MarketingDashboardDetailsResponseDto,
  MarketingDashboardQueryDto,
  MarketingDashboardResponseDto,
} from '../dtos/dashboard-response.dto';
import {
  ListMarketingDashboardGoalsQueryDto,
  ReplaceMarketingDashboardGoalsDto,
  ReplaceMarketingDashboardGoalsResponseDto,
} from '../dtos/marketing-dashboard-goals.dto';
import type { DeleteMarketingDashboardGoalResponseDto } from '../dtos/marketing-dashboard-goals.dto';
import { DemandGenerationService } from '../services/demand-generation.service';

type RequestWithAbility = Request & { ability?: AppAbility };

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

  @Get('marketing/goals')
  @CheckAbility({ action: 'read', subject: 'DemandGoal' })
  marketingGoals(@Query() query: ListMarketingDashboardGoalsQueryDto) {
    return this.demandGenerationService.listMarketingGoals(query);
  }

  @Put('marketing/goals')
  replaceMarketingGoals(
    @Body() dto: ReplaceMarketingDashboardGoalsDto,
    @Req() request: RequestWithAbility,
    @Res({ passthrough: true }) response: Response,
  ): Promise<ReplaceMarketingDashboardGoalsResponseDto> {
    return this.demandGenerationService
      .replaceMarketingGoals(dto, request.ability)
      .then((result) => {
        response.status(result.statusCode);
        return result.body;
      });
  }

  @Delete('marketing/goals/:id')
  @CheckAbility({ action: 'delete', subject: 'DemandGoal' })
  deleteMarketingGoal(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteMarketingDashboardGoalResponseDto> {
    return this.demandGenerationService.deleteMarketingGoal(id);
  }
}
