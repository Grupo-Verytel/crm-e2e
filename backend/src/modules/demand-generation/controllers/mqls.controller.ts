import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ApproveMqlDto } from '../dtos/approve-mql.dto';
import {
  ApproveMqlResponseDto,
  MqlResponseDto,
  MqlsQueryDto,
  PaginatedMqlsResponseDto,
} from '../dtos/mql-response.dto';
import { RejectMqlDto } from '../dtos/reject-mql.dto';
import { DemandGenerationService } from '../services/demand-generation.service';

@Controller('mqls')
export class MqlsController {
  constructor(
    private readonly demandGenerationService: DemandGenerationService,
  ) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'Lead' })
  findAll(@Query() query: MqlsQueryDto): Promise<PaginatedMqlsResponseDto> {
    return this.demandGenerationService.listMqls(query);
  }

  @Post(':id/approve')
  @CheckAbility({ action: 'approve', subject: 'Lead' })
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveMqlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ApproveMqlResponseDto> {
    return this.demandGenerationService.approveMql(id, dto, user.userId);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @CheckAbility({ action: 'approve', subject: 'Lead' })
  reject(
    @Param('id') id: string,
    @Body() dto: RejectMqlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MqlResponseDto> {
    return this.demandGenerationService.rejectMql(id, dto, user.userId);
  }
}
