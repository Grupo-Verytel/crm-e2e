import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateCampaignDto } from '../dtos/create-campaign.dto';
import {
  CampaignResponseDto,
  CampaignsQueryDto,
  PaginatedCampaignsResponseDto,
} from '../dtos/campaign-response.dto';
import { UpdateCampaignStatusDto } from '../dtos/update-campaign-status.dto';
import { DemandGenerationService } from '../services/demand-generation.service';

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly demandGenerationService: DemandGenerationService,
  ) {}

  @Post()
  @CheckAbility({ action: 'create', subject: 'Campaign' })
  create(
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CampaignResponseDto> {
    return this.demandGenerationService.createCampaign(dto, user.roleName);
  }

  @Get()
  @CheckAbility({ action: 'read', subject: 'Campaign' })
  findAll(
    @Query() query: CampaignsQueryDto,
  ): Promise<PaginatedCampaignsResponseDto> {
    return this.demandGenerationService.listCampaigns(query);
  }

  @Put(':id/status')
  @CheckAbility({ action: 'update', subject: 'Campaign' })
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CampaignResponseDto> {
    return this.demandGenerationService.updateCampaignStatus(
      id,
      dto,
      user.roleName,
    );
  }
}
