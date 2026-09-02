import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CheckAbility } from '../../auth/casl/check-ability.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { ActualizarInfluenciaDto } from '../dtos/actualizar-influencia.dto';
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
  OuvResponseDto,
  PaginatedOuvsResponseDto,
} from '../dtos/ouv-response.dto';
import { InfluenciaTipo, OuvZona } from '../models/enums/ouv.enums';
import { OuvChecklistService } from '../services/ouv-checklist.service';
import { OuvInfluenciasService } from '../services/ouv-influencias.service';
import { OuvsService } from '../services/ouvs.service';

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
    const canListAll =
      user.roleName === 'SoporteComercial' || user.roleName === 'Admin';
    const result = await this.ouvsService.listarPorComercial(user.userId, {
      ...query,
      all: canListAll ? query.all === true : false,
    });
    return {
      items: result.items.map((o) => this.ouvsService.toResponse(o)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
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
    return this.ouvsService.toResponse(ouv);
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
    return this.ouvsService.toResponse(ouv);
  }

  @Post(':id/ganar')
  @CheckAbility({ action: 'close', subject: 'Opportunity' })
  async ganar(
    @Param('id') id: string,
    @Body() dto: GanarOuvDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvResponseDto> {
    const ouv = await this.ouvsService.ganar(id, dto, user.userId, user.roleName);
    return this.ouvsService.toResponse(ouv);
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
    return this.ouvsService.toResponse(ouv);
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
    return this.ouvsService.toResponse(ouv);
  }

  @Get(':id/influencias')
  @CheckAbility({ action: 'read', subject: 'Opportunity' })
  async listInfluencias(
    @Param('id') id: string,
  ): Promise<OuvInfluenciaResponseDto[]> {
    const rows = await this.influenciasService.listByOuv(id);
    return rows.map((r) => ({
      influencia_id: r.influenciaId,
      ouv_id: r.ouvId,
      tipo: r.tipo,
      estado: r.estado,
      contacto_ouv_id: r.contactoOuvId,
      notas: r.notas,
      motivo_estado: r.motivoEstado,
      fecha_ultimo_cambio: r.fechaUltimoCambio,
      created_at: r.createdAt,
    }));
  }

  @Patch(':id/influencias/:tipo')
  @CheckAbility({ action: 'update', subject: 'Opportunity' })
  async actualizarInfluencia(
    @Param('id') id: string,
    @Param('tipo', new ParseEnumPipe(InfluenciaTipo)) tipo: InfluenciaTipo,
    @Body() dto: ActualizarInfluenciaDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<OuvInfluenciaResponseDto> {
    const r = await this.influenciasService.actualizarEstado(
      id,
      tipo,
      dto,
      user.userId,
      user.roleName,
    );
    return {
      influencia_id: r.influenciaId,
      ouv_id: r.ouvId,
      tipo: r.tipo,
      estado: r.estado,
      contacto_ouv_id: r.contactoOuvId,
      notas: r.notas,
      motivo_estado: r.motivoEstado,
      fecha_ultimo_cambio: r.fechaUltimoCambio,
      created_at: r.createdAt,
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
