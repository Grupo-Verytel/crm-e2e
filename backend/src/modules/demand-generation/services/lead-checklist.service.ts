import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import { ChecklistResponseDto } from '../dtos/checklist-response.dto';
import { UpdateChecklistDto } from '../dtos/update-checklist.dto';
import { computeChecklistResult } from '../lib/checklist-result';
import { CanalOrigen, LeadEstado } from '../models/enums/lead.enums';
import { LeadChecklist } from '../models/lead-checklist.model';
import { Lead } from '../models/lead.model';

@Injectable()
export class LeadChecklistService {
  constructor(
    @InjectModel(LeadChecklist)
    private readonly checklistModel: typeof LeadChecklist,
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
  ) {}

  /**
   * Upsert the qualification checklist for a lead. Editable only while the lead
   * is MOFU (DG-09); once MQL_PENDING it is read-only for the Gestor (DG-10).
   * `resultado` is recomputed here on every write (never in the DB).
   */
  async upsert(
    leadId: string,
    dto: UpdateChecklistDto,
    userId: string,
  ): Promise<ChecklistResponseDto> {
    const lead = await this.findLeadOrFail(leadId);

    if (lead.estado === LeadEstado.MqlPending) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.LEAD_LOCKED,
        message:
          'The checklist is read-only while the lead is MQL_PENDING (awaiting Director decision)',
      });
    }

    const isFabricaInTofu =
      lead.canalOrigen === CanalOrigen.Fabrica &&
      lead.estado === LeadEstado.TOFU;

    if (lead.estado !== LeadEstado.MOFU && !isFabricaInTofu) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.TRANSITION_PRECONDITION_FAILED,
        message:
          'The checklist can only be edited in MOFU, or in TOFU for FABRICA leads',
      });
    }

    const existing = await this.checklistModel.findOne({
      where: { leadId },
      order: [['createdAt', 'DESC']],
    });

    const criteria = {
      criterioSectorObjetivo:
        dto.criterio_sector_objetivo ??
        existing?.criterioSectorObjetivo ??
        false,
      criterioNecesidadPortafolio:
        dto.criterio_necesidad_portafolio ??
        existing?.criterioNecesidadPortafolio ??
        false,
      criterioAccesoDecisor:
        dto.criterio_acceso_decisor ?? existing?.criterioAccesoDecisor ?? false,
      criterioPresupuestoIndicios:
        dto.criterio_presupuesto_indicios ??
        existing?.criterioPresupuestoIndicios ??
        false,
    };

    const resultado = computeChecklistResult(criteria);

    if (existing) {
      await existing.update({
        ...criteria,
        resultado,
        completadoPor: userId,
        fechaCompletado: new Date(),
      });
      return this.toResponseDto(existing);
    }

    const created = await this.checklistModel.create({
      leadId,
      ...criteria,
      resultado,
      completadoPor: userId,
      fechaCompletado: new Date(),
    });

    return this.toResponseDto(created);
  }

  async findByLead(leadId: string): Promise<ChecklistResponseDto | null> {
    const checklist = await this.checklistModel.findOne({
      where: { leadId },
      order: [['createdAt', 'DESC']],
    });

    return checklist ? this.toResponseDto(checklist) : null;
  }

  async findLatestOrFail(leadId: string): Promise<LeadChecklist> {
    const checklist = await this.checklistModel.findOne({
      where: { leadId },
      order: [['createdAt', 'DESC']],
    });

    if (!checklist) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.CHECKLIST_NOT_FOUND,
        message: 'No checklist found for this lead',
      });
    }

    return checklist;
  }

  async findByIdOrFail(checklistId: string): Promise<LeadChecklist> {
    const checklist = await this.checklistModel.findByPk(checklistId);

    if (!checklist) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.CHECKLIST_NOT_FOUND,
        message: 'Checklist not found',
      });
    }

    return checklist;
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

  toResponseDto(checklist: LeadChecklist): ChecklistResponseDto {
    return {
      checklist_id: checklist.checklistId,
      lead_id: checklist.leadId,
      criterio_sector_objetivo: checklist.criterioSectorObjetivo,
      criterio_necesidad_portafolio: checklist.criterioNecesidadPortafolio,
      criterio_acceso_decisor: checklist.criterioAccesoDecisor,
      criterio_presupuesto_indicios: checklist.criterioPresupuestoIndicios,
      resultado: checklist.resultado,
      completado_por: checklist.completadoPor,
      fecha_completado: checklist.fechaCompletado,
      created_at: checklist.createdAt,
      updated_at: checklist.updatedAt,
    };
  }
}
