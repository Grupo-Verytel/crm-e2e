import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import {
  CommercialGoalResponseDto,
  CommercialGoalSummaryQueryDto,
  CommercialGoalSummaryResponseDto,
  CreateCommercialGoalDto,
  DeleteCommercialGoalResponseDto,
  ListCommercialGoalsQueryDto,
  PaginatedCommercialGoalsResponseDto,
  UpdateCommercialGoalDto,
} from '../dtos/commercial-goal.dto';
import { CommercialGoalsService } from '../services/commercial-goals.service';

@Controller('commercial-goals')
export class CommercialGoalsController {
  constructor(
    private readonly commercialGoalsService: CommercialGoalsService,
  ) {}

  @Get()
  @CheckAbility({ action: 'read', subject: 'CommercialGoal' })
  list(
    @Query() query: ListCommercialGoalsQueryDto,
  ): Promise<PaginatedCommercialGoalsResponseDto> {
    return this.commercialGoalsService.list(query);
  }

  @Get('summary')
  @CheckAbility({ action: 'read', subject: 'CommercialGoal' })
  summary(
    @Query() query: CommercialGoalSummaryQueryDto,
  ): Promise<CommercialGoalSummaryResponseDto> {
    return this.commercialGoalsService.summary(query);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'CommercialGoal' })
  getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CommercialGoalResponseDto> {
    return this.commercialGoalsService.getById(id);
  }

  @Post()
  @CheckAbility({ action: 'create', subject: 'CommercialGoal' })
  create(
    @Body() dto: CreateCommercialGoalDto,
  ): Promise<CommercialGoalResponseDto> {
    return this.commercialGoalsService.create(dto);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'CommercialGoal' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCommercialGoalDto,
  ): Promise<CommercialGoalResponseDto> {
    return this.commercialGoalsService.update(id, dto);
  }

  @Delete(':id')
  @CheckAbility({ action: 'delete', subject: 'CommercialGoal' })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DeleteCommercialGoalResponseDto> {
    return this.commercialGoalsService.remove(id);
  }
}
