import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
import { AccountsService } from '../../accounts/services/accounts.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import {
  DEMAND_GENERATION_ERROR_CODES,
  DEMAND_GENERATION_ROLES,
} from '../constants/demand-generation.constants';
import {
  allChecklistCriteriaMet,
  missingChecklistCriteria,
} from '../lib/checklist-result';
import { assertValidLeadTransition } from '../lib/lead-state-machine';
import { CanalOrigen, LeadEstado } from '../models/enums/lead.enums';
import { MqlEstado } from '../models/enums/mql.enums';
import { SqlOrigenCreacion } from '../models/enums/sql-origen.enum';
import { SqlEstado } from '../models/enums/sql.enums';
import { Segmento } from '../models/enums/segment.enum';
import { LeadContact } from '../models/lead-contact.model';
import { Lead } from '../models/lead.model';
import { LeadChecklist } from '../models/lead-checklist.model';
import { Mql } from '../models/mql.model';
import { Sql } from '../models/sql.model';
import {
  NOTIFICATION_PORT,
  NotificationEvent,
} from '../ports/notification.port';
import type { NotificationPort } from '../ports/notification.port';
import { InteractionsService } from './interactions.service';
import { LeadChecklistService } from './lead-checklist.service';

/**
 * Owns every LEAD state transition (spec §4). One explicit method per
 * transition so each validates its own preconditions and side effects.
 * Cross-tray handoffs (MQL approve → SQL) go through WorkflowEngineService.
 */
@Injectable()
export class LeadStateMachineService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
    @InjectModel(LeadContact)
    private readonly leadContactModel: typeof LeadContact,
    @InjectModel(Mql) private readonly mqlModel: typeof Mql,
    @InjectModel(Sql) private readonly sqlModel: typeof Sql,
    private readonly interactionsService: InteractionsService,
    private readonly checklistService: LeadChecklistService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly accountsService: AccountsService,
    @Inject(NOTIFICATION_PORT)
    private readonly notifications: NotificationPort,
  ) {}

  /** Automatic on lead registration: Nuevo → TOFU (DG-03). */
  async transitionToTofu(leadId: string): Promise<Lead> {
    const lead = await this.findLeadOrFail(leadId);

    if (lead.estado === LeadEstado.TOFU) {
      return lead;
    }

    assertValidLeadTransition(lead.estado, LeadEstado.TOFU);
    await lead.update({ estado: LeadEstado.TOFU });
    return lead;
  }

  /**
   * TOFU → MOFU. DG-12: at least one interaction AND the lead classified
   * (segmento, industria when B2B). Rejects with the explicit missing criterion.
   */
  // userId is part of the spec signature and captured centrally by the audit
  // hooks; kept for parity with the other transitions.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transitionToMofu(leadId: string, _userId: string): Promise<Lead> {
    const lead = await this.findLeadOrFail(leadId);

    if (lead.canalOrigen === CanalOrigen.Fabrica) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
        message: 'FABRICA leads skip MOFU and are evaluated directly in TOFU',
      });
    }

    assertValidLeadTransition(lead.estado, LeadEstado.MOFU);

    const missing: string[] = [];

    const interactionCount = await this.interactionsService.countByLead(leadId);
    if (interactionCount < 1) {
      missing.push('al menos 1 interacción registrada');
    }

    if (!lead.segmento) {
      missing.push('segmento');
    }

    if (lead.segmento === Segmento.B2B && !lead.industria?.trim()) {
      missing.push('industria (requerida para segmento B2B)');
    }

    if (missing.length > 0) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.TRANSITION_PRECONDITION_FAILED,
        message: `Cannot move lead to MOFU. Missing: ${missing.join(', ')}`,
        details: { missing },
      });
    }

    await lead.update({ estado: LeadEstado.MOFU });
    return lead;
  }

  /**
   * MOFU → MQL_PENDING. DG-13: the 4 checklist criteria must be true. Creates
   * (or reactivates) the MQL in Activo and notifies the Director de Mercadeo.
   */
  async transitionToMqlPending(
    leadId: string,
    checklistId: string,
    userId: string,
  ): Promise<{ lead: Lead; mql: Mql }> {
    const lead = await this.findLeadOrFail(leadId);

    if (
      lead.estado === LeadEstado.TOFU &&
      lead.canalOrigen !== CanalOrigen.Fabrica
    ) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
        message: 'Only FABRICA leads can transition directly from TOFU to BOFU',
      });
    }

    assertValidLeadTransition(
      lead.estado,
      LeadEstado.MqlPending,
      lead.canalOrigen,
    );

    const checklist = await this.checklistService.findByIdOrFail(checklistId);

    if (checklist.leadId !== leadId) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'The checklist does not belong to this lead',
      });
    }

    if (!allChecklistCriteriaMet(checklist)) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.CHECKLIST_INCOMPLETE,
        message: `Checklist incomplete. Pending criteria: ${missingChecklistCriteria(
          checklist,
        ).join(', ')}`,
        details: { missing: missingChecklistCriteria(checklist) },
      });
    }

    const mql = await this.upsertActiveMql(lead, checklist, userId);
    await lead.update({ estado: LeadEstado.MqlPending });

    const entityLabel = await this.getLeadDisplayLabel(lead);
    await this.notifications.notify({
      event: NotificationEvent.MqlPendingReview,
      recipientRole: DEMAND_GENERATION_ROLES.DIRECTOR_MERCADEO,
      message: `New MQL pending review for lead ${entityLabel}`,
      metadata: { leadId, mqlId: mql.mqlId },
    });

    return { lead, mql };
  }

  /**
   * Director approves the MQL: creates SQL in PendienteAsignacion (EARS-01 / DG-06),
   * lead → SQL, notifies Soporte via workflow engine (lead.mql_aprobado + sql.creado).
   */
  async approveMql(
    mqlId: string,
    userId: string,
    comentario?: string,
  ): Promise<{ mql: Mql; sql: Sql; lead: Lead }> {
    const mql = await this.findMqlOrFail(mqlId);
    this.assertMqlActive(mql);

    const lead = await this.findLeadOrFail(mql.leadId);
    const leadEstadoAnterior = lead.estado;

    return this.sequelize.transaction(async (transaction) => {
      const sql = await this.sqlModel.create(
        {
          mqlId: mql.mqlId,
          estado: SqlEstado.PendienteAsignacion,
          enBacklog: true,
          origenCreacion: SqlOrigenCreacion.EnrutamientoNormal,
        },
        { transaction },
      );

      await mql.update(
        {
          estado: MqlEstado.ConvertidoSQL,
          ...(comentario ? { motivoCalificacion: comentario } : {}),
        },
        { transaction },
      );
      await lead.update({ estado: LeadEstado.SQL }, { transaction });

      const entityLabel = await this.getLeadDisplayLabel(lead);
      const payload = {
        leadId: lead.leadId,
        mqlId: mql.mqlId,
        sqlId: sql.sqlId,
        ...(comentario ? { comentario } : {}),
      };

      await this.workflowEngine.transition(
        EntityType.LEAD,
        lead.leadId,
        'lead.mql_aprobado',
        {
          estadoAnterior: leadEstadoAnterior,
          estadoNuevo: LeadEstado.SQL,
          entityLabel,
          actorUserId: userId,
          payload,
          entity: { estado: leadEstadoAnterior },
        },
        transaction,
      );

      await this.workflowEngine.transition(
        EntityType.SQL,
        sql.sqlId,
        'sql.creado',
        {
          estadoAnterior: null,
          estadoNuevo: SqlEstado.PendienteAsignacion,
          entityLabel,
          actorUserId: userId,
          payload,
        },
        transaction,
      );

      return { mql, sql, lead };
    });
  }

  /**
   * Director rejects the MQL: motivo required (DG-07), lead → Reciclaje,
   * notify the responsible Gestor de Mercadeo.
   */
  async rejectMql(
    mqlId: string,
    _userId: string,
    motivo: string,
  ): Promise<{ mql: Mql; lead: Lead }> {
    if (!motivo?.trim()) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'motivo is required to reject an MQL',
      });
    }

    const mql = await this.findMqlOrFail(mqlId);
    this.assertMqlActive(mql);

    const lead = await this.findLeadOrFail(mql.leadId);

    await mql.update({
      estado: MqlEstado.Devuelto,
      motivoCalificacion: motivo,
    });
    await lead.update({ estado: LeadEstado.Reciclaje });

    const entityLabel = await this.getLeadDisplayLabel(lead);
    await this.notifications.notify({
      event: NotificationEvent.MqlRejected,
      recipientUserId: lead.responsableId,
      message: `MQL rejected for lead ${entityLabel}: ${motivo}`,
      metadata: { leadId: lead.leadId, mqlId: mql.mqlId },
    });

    return { mql, lead };
  }

  /** Discard a lead with a mandatory motivo (DG-14). */
  async discardLead(
    leadId: string,
    _userId: string,
    motivo: string,
  ): Promise<Lead> {
    if (!motivo?.trim()) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'motivo is required to discard a lead',
      });
    }

    const lead = await this.findLeadOrFail(leadId);

    if (lead.estado === LeadEstado.Descartado) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
        message: 'Lead is already discarded',
      });
    }

    if (lead.estado === LeadEstado.SQL) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.INVALID_TRANSITION,
        message: 'An SQL lead cannot be discarded from this module',
      });
    }

    const activeMql = await this.mqlModel.findOne({
      where: { leadId, estado: MqlEstado.Activo },
    });
    if (activeMql) {
      await activeMql.update({ estado: MqlEstado.Descartado });
    }

    await lead.update({
      estado: LeadEstado.Descartado,
      motivoDescarte: motivo,
    });

    return lead;
  }

  private async upsertActiveMql(
    lead: Lead,
    checklist: LeadChecklist,
    userId: string,
  ): Promise<Mql> {
    const existing = await this.mqlModel.findOne({
      where: { leadId: lead.leadId },
    });

    if (existing) {
      await existing.update({
        checklistId: checklist.checklistId,
        calificadoPor: userId,
        fechaCalificacion: new Date(),
        estado: MqlEstado.Activo,
      });
      return existing;
    }

    return this.mqlModel.create({
      leadId: lead.leadId,
      checklistId: checklist.checklistId,
      calificadoPor: userId,
      fechaCalificacion: new Date(),
      estado: MqlEstado.Activo,
    });
  }

  private assertMqlActive(mql: Mql): void {
    if (mql.estado !== MqlEstado.Activo) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.MQL_NOT_ACTIVE,
        message: `MQL is not in Activo state (current: ${mql.estado})`,
      });
    }
  }

  private async getLeadDisplayLabel(lead: Lead): Promise<string> {
    const contact = await this.leadContactModel.findOne({
      where: { leadId: lead.leadId },
      order: [['position', 'ASC']],
    });

    if (!contact) {
      return 'Lead';
    }

    const people = await this.accountsService.getPeopleWithAccounts([
      contact.personId,
    ]);
    const enriched = people.get(contact.personId);
    return enriched?.account_name ?? enriched?.name ?? 'Lead';
  }

  private async findLeadOrFail(leadId: string): Promise<Lead> {
    const lead = await this.leadModel.findByPk(leadId);

    if (!lead) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Lead not found',
      });
    }

    return lead;
  }

  private async findMqlOrFail(mqlId: string): Promise<Mql> {
    const mql = await this.mqlModel.findByPk(mqlId);

    if (!mql) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.MQL_NOT_FOUND,
        message: 'MQL not found',
      });
    }

    return mql;
  }
}
