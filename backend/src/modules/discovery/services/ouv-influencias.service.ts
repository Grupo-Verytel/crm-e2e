import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { AuditAction } from '../../audit/models/audit-action.enum';
import { AuditService } from '../../audit/services/audit.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { InfluenciaProblemException } from '../exceptions/influencia-problem.exception';
import { assertCanMutateOuvEnCurso } from '../lib/ouv-access';
import {
  evaluateInfluenceFilter,
  type InfluenceFilterResult,
} from '../lib/evaluate-influence-filter';
import {
  InfluenciaEstado,
  InfluenciaTipo,
  OuvResultado,
} from '../models/enums/ouv.enums';
import { OuvContacto } from '../models/ouv-contacto.model';
import { OuvInfluencia } from '../models/ouv-influencia.model';
import { Ouv } from '../models/ouv.model';
import { CriteriosZonaEvaluator } from './criterios-zona.evaluator';

const MAX_CONTACTS_PER_TYPE = 5;
const NOTAS_MAX = 1000;

@Injectable()
export class OuvInfluenciasService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvInfluencia)
    private readonly influenciaModel: typeof OuvInfluencia,
    @InjectModel(OuvContacto)
    private readonly contactoModel: typeof OuvContacto,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly criteriosEvaluator: CriteriosZonaEvaluator,
    private readonly auditService: AuditService,
  ) {}

  async listByOuv(ouvId: string): Promise<{
    rows: OuvInfluencia[];
    filtro: InfluenceFilterResult;
  }> {
    const rows = await this.influenciaModel.findAll({
      where: { ouvId },
      order: [
        ['tipo', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });
    return { rows, filtro: evaluateInfluenceFilter(rows) };
  }

  async countGreenTypes(
    ouvId: string,
    transaction?: Transaction,
  ): Promise<number> {
    const filtro = await this.filtroForOuv(ouvId, transaction);
    return filtro.greenTypes.length;
  }

  async filtroForOuv(
    ouvId: string,
    transaction?: Transaction,
  ): Promise<InfluenceFilterResult> {
    const rows = await this.influenciaModel.findAll({
      where: { ouvId },
      transaction,
    });
    return evaluateInfluenceFilter(rows);
  }

  async agregarContacto(
    ouvId: string,
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    actorUserId: string,
  ): Promise<OuvInfluencia> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockMutableOuv(ouvId, actorUserId, transaction);
      await this.assertContactoDeLaOuv(ouvId, contactoOuvId, transaction);

      const existing = await this.influenciaModel.findOne({
        where: { ouvId, tipo, contactoOuvId },
        paranoid: false,
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (existing && !existing.deletedAt) {
        throw new InfluenciaProblemException(
          HttpStatus.CONFLICT,
          'Ese contacto ya está en esta influencia.',
        );
      }

      const activeCount = await this.influenciaModel.count({
        where: { ouvId, tipo },
        transaction,
      });
      if (activeCount >= MAX_CONTACTS_PER_TYPE) {
        throw new InfluenciaProblemException(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'Esta influencia ya tiene 5 contactos. No se puede agregar otro.',
        );
      }

      let row: OuvInfluencia;
      if (existing) {
        await existing.restore({ transaction });
        await existing.update(
          {
            estado: InfluenciaEstado.SinEvaluar,
            notas: null,
            motivoEstado: null,
            fechaUltimoCambio: new Date(),
          },
          { transaction },
        );
        row = existing;
        await this.audit(row, AuditAction.INSERT, 'contacto_ouv_id', null, contactoOuvId);
      } else {
        row = await this.influenciaModel.create(
          {
            ouvId,
            tipo,
            estado: InfluenciaEstado.SinEvaluar,
            contactoOuvId,
            notas: null,
          },
          { transaction },
        );
        await this.audit(row, AuditAction.INSERT, 'contacto_ouv_id', null, contactoOuvId);
      }

      await this.afterChange(ouv, actorUserId, tipo, row, transaction);
      return row;
    });
  }

  async quitarContacto(
    ouvId: string,
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    actorUserId: string,
  ): Promise<void> {
    await this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockMutableOuv(ouvId, actorUserId, transaction);
      const row = await this.findActive(ouvId, tipo, contactoOuvId, transaction);
      await this.audit(
        row,
        AuditAction.DELETE,
        'contacto_ouv_id',
        contactoOuvId,
        null,
      );
      await row.destroy({ transaction });
      await this.afterChange(ouv, actorUserId, tipo, row, transaction);
    });
  }

  async calificar(
    ouvId: string,
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    estado: InfluenciaEstado,
    actorUserId: string,
  ): Promise<OuvInfluencia> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockMutableOuv(ouvId, actorUserId, transaction);
      const row = await this.findActive(ouvId, tipo, contactoOuvId, transaction);
      const anterior = row.estado;
      await row.update(
        { estado, fechaUltimoCambio: new Date() },
        { transaction },
      );
      await this.audit(row, AuditAction.STATE_CHANGE, 'estado', anterior, estado);
      await this.afterChange(ouv, actorUserId, tipo, row, transaction);
      return row;
    });
  }

  async editarNota(
    ouvId: string,
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    notas: string | null | undefined,
    actorUserId: string,
  ): Promise<OuvInfluencia> {
    const normalizada = this.normalizarNotas(notas);
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockMutableOuv(ouvId, actorUserId, transaction);
      const row = await this.findActive(ouvId, tipo, contactoOuvId, transaction);
      const anterior = row.notas;
      await row.update({ notas: normalizada }, { transaction });
      await this.audit(row, AuditAction.UPDATE, 'notas', anterior, normalizada);
      await this.afterChange(ouv, actorUserId, tipo, row, transaction);
      return row;
    });
  }

  private normalizarNotas(notas: string | null | undefined): string | null {
    if (notas == null) return null;
    const trimmed = notas.trim();
    if (trimmed.length > NOTAS_MAX) {
      throw new InfluenciaProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'La nota admite como máximo 1000 caracteres.',
      );
    }
    return trimmed.length === 0 ? null : trimmed;
  }

  private async lockMutableOuv(
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
    assertCanMutateOuvEnCurso(ouv.comercialId, actorUserId);
    if (ouv.resultado !== OuvResultado.EnCurso) {
      throw new InfluenciaProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'No se pueden editar influencias de una OUV cerrada.',
      );
    }
    return ouv;
  }

  private async assertContactoDeLaOuv(
    ouvId: string,
    contactoOuvId: string,
    transaction: Transaction,
  ): Promise<void> {
    const contacto = await this.contactoModel.findByPk(contactoOuvId, {
      transaction,
    });
    if (!contacto || contacto.ouvId !== ouvId) {
      throw new InfluenciaProblemException(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'El contacto no pertenece a esta OUV.',
      );
    }
  }

  private async findActive(
    ouvId: string,
    tipo: InfluenciaTipo,
    contactoOuvId: string,
    transaction: Transaction,
  ): Promise<OuvInfluencia> {
    const row = await this.influenciaModel.findOne({
      where: { ouvId, tipo, contactoOuvId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!row) {
      throw new NotFoundException(
        `Influencia ${tipo} sin el contacto ${contactoOuvId}`,
      );
    }
    return row;
  }

  private async audit(
    row: OuvInfluencia,
    accion: AuditAction,
    campo: string,
    anterior: string | null,
    nuevo: string | null,
  ): Promise<void> {
    await this.auditService.recordChange({
      tabla: 'ouv_influencias',
      registroId: row.influenciaId,
      accion,
      campoModificado: campo,
      valorAnterior: anterior,
      valorNuevo: nuevo,
    });
  }

  private async afterChange(
    ouv: Ouv,
    actorUserId: string,
    tipo: InfluenciaTipo,
    row: OuvInfluencia,
    transaction: Transaction,
  ): Promise<void> {
    await this.workflowEngine.transition(
      EntityType.OUV,
      ouv.ouvId,
      'ouv.influencia_cambio',
      {
        estadoAnterior: row.estado,
        estadoNuevo: row.estado,
        entityLabel: ouv.consecutivo,
        actorUserId,
        payload: {
          comercial_id: ouv.comercialId,
          tipo,
          contacto_ouv_id: row.contactoOuvId,
        },
        entity: { estado: ouv.zonaActual },
      },
      transaction,
    );
    await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);
  }
}
