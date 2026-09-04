import {
  Body,
  Controller,
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
import { AssignSqlDto, UpdateSqlCitaDto } from '../dtos/assign-sql.dto';
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

  @Patch(':id/cita')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  updateCita(
    @Param('id') id: string,
    @Body() dto: UpdateSqlCitaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SqlCitaResponseDto> {
    return this.sqlsService.updateCita(id, dto, user.userId);
  }
}
