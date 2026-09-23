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
import { CrearOuvDto } from '../../discovery/dtos/crear-ouv.dto';
import {
  AssignSqlDto,
  CreateAssignedSqlCitaDto,
  UpdateSqlCitaDto,
} from '../dtos/assign-sql.dto';
import { UpdateMeetingStatusDto } from '../dtos/update-meeting-status.dto';
import { UpdatePlannedCitaDto } from '../dtos/update-planned-cita.dto';
import {
  AssignSqlResponseDto,
  ConvertirSqlResponseDto,
  PaginatedSqlsResponseDto,
  SqlCitaResponseDto,
  SqlDetailDto,
  SqlsQueryDto,
} from '../dtos/sql-response.dto';
import { CreateSqlInteractionDto } from '../dtos/create-sql-interaction.dto';
import { SqlInteractionResponseDto } from '../dtos/sql-interaction-response.dto';
import { SqlInteractionsService } from '../services/sql-interactions.service';
import { SqlsService } from '../services/sqls.service';

@Controller('qualification/sqls')
export class SqlsController {
  constructor(
    private readonly sqlsService: SqlsService,
    private readonly sqlInteractionsService: SqlInteractionsService,
  ) {}

  @Get('inbox')
  @CheckAbility({ action: 'read', subject: 'Sql' })
  listInbox(
    @Query() query: SqlsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedSqlsResponseDto> {
    return this.sqlsService.listInbox(query, user.roleName);
  }

  @Get('assigned')
  @CheckAbility({ action: 'read', subject: 'Sql' })
  listAssigned(
    @Query() query: SqlsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedSqlsResponseDto> {
    return this.sqlsService.listAssigned(user.userId, query, user.roleName);
  }

  @Get(':id/interactions')
  @CheckAbility({ action: 'read', subject: 'Sql' })
  listInteractions(
    @Param('id') id: string,
  ): Promise<SqlInteractionResponseDto[]> {
    return this.sqlInteractionsService.listBySql(id);
  }

  @Post(':id/interactions')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Sql' })
  registerInteraction(
    @Param('id') id: string,
    @Body() dto: CreateSqlInteractionDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlInteractionResponseDto> {
    return this.sqlInteractionsService.create(id, dto, user.userId);
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Sql' })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlDetailDto> {
    return this.sqlsService.findById(id, user.userId, user.roleName);
  }

  @Post(':id/assign')
  @CheckAbility({ action: 'assign', subject: 'Sql' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignSqlDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AssignSqlResponseDto> {
    return this.sqlsService.assign(id, dto, user.userId, user.roleName);
  }

  @Post(':id/convertir')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'Sql' })
  convertir(
    @Param('id') id: string,
    @Body() dto: CrearOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConvertirSqlResponseDto> {
    return this.sqlsService.convertirEnOuv(id, dto, user.userId);
  }

  @Patch(':id/cita')
  @CheckAbility({ action: 'update', subject: 'Sql' })
  updateCita(
    @Param('id') id: string,
    @Body() dto: UpdateSqlCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlCitaResponseDto> {
    return this.sqlsService.updateCita(id, dto, user.userId);
  }

  @Post(':id/cita')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Sql' })
  createCita(
    @Param('id') id: string,
    @Body() dto: CreateAssignedSqlCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlCitaResponseDto> {
    return this.sqlsService.createCitaForAssignedSql(id, dto, user.userId);
  }

  @Delete(':id/cita')
  @CheckAbility({ action: 'update', subject: 'Sql' })
  cancelCita(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlCitaResponseDto> {
    return this.sqlsService.cancelScheduledCita(
      id,
      user.userId,
      user.roleName,
    );
  }

  @Patch(':id/cita-planificada')
  @CheckAbility({ action: 'assign', subject: 'Sql' })
  reschedulePlannedCita(
    @Param('id') id: string,
    @Body() dto: UpdatePlannedCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlDetailDto> {
    return this.sqlsService.reschedulePlannedCita(
      id,
      dto,
      user.userId,
      user.roleName,
    );
  }

  @Delete(':id/cita-planificada')
  @CheckAbility({ action: 'assign', subject: 'Sql' })
  cancelPlannedCita(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlDetailDto> {
    return this.sqlsService.cancelPlannedCita(id, user.roleName);
  }

  @Patch(':id/meeting-status')
  @CheckAbility({ action: 'assign', subject: 'Sql' })
  updateMeetingStatus(
    @Param('id') id: string,
    @Body() dto: UpdateMeetingStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlDetailDto> {
    return this.sqlsService.updateMeetingStatus(id, dto, user.roleName);
  }
}
