import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import type { Transaction } from 'sequelize';
import { DemandGenerationService } from '../../demand-generation/services/demand-generation.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import type {
  ActualizarOuvContactoDto,
  CrearOuvContactoDto,
} from '../dtos/ouv-contacto.dto';
import { OuvContacto } from '../models/ouv-contacto.model';
import { OuvInfluencia } from '../models/ouv-influencia.model';
import { Ouv } from '../models/ouv.model';
import { OuvResultado } from '../models/enums/ouv.enums';

@Injectable()
export class OuvContactosService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(OuvContacto)
    private readonly contactoModel: typeof OuvContacto,
    @InjectModel(OuvInfluencia)
    private readonly influenciaModel: typeof OuvInfluencia,
    private readonly demandGeneration: DemandGenerationService,
    private readonly workflowEngine: WorkflowEngineService,
  ) {}

  /**
   * Copy all active lead contacts into ouv_contactos (EARS-02).
   * Uses DemandGenerationService public API — no deep import of LeadContact.
   */
  async crearDesdeLead(
    ouvId: string,
    leadId: string,
    transaction: Transaction,
  ): Promise<OuvContacto[]> {
    const lead = await this.demandGeneration.findLeadById(leadId);
    const created: OuvContacto[] = [];

    for (const contact of lead.contacts ?? []) {
      const row = await this.contactoModel.create(
        {
          ouvId,
          nombre: contact.nombre,
          cargo: contact.cargo ?? null,
          email: contact.email || null,
          telefono: contact.telefono ?? null,
          notas: null,
        },
        { transaction },
      );
      created.push(row);
    }

    return created;
  }

  async listByOuv(ouvId: string): Promise<OuvContacto[]> {
    return this.contactoModel.findAll({
      where: { ouvId },
      order: [['nombre', 'ASC']],
    });
  }

  async crear(
    ouvId: string,
    dto: CrearOuvContactoDto,
    actorUserId: string,
  ): Promise<OuvContacto> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const ouv = await this.lockOwnedOuv(ouvId, actorUserId, transaction);

      const contacto = await this.contactoModel.create(
        {
          ouvId,
          nombre: dto.nombre.trim(),
          cargo: dto.cargo?.trim() || null,
          email: dto.email?.trim() || null,
          telefono: dto.telefono?.trim() || null,
          notas: dto.notas?.trim() || null,
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.contacto_creado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            contacto_ouv_id: contacto.contactoOuvId,
            nombre: contacto.nombre,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );

      return contacto;
    });
  }

  async actualizar(
    contactoOuvId: string,
    dto: ActualizarOuvContactoDto,
    actorUserId: string,
  ): Promise<OuvContacto> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const contacto = await this.contactoModel.findByPk(contactoOuvId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!contacto) {
        throw new NotFoundException(`Contacto OUV ${contactoOuvId} not found`);
      }

      await this.lockOwnedOuv(contacto.ouvId, actorUserId, transaction);

      await contacto.update(
        {
          ...(dto.nombre !== undefined
            ? { nombre: dto.nombre.trim() }
            : {}),
          ...(dto.cargo !== undefined
            ? { cargo: dto.cargo?.trim() || null }
            : {}),
          ...(dto.email !== undefined
            ? { email: dto.email?.trim() || null }
            : {}),
          ...(dto.telefono !== undefined
            ? { telefono: dto.telefono?.trim() || null }
            : {}),
          ...(dto.notas !== undefined
            ? { notas: dto.notas?.trim() || null }
            : {}),
        },
        { transaction },
      );

      return contacto;
    });
  }

  async eliminar(
    contactoOuvId: string,
    actorUserId: string,
  ): Promise<void> {
    return this.ouvModel.sequelize!.transaction(async (transaction) => {
      const contacto = await this.contactoModel.findByPk(contactoOuvId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!contacto) {
        throw new NotFoundException(`Contacto OUV ${contactoOuvId} not found`);
      }

      const ouv = await this.lockOwnedOuv(
        contacto.ouvId,
        actorUserId,
        transaction,
      );

      await this.influenciaModel.update(
        { contactoOuvId: null },
        {
          where: { contactoOuvId: contacto.contactoOuvId },
          transaction,
        },
      );

      await contacto.destroy({ transaction });

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        'ouv.contacto_eliminado',
        {
          estadoAnterior: ouv.zonaActual,
          estadoNuevo: ouv.zonaActual,
          entityLabel: ouv.consecutivo,
          actorUserId,
          payload: {
            comercial_id: ouv.comercialId,
            contacto_ouv_id: contactoOuvId,
            nombre: contacto.nombre,
          },
          entity: { estado: ouv.zonaActual },
        },
        transaction,
      );
    });
  }

  private async lockOwnedOuv(
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
        'Only the owning Ejecutivo Comercial can manage OUV contacts',
      );
    }
    if (ouv.resultado !== OuvResultado.EnCurso) {
      throw new BadRequestException(
        `Cannot modify contacts on a closed OUV (resultado=${ouv.resultado})`,
      );
    }
    return ouv;
  }
}
