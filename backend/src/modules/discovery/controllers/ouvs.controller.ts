import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseFilters,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { AgregarInfluenciaContactoDto } from '../dtos/agregar-influencia-contacto.dto';
import { CalificarInfluenciaContactoDto } from '../dtos/calificar-influencia-contacto.dto';
import { EditarNotaInfluenciaDto } from '../dtos/editar-nota-influencia.dto';
import { ActualizarOuvDto } from '../dtos/actualizar-ouv.dto';
import { ActualizarPresupuestoDto } from '../dtos/actualizar-presupuesto.dto';
import {
  DescartarOuvDto,
  GanarOuvDto,
  PerderOuvDto,
  RetrocederOuvDto,
} from '../dtos/cierre-ouv.dto';
import { CrearOuvDirectaDto } from '../dtos/crear-ouv-directa.dto';
import { ListarOuvsQueryDto } from '../dtos/listar-ouvs-query.dto';
import { MarcarChecklistItemDto } from '../dtos/marcar-checklist-item.dto';
import {
  OuvChecklistItemResponseDto,
  OuvInfluenciaResponseDto,
  OuvInfluenciasListResponseDto,
  OuvResponseDto,
  PaginatedOuvsResponseDto,
} from '../dtos/ouv-response.dto';
import { InfluenciaTipo, OuvZona } from '../models/enums/ouv.enums';
import { canReadAllOuvs } from '../lib/ouv-access';
import { OuvChecklistService } from '../services/ouv-checklist.service';
import { OuvInfluenciasService } from '../services/ouv-influencias.service';
import { OuvsService } from '../services/ouvs.service';
import { InfluenciaProblemFilter } from '../filters/influencia-problem.filter';

@UseFilters(InfluenciaProblemFilter)
@Controller('discovery/ouvs')
export class OuvsController {
  constructor(
    private readonly ouvsService: OuvsService,
    private readonly influenciasService: OuvInfluenciasService,
    private readonly checklistService: OuvChecklistService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'create', subject: 'Opportunity' })
  async crearDirecta(
    @Body() dto: CrearOuvDirectaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.crearDirecta(dto, user.userId);
    return this.ouvsService.toResponse(ouv);
  }

  @Get()
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  async listar(
    @Query() query: ListarOuvsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PaginatedOuvsResponseDto> {
    const canListAll = canReadAllOuvs(user.roleName);
    const result = await this.ouvsService.listarPorComercial(user.userId, {
      ...query,
      all: canListAll && query.all === true,
    });
    return {
      items: result.items.map((o) => this.ouvsService.toResponse(o)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('ejecutivos-comerciales')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  listEjecutivosComerciales(): Promise<
    Array<{ user_id: string; full_name: string }>
  > {
    return this.ouvsService.listEjecutivosComerciales();
  }

  @Get(':id')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  async detalle(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.getDetalle(
      id,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toDetailResponse(ouv);
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.actualizarMetadatos(
      id,
      dto,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toResponse(ouv);
  }

  @Post(':id/avanzar')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async avanzar(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.avanzarZona(
      id,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toDetailResponse(ouv);
  }

  @Post(':id/retroceder')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async retroceder(
    @Param('id') id: string,
    @Body() dto: RetrocederOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.retrocederZona(
      id,
      dto.motivo,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toDetailResponse(ouv);
  }

  @Post(':id/ganar')
  @CheckAbility({ action: 'close', subject: 'Opportunity' })
  async ganar(
    @Param('id') id: string,
    @Body() dto: GanarOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.ganar(
      id,
      dto,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toDetailResponse(ouv);
  }

  @Post(':id/perder')
  @CheckAbility({ action: 'close', subject: 'Opportunity' })
  async perder(
    @Param('id') id: string,
    @Body() dto: PerderOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.perder(
      id,
      dto,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toDetailResponse(ouv);
  }

  @Post(':id/descartar')
  @CheckAbility({ action: 'close', subject: 'Opportunity' })
  async descartar(
    @Param('id') id: string,
    @Body() dto: DescartarOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.descartar(
      id,
      dto,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toDetailResponse(ouv);
  }

  @Get(':id/influencias')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  async listInfluencias(
    @Param('id') id: string,
  ): Promise<OuvInfluenciasListResponseDto> {
    const { rows, filtro } = await this.influenciasService.listByOuv(id);
    return {
      influencias: rows.map((row) => this.toInfluenciaResponse(row)),
      filtro,
    };
  }

  @Post(':id/influencias/:tipo/contactos')
  @HttpCode(HttpStatus.CREATED)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async agregarInfluenciaContacto(
    @Param('id') id: string,
    @Param('tipo', new ParseEnumPipe(InfluenciaTipo)) tipo: InfluenciaTipo,
    @Body() dto: AgregarInfluenciaContactoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInfluenciaResponseDto> {
    const row = await this.influenciasService.agregarContacto(
      id,
      tipo,
      dto.contacto_ouv_id,
      user.userId,
    );
    return this.toInfluenciaResponse(row);
  }

  @Delete(':id/influencias/:tipo/contactos/:contactoOuvId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async quitarInfluenciaContacto(
    @Param('id') id: string,
    @Param('tipo', new ParseEnumPipe(InfluenciaTipo)) tipo: InfluenciaTipo,
    @Param('contactoOuvId', ParseUUIDPipe) contactoOuvId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.influenciasService.quitarContacto(
      id,
      tipo,
      contactoOuvId,
      user.userId,
    );
  }

  @Patch(':id/influencias/:tipo/contactos/:contactoOuvId/estado')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async calificarInfluenciaContacto(
    @Param('id') id: string,
    @Param('tipo', new ParseEnumPipe(InfluenciaTipo)) tipo: InfluenciaTipo,
    @Param('contactoOuvId', ParseUUIDPipe) contactoOuvId: string,
    @Body() dto: CalificarInfluenciaContactoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInfluenciaResponseDto> {
    const row = await this.influenciasService.calificar(
      id,
      tipo,
      contactoOuvId,
      dto.estado,
      user.userId,
    );
    return this.toInfluenciaResponse(row);
  }

  @Patch(':id/influencias/:tipo/contactos/:contactoOuvId/notas')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async editarNotaInfluenciaContacto(
    @Param('id') id: string,
    @Param('tipo', new ParseEnumPipe(InfluenciaTipo)) tipo: InfluenciaTipo,
    @Param('contactoOuvId', ParseUUIDPipe) contactoOuvId: string,
    @Body() dto: EditarNotaInfluenciaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInfluenciaResponseDto> {
    const row = await this.influenciasService.editarNota(
      id,
      tipo,
      contactoOuvId,
      dto.notas,
      user.userId,
    );
    return this.toInfluenciaResponse(row);
  }

  private toInfluenciaResponse(row: {
    influenciaId: string;
    ouvId: string;
    tipo: string;
    estado: string;
    contactoOuvId: string;
    notas: string | null;
    motivoEstado: string | null;
    fechaUltimoCambio: Date | null;
    createdAt: Date;
  }): OuvInfluenciaResponseDto {
    return {
      influencia_id: row.influenciaId,
      ouv_id: row.ouvId,
      tipo: row.tipo,
      estado: row.estado,
      contacto_ouv_id: row.contactoOuvId,
      notas: row.notas,
      motivo_estado: row.motivoEstado,
      fecha_ultimo_cambio: row.fechaUltimoCambio,
      created_at: row.createdAt,
    };
  }

  @Get(':id/checklist')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  async listChecklist(
    @Param('id') id: string,
    @Query('zona', new ParseEnumPipe(OuvZona)) zona: OuvZona,
  ): Promise<OuvChecklistItemResponseDto[]> {
    const rows = await this.checklistService.listByOuvZona(id, zona);
    return rows.map((r) => ({
      item_id: r.itemId,
      ouv_id: r.ouvId,
      zona: r.zona,
      codigo_item: r.codigoItem,
      label: r.label,
      marcado: r.marcado,
      marcado_at: r.marcadoAt,
      marcado_por: r.marcadoPor,
      created_at: r.createdAt,
    }));
  }

  @Patch(':id/checklist/:itemId')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async marcarChecklist(
    @Param('itemId') itemId: string,
    @Body() dto: MarcarChecklistItemDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvChecklistItemResponseDto> {
    const r = await this.checklistService.marcarItem(
      itemId,
      dto.marcado,
      user.userId,
    );
    return {
      item_id: r.itemId,
      ouv_id: r.ouvId,
      zona: r.zona,
      codigo_item: r.codigoItem,
      label: r.label,
      marcado: r.marcado,
      marcado_at: r.marcadoAt,
      marcado_por: r.marcadoPor,
      created_at: r.createdAt,
    };
  }

  @Patch(':id')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async actualizarMetadatos(
    @Param('id') id: string,
    @Body() dto: ActualizarOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.actualizarMetadatos(
      id,
      dto,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toResponse(ouv);
  }

  @Patch(':id/presupuesto')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async actualizarPresupuesto(
    @Param('id') id: string,
    @Body() dto: ActualizarPresupuestoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.actualizarPresupuesto(
      id,
      dto,
      user.userId,
      user.roleName,
    );
    return this.ouvsService.toResponse(ouv);
  }
}
