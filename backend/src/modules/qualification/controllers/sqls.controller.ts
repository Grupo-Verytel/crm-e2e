import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { CreateReminderDto } from '../../demand-generation/dtos/create-reminder.dto';
import { ReminderResponseDto } from '../../demand-generation/dtos/reminder-response.dto';
import { CreateInteractionDto } from '../../demand-generation/dtos/create-interaction.dto';
import { InteractionResponseDto } from '../../demand-generation/dtos/interaction-response.dto';
import { CrearOuvDto } from '../../discovery/dtos/crear-ouv.dto';
import {
  AssignSqlDto,
  CreateAssignedSqlCitaDto,
  UpdateSqlCitaDto,
} from '../dtos/assign-sql.dto';
import {
  AssignSqlResponseDto,
  ConvertirSqlResponseDto,
  PaginatedSqlsResponseDto,
  SqlCitaResponseDto,
  SqlDetailDto,
  SqlsQueryDto,
} from '../dtos/sql-response.dto';
import { SqlsService } from '../services/sqls.service';

@Controller('qualification/sqls')
export class SqlsController {
  constructor(private readonly sqlsService: SqlsService) {}

  @Get('inbox')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  listInbox(
    @Query() query: SqlsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedSqlsResponseDto> {
    return this.sqlsService.listInbox(query, user.roleName);
  }

  @Get('assigned')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  listAssigned(
    @Query() query: SqlsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedSqlsResponseDto> {
    return this.sqlsService.listAssigned(user.userId, query, user.roleName);
  }

  @Get(':id/interactions')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  listInteractions(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InteractionResponseDto[]> {
    return this.sqlsService.listInteractions(id, user.userId, user.roleName);
  }

  @Post(':id/interactions')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  registerInteraction(
    @Param('id') id: string,
    @Body() dto: CreateInteractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InteractionResponseDto> {
    return this.sqlsService.registerInteraction(
      id,
      dto,
      user.userId,
      user.roleName,
    );
  }

  @Post(':id/interactions/:interactionId/reminders')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  createInteractionReminder(
    @Param('id') id: string,
    @Param('interactionId') interactionId: string,
    @Body() dto: CreateReminderDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReminderResponseDto> {
    return this.sqlsService.createInteractionReminder(
      id,
      interactionId,
      dto,
      user.userId,
      user.roleName,
    );
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlDetailDto> {
    return this.sqlsService.findById(id, user.userId, user.roleName);
  }

  @Post(':id/assign')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignSqlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignSqlResponseDto> {
    return this.sqlsService.assign(id, dto, user.userId, user.roleName);
  }

  @Post(':id/convertir')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  convertir(
    @Param('id') id: string,
    @Body() dto: CrearOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConvertirSqlResponseDto> {
    return this.sqlsService.convertirEnOuv(id, dto, user.userId);
  }

  @Post(':id/cita')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  createCita(
    @Param('id') id: string,
    @Body() dto: CreateAssignedSqlCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlCitaResponseDto> {
    return this.sqlsService.createCitaForAssignedSql(
      id,
      dto,
      user.userId,
      user.roleName,
    );
  }

  @Patch(':id/cita')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  updateCita(
    @Param('id') id: string,
    @Body() dto: UpdateSqlCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlCitaResponseDto> {
    return this.sqlsService.updateCita(id, dto, user.userId, user.roleName);
  }

  @Delete(':id/cita')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  cancelCita(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.sqlsService.cancelCitaForAssignedSql(
      id,
      user.userId,
      user.roleName,
    );
  }
}
