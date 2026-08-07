import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Sequelize, type Transaction } from 'sequelize';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import type { ActualizarPresupuestoDto } from '../dtos/actualizar-presupuesto.dto';
import type {
  DescartarOuvDto,
  GanarOuvDto,
  PerderOuvDto,
} from '../dtos/cierre-ouv.dto';
import type { CrearOuvDirectaDto } from '../dtos/crear-ouv-directa.dto';
import type { CrearOuvDto } from '../dtos/crear-ouv.dto';
import type { ListarOuvsQueryDto } from '../dtos/listar-ouvs-query.dto';
import type { OuvResponseDto } from '../dtos/ouv-response.dto';
import { nextZona, prevZona } from '../lib/ouv-zona-order';
import {
  OuvOrigenVia,
  OuvResultado,
  OuvZona,
} from '../models/enums/ouv.enums';
import { MotivoDescarte } from '../models/motivo-descarte.model';
import { MotivoPerdida } from '../models/motivo-perdida.model';
import { Ouv } from '../models/ouv.model';
import { CriteriosZonaEvaluator } from './criterios-zona.evaluator';
import { OuvChecklistService } from './ouv-checklist.service';
import { OuvContactosService } from './ouv-contactos.service';
import { OuvInfluenciasService } from './ouv-influencias.service';

export type CrearDesdeSqlInput = {
  sqlId: string;
  comercialId: string;
  leadId: string;
  dto: CrearOuvDto;
};

export type PaginatedOuvs = {
  items: Ouv[];
  total: number;
  page: number;
  limit: number;
};

@Injectable()
export class OuvsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(MotivoPerdida)
    private readonly motivoPerdidaModel: typeof MotivoPerdida,
    @InjectModel(MotivoDescarte)
    private readonly motivoDescarteModel: typeof MotivoDescarte,
    private readonly demandGeneration: DemandGenerationService,
    private readonly contactosService: OuvContactosService,
    private readonly influenciasService: OuvInfluenciasService,
    private readonly checklistService: OuvChecklistService,
    private readonly criteriosEvaluator: CriteriosZonaEvaluator,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  /**
   * Vía 1 — create OUV from SQL inside caller's transaction (EARS-01..03).
   * Workflow event `ouv.creada_desde_sql` is emitted by SqlsService (PASO 3).
   */
  async crearDesdeSql(
    input: CrearDesdeSqlInput,
    transaction: Transaction,
  ): Promise<Ouv> {
    const lead = await this.demandGeneration.findLeadById(input.leadId);
    const empresaNombre =
      lead.contacts?.[0]?.empresa_nombre?.trim() ||
      lead.empresa_nombre?.trim() ||
      'PENDIENTE';

    const consecutivo = await this.nextOuvConsecutivo(transaction);

    const ouv = await this.ouvModel.create(
      {
        consecutivo,
        sqlIdOrigen: input.sqlId,
        origenVia: OuvOrigenVia.DesdeSql,
        comercialId: input.comercialId,
        titulo: input.dto.titulo.trim(),
        empresaNombre,
        descripcion: input.dto.descripcion?.trim() || null,
        segmento: input.dto.segmento,
        vertical: input.dto.vertical,
        zonaActual: OuvZona.Universo,
        resultado: OuvResultado.EnCurso,
        tieneGap: false,
        presupuestoConfirmado: false,
      },
      { transaction },
    );

    await this.contactosService.crearDesdeLead(
      ouv.ouvId,
      input.leadId,
      transaction,
    );
    await this.influenciasService.seedInfluenciasParaOuv(
      ouv.ouvId,
      transaction,
    );
    await this.checklistService.seedChecklistParaZona(
      ouv.ouvId,
      OuvZona.Universo,
      transaction,
    );

    return ouv;
  }

  /** Vías 2/3/4 — direct OUV (EARS-05..07). */
  async crearDirecta(
    dto: CrearOuvDirectaDto,
    actorUserId: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const consecutivo = await this.nextOuvConsecutivo(transaction);

      const ouv = await this.ouvModel.create(
        {
          consecutivo,
          sqlIdOrigen: null,
          origenVia: OuvOrigenVia.Directa,
          comercialId: actorUserId,
          titulo: dto.titulo.trim(),
          empresaNombre: dto.empresa_nombre.trim(),
          descripcion: dto.descripcion.trim(),
          segmento: dto.segmento,
          vertical: dto.vertical,
          zonaActual: OuvZona.Universo,
          resultado: OuvResultado.EnCurso,
          tieneGap: false,
          presupuestoConfirmado: false,
        },
        { transaction },
      );

      await this.influenciasService.seedInfluenciasParaOuv(
        ouv.ouvId,
        transaction,
      );
      await this.checklistService.seedChecklistParaZona(
        ouv.ouvId,
        OuvZona.Universo,
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.creada_directa',
        {
          estadoAnterior: null,
          estadoNuevo: OuvZona.Universo,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: actorUserId,
            titulo: ouv.titulo,
            empresa_nombre: ouv.empresaNombre,
          },
          entity: { estado: OuvZona.Universo },
        },
        transaction,
      );

      return ouv;
    });
  }

  async avanzarZona(ouvId: string, actorUserId: string): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(ouvId, actorUserId, transaction);
      const destino = nextZona(ouv.zonaActual);
      if (!destino) {
        throw new BadRequestException(
          `Cannot advance from zona ${ouv.zonaActual}`,
        );
      }

      await this.assertGuardsForDestino(ouv, destino, transaction);

      const estadoAnterior = ouv.zonaActual;
      const verdes = await this.influenciasService.countVerde(
        ouv.ouvId,
        transaction,
      );

      await ouv.update({ zonaActual: destino }, { transaction });
      await this.checklistService.seedChecklistParaZona(
        ouv.ouvId,
        destino,
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.avance_zona',
        {
          estadoAnterior,
          estadoNuevo: destino,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            zona_anterior: estadoAnterior,
            zona_nueva: destino,
            comercial_id: ouv.comercialId,
            presupuesto_confirmado: ouv.presupuestoConfirmado,
            influencias_verde_count: verdes,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
      return ouv;
    });
  }

  async retrocederZona(
    ouvId: string,
    motivo: string,
    actorUserId: string,
  ): Promise<Ouv> {
    const motivoTrim = motivo?.trim();
    if (!motivoTrim) {
      throw new BadRequestException('motivo is required to retroceder');
    }

    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(ouvId, actorUserId, transaction);
      const destino = prevZona(ouv.zonaActual);
      if (!destino) {
        throw new BadRequestException(
          'Cannot retroceder from UNIVERSO — use Descartada instead',
        );
      }

      const estadoAnterior = ouv.zonaActual;
      await ouv.update({ zonaActual: destino }, { transaction });

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.retroceso_zona',
        {
          estadoAnterior,
          estadoNuevo: destino,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            motivo: motivoTrim,
            zona_anterior: estadoAnterior,
            zona_nueva: destino,
            comercial_id: ouv.comercialId,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
      return ouv;
    });
  }

  async ganar(
    ouvId: string,
    dto: GanarOuvDto,
    actorUserId: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(ouvId, actorUserId, transaction);

      if (ouv.zonaActual !== OuvZona.MayorProbabilidad) {
        throw new BadRequestException(
          `Ganada requires zona MAYOR_PROBABILIDAD (current: ${ouv.zonaActual})`,
        );
      }

      let motivoSnapshot: string | null = null;
      if (dto.motivo_id) {
        const motivo = await this.motivoPerdidaModel.findByPk(dto.motivo_id, {
          transaction,
        });
        if (!motivo) {
          throw new BadRequestException(`motivo_id ${dto.motivo_id} not found`);
        }
        motivoSnapshot = motivo.nombre;
        if (motivo.requiereDetalle && !dto.motivo_detalle?.trim()) {
          throw new BadRequestException(
            'motivo_detalle is required for this motivo',
          );
        }
      }

      const zonaAlCerrar = ouv.zonaActual;
      const estadoAnteriorResultado = ouv.resultado;
      await ouv.update(
        {
          resultado: OuvResultado.Ganada,
          motivoId: dto.motivo_id ?? null,
          motivoSnapshot,
          motivoDetalle: dto.motivo_detalle?.trim() || null,
          montoFinal: String(dto.monto_final),
          monedaFinal: dto.moneda_final,
          fechaCierre: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.ganada',
        {
          estadoAnterior: zonaAlCerrar,
          estadoNuevo: OuvResultado.Ganada,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            monto_final: dto.monto_final,
            moneda_final: dto.moneda_final,
            resultado_anterior: estadoAnteriorResultado,
          },
          entity: { estado: zonaAlCerrar },
        },
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.lista_para_implementacion',
        {
          estadoAnterior: OuvResultado.Ganada,
          estadoNuevo: OuvResultado.Ganada,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            ouv_id: ouv.ouvId,
          },
          entity: { estado: OuvResultado.Ganada },
        },
        transaction,
      );

      return ouv;
    });
  }

  async perder(
    ouvId: string,
    dto: PerderOuvDto,
    actorUserId: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(ouvId, actorUserId, transaction);

      const motivo = await this.motivoPerdidaModel.findByPk(dto.motivo_id, {
        transaction,
      });
      if (!motivo) {
        throw new BadRequestException(`motivo_id ${dto.motivo_id} not found`);
      }
      if (motivo.requiereDetalle && !dto.motivo_detalle?.trim()) {
        throw new BadRequestException(
          'motivo_detalle is required for this motivo',
        );
      }

      const needsCompetidor = /competidor/i.test(motivo.nombre);
      if (needsCompetidor && !dto.competidor_ganador?.trim()) {
        throw new BadRequestException(
          'competidor_ganador is required for this motivo',
        );
      }

      const estadoAnterior = ouv.resultado;
      await ouv.update(
        {
          resultado: OuvResultado.Perdida,
          motivoId: motivo.motivoId,
          motivoSnapshot: motivo.nombre,
          motivoDetalle: dto.motivo_detalle?.trim() || null,
          montoEstimadoPerdido: String(dto.monto_estimado_perdido),
          competidorGanador: dto.competidor_ganador?.trim() || null,
          fechaCierre: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.perdida',
        {
          estadoAnterior,
          estadoNuevo: OuvResultado.Perdida,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            motivo_id: motivo.motivoId,
            motivo_snapshot: motivo.nombre,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      return ouv;
    });
  }

  async descartar(
    ouvId: string,
    dto: DescartarOuvDto,
    actorUserId: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(ouvId, actorUserId, transaction);

      const motivo = await this.motivoDescarteModel.findByPk(dto.motivo_id, {
        transaction,
      });
      if (!motivo) {
        throw new BadRequestException(`motivo_id ${dto.motivo_id} not found`);
      }
      if (motivo.requiereDetalle && !dto.motivo_detalle?.trim()) {
        throw new BadRequestException(
          'motivo_detalle is required for this motivo',
        );
      }

      const estadoAnterior = ouv.resultado;
      await ouv.update(
        {
          resultado: OuvResultado.Descartada,
          motivoId: motivo.motivoId,
          motivoSnapshot: motivo.nombre,
          motivoDetalle: dto.motivo_detalle?.trim() || null,
          fechaCierre: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.descartada',
        {
          estadoAnterior,
          estadoNuevo: OuvResultado.Descartada,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            motivo_id: motivo.motivoId,
            motivo_snapshot: motivo.nombre,
          },
          entity: { estado: estadoAnterior },
        },
        transaction,
      );

      return ouv;
    });
  }

  async actualizarPresupuesto(
    ouvId: string,
    dto: ActualizarPresupuestoDto,
    actorUserId: string,
  ): Promise<Ouv> {
    return this.sequelize.transaction(async (transaction) => {
      const ouv = await this.lockOwnedEnCurso(ouvId, actorUserId, transaction);

      await ouv.update(
        {
          presupuestoConfirmado: dto.presupuesto_confirmado,
          presupuestoMonto:
            dto.presupuesto_monto === undefined ||
            dto.presupuesto_monto === null
              ? null
              : String(dto.presupuesto_monto),
          presupuestoMoneda: dto.presupuesto_moneda ?? null,
          presupuestoFechaCaptura: dto.presupuesto_fecha_captura
            ? new Date(dto.presupuesto_fecha_captura)
            : null,
          presupuestoFuente: dto.presupuesto_fuente ?? null,
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.presupuesto_actualizado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            presupuesto_confirmado: dto.presupuesto_confirmado,
            comercial_id: ouv.comercialId,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
      return ouv;
    });
  }

  async listarPorComercial(
    comercialId: string,
    query: ListarOuvsQueryDto,
  ): Promise<PaginatedOuvs> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Record<string | symbol, unknown> = {};

    if (!query.all) {
      where.comercialId = comercialId;
    }
    if (query.zona) {
      where.zonaActual = query.zona;
    }
    if (query.resultado) {
      where.resultado = query.resultado;
    }
    if (query.tiene_gap !== undefined) {
      where.tieneGap = query.tiene_gap;
    }
    if (query.q?.trim()) {
      const like = `%${query.q.trim()}%`;
      where[Op.or] = [
        { titulo: { [Op.like]: like } },
        { empresaNombre: { [Op.like]: like } },
        { consecutivo: { [Op.like]: like } },
      ];
    }
    if (query.created_from || query.created_to) {
      where.createdAt = {
        ...(query.created_from
          ? { [Op.gte]: new Date(query.created_from) }
          : {}),
        ...(query.created_to ? { [Op.lte]: new Date(query.created_to) } : {}),
      };
    }

    const { rows, count } = await this.ouvModel.findAndCountAll({
      where,
      order: [['updatedAt', 'DESC']],
      limit,
      offset: (page - 1) * limit,
    });

    return { items: rows, total: count, page, limit };
  }

  async findById(ouvId: string): Promise<Ouv | null> {
    return this.ouvModel.findByPk(ouvId);
  }

  /**
   * Detail with ownership: Ejecutivo owns; SoporteComercial/Admin can read all.
   */
  async getDetalle(
    ouvId: string,
    actorUserId: string,
    roleName: string,
  ): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId);
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }
    const canReadAll =
      roleName === 'SoporteComercial' || roleName === 'Admin';
    if (!canReadAll && ouv.comercialId !== actorUserId) {
      throw new ForbiddenException('Not allowed to view this OUV');
    }
    return ouv;
  }

  toResponse(ouv: Ouv): OuvResponseDto {
    return {
      ouv_id: ouv.ouvId,
      consecutivo: ouv.consecutivo,
      sql_id_origen: ouv.sqlIdOrigen,
      origen_via: ouv.origenVia,
      comercial_id: ouv.comercialId,
      titulo: ouv.titulo,
      empresa_nombre: ouv.empresaNombre,
      descripcion: ouv.descripcion,
      segmento: ouv.segmento,
      vertical: ouv.vertical,
      zona_actual: ouv.zonaActual,
      resultado: ouv.resultado,
      tiene_gap: ouv.tieneGap,
      criterios_faltantes: ouv.criteriosFaltantes,
      presupuesto_confirmado: ouv.presupuestoConfirmado,
      presupuesto_monto: ouv.presupuestoMonto,
      presupuesto_moneda: ouv.presupuestoMoneda,
      presupuesto_fecha_captura: ouv.presupuestoFechaCaptura,
      presupuesto_fuente: ouv.presupuestoFuente,
      motivo_id: ouv.motivoId,
      motivo_snapshot: ouv.motivoSnapshot,
      motivo_detalle: ouv.motivoDetalle,
      competidor_ganador: ouv.competidorGanador,
      monto_final: ouv.montoFinal,
      moneda_final: ouv.monedaFinal,
      monto_estimado_perdido: ouv.montoEstimadoPerdido,
      fecha_cierre: ouv.fechaCierre,
      created_at: ouv.createdAt,
      updated_at: ouv.updatedAt,
    };
  }

  private async lockOwnedEnCurso(
    ouvId: string,
    actorUserId: string,
    transaction: Transaction,
  ): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!ouv) {
      throw new NotFoundException(`OUV ${ouvId} not found`);
    }
    if (ouv.comercialId !== actorUserId) {
      throw new ForbiddenException(
        'Only the owning Ejecutivo Comercial can perform this action',
      );
    }
    if (ouv.resultado !== OuvResultado.EnCurso) {
      throw new BadRequestException(
        `OUV is already closed (resultado=${ouv.resultado})`,
      );
    }
    return ouv;
  }

  private async assertGuardsForDestino(
    ouv: Ouv,
    destino: OuvZona,
    transaction: Transaction,
  ): Promise<void> {
    if (destino === OuvZona.EncimaFunnel && !ouv.presupuestoConfirmado) {
      throw new BadRequestException(
        'presupuesto_confirmado is required to advance to ENCIMA_FUNNEL',
      );
    }

    if (
      destino === OuvZona.EnFunnel ||
      destino === OuvZona.MayorProbabilidad
    ) {
      const verdes = await this.influenciasService.countVerde(
        ouv.ouvId,
        transaction,
      );
      if (verdes < 2) {
        throw new BadRequestException(
          'At least 2 influencias in Verde are required to advance',
        );
      }
    }
  }

  /**
   * Temporary MAX+FOR UPDATE sequence (Wave 1).
   * TODO: migrate to secuenciadores when Modules 3–5 land.
   */
  private async nextOuvConsecutivo(transaction: Transaction): Promise<string> {
    const rows = await this.sequelize.query<{ siguiente: number }>(
      `
        SELECT COALESCE(MAX(CAST(SUBSTRING(consecutivo, 5) AS UNSIGNED)), 0) + 1
          AS siguiente
        FROM ouvs
        FOR UPDATE
      `,
      { transaction, type: QueryTypes.SELECT },
    );
    const siguiente = Number(rows[0]?.siguiente ?? 1);
    return `OUV-${String(siguiente).padStart(4, '0')}`;
  }
}
