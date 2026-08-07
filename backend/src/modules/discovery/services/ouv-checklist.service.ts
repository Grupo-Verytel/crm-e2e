import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import { OuvResultado, OuvZona } from '../models/enums/ouv.enums';
import { OuvChecklistItem } from '../models/ouv-checklist-item.model';
import { Ouv } from '../models/ouv.model';
import { ZonaChecklistTemplate } from '../models/zona-checklist-template.model';
import { CriteriosZonaEvaluator } from './criterios-zona.evaluator';

@Injectable()
export class OuvChecklistService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvChecklistItem)
    private readonly itemModel: typeof OuvChecklistItem,
    @InjectModel(ZonaChecklistTemplate)
    private readonly templateModel: typeof ZonaChecklistTemplate,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly criteriosEvaluator: CriteriosZonaEvaluator,
  ) {}

  /**
   * Seed checklist rows for a zona from templates (idempotent per ouv/zona/codigo).
   */
  async seedChecklistParaZona(
    ouvId: string,
    zona: OuvZona,
    transaction: Transaction,
  ): Promise<OuvChecklistItem[]> {
    const templates = await this.templateModel.findAll({
      where: { zona },
      order: [['orden', 'ASC']],
      transaction,
    });

    const created: OuvChecklistItem[] = [];
    for (const template of templates) {
      const existing = await this.itemModel.findOne({
        where: {
          ouvId,
          zona,
          codigoItem: template.codigoItem,
        },
        transaction,
      });
      if (existing) {
        continue;
      }

      const item = await this.itemModel.create(
        {
          ouvId,
          zona,
          codigoItem: template.codigoItem,
          label: template.label,
          marcado: false,
          marcadoAt: null,
          marcadoPor: null,
        },
        { transaction },
      );
      created.push(item);
    }
    return created;
  }

  async listByOuvZona(
    ouvId: string,
    zona: OuvZona,
  ): Promise<OuvChecklistItem[]> {
    return this.itemModel.findAll({
      where: { ouvId, zona },
      order: [['codigoItem', 'ASC']],
    });
  }

  async marcarItem(
    itemId: string,
    marcado: boolean,
    actorUserId: string,
  ): Promise<OuvChecklistItem> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const item = await this.itemModel.findByPk(itemId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!item) {
        throw new NotFoundException(`Checklist item ${itemId} not found`);
      }

      const ouv = await this.ouvModel.findByPk(item.ouvId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!ouv) {
        throw new NotFoundException(`OUV ${item.ouvId} not found`);
      }
      if (ouv.comercialId !== actorUserId) {
        throw new ForbiddenException(
          'Only the owning Ejecutivo Comercial can update checklist',
        );
      }
      if (ouv.resultado !== OuvResultado.EnCurso) {
        throw new BadRequestException(
          `Cannot update checklist on a closed OUV (resultado=${ouv.resultado})`,
        );
      }

      await item.update(
        marcado
          ? {
              marcado: true,
              marcadoAt: new Date(),
              marcadoPor: actorUserId,
            }
          : {
              marcado: false,
              marcadoAt: null,
              marcadoPor: null,
            },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.checklist_item_marcado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            item_id: item.itemId,
            codigo_item: item.codigoItem,
            zona: item.zona,
            marcado,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );

      await this.criteriosEvaluator.evaluate(ouv, actorUserId, transaction);

      return item;
    });
  }
}
