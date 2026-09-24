import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, Sequelize, type Transaction } from 'sequelize';
import { Role } from '../../auth/models/role.model';
import { User } from '../../auth/models/user.model';
import {
  DEMAND_GENERATION_ERROR_CODES,
  INTERACTION_MAX_BACKDATE_HOURS,
} from '../constants/demand-generation.constants';
import { CreateInteractionDto } from '../dtos/create-interaction.dto';
import { InteractionResponseDto } from '../dtos/interaction-response.dto';
import { isCanalAllowedForTipo } from '../models/enums/interaction.enums';
import { Interaction } from '../models/interaction.model';
import { Lead } from '../models/lead.model';

const RESPONSABLE_INCLUDE = {
  model: User,
  as: 'responsable',
  attributes: ['userId', 'fullName'],
  include: [{ model: Role, attributes: ['name'] }],
};

@Injectable()
export class InteractionsService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(Interaction)
    private readonly interactionModel: typeof Interaction,
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
  ) {}

  /**
   * Register an interaction for a lead and refresh its
   * `fecha_ultima_interaccion` (DG-04).
   * Does not evaluate lead/MQL state transitions.
   * Not transactional: the lead path is left unchanged (A2).
   */
  async create(
    leadId: string,
    dto: CreateInteractionDto,
    responsableId: string,
  ): Promise<InteractionResponseDto> {
    const lead = await this.findLeadOrFail(leadId);
    this.assertCanal(dto);

    const fecha = this.resolveFecha(dto);

    const interaction = await this.interactionModel.create({
      leadId,
      tipo: dto.tipo,
      canal: dto.canal,
      subtipo: dto.subtipo ?? null,
      descripcion: dto.descripcion ?? null,
      resultado: dto.resultado ?? null,
      campanaId: dto.campana_id ?? null,
      responsableId,
      fecha,
    });

    await lead.update({ fechaUltimaInteraccion: fecha });

    return this.toResponseDto(interaction);
  }

  /**
   * SQL detail registration. Inserts the interaction and updates
   * `leads.fecha_ultima_interaccion` in one transaction.
   * Does not change `leads.estado` or `mqls.estado`.
   * `leadId` is the id already derived from the SQL chain by the caller.
   */
  async createForSql(
    leadId: string,
    sqlId: string,
    dto: CreateInteractionDto,
    responsableId: string,
  ): Promise<InteractionResponseDto> {
    this.assertCanal(dto);
    const fecha = this.resolveFecha(dto);

    return this.sequelize.transaction(async (transaction) => {
      const lead = await this.findLeadOrFail(leadId, transaction);

      const interaction = await this.interactionModel.create(
        {
          leadId,
          sqlId,
          tipo: dto.tipo,
          canal: dto.canal,
          subtipo: dto.subtipo ?? null,
          descripcion: dto.descripcion ?? null,
          resultado: dto.resultado ?? null,
          campanaId: dto.campana_id ?? null,
          responsableId,
          fecha,
        },
        { transaction },
      );

      await lead.update({ fechaUltimaInteraccion: fecha }, { transaction });

      const loaded = await this.interactionModel.findByPk(interaction.interactionId, {
        include: [RESPONSABLE_INCLUDE],
        transaction,
      });

      return this.toResponseDto(loaded ?? interaction);
    });
  }

  async listByLead(leadId: string): Promise<InteractionResponseDto[]> {
    await this.findLeadOrFail(leadId);

    const interactions = await this.interactionModel.findAll({
      where: { leadId },
      include: [RESPONSABLE_INCLUDE],
      order: [['fecha', 'DESC']],
    });

    return interactions.map((interaction) => this.toResponseDto(interaction));
  }

  async countByLead(leadId: string): Promise<number> {
    return this.interactionModel.count({ where: { leadId } });
  }

  /** One grouped query for the lead ids of a single list page. */
  async countByLeadIds(leadIds: string[]): Promise<Record<string, number>> {
    const uniqueIds = [...new Set(leadIds)];
    if (uniqueIds.length === 0) {
      return {};
    }

    const rows = await this.interactionModel.findAll({
      attributes: ['leadId', [fn('COUNT', col('interaction_id')), 'total']],
      where: { leadId: { [Op.in]: uniqueIds } },
      group: ['leadId'],
      raw: true,
    });

    const counts: Record<string, number> = {};
    for (const row of rows as unknown as Array<Record<string, unknown>>) {
      const leadId = String(row.leadId ?? row.lead_id ?? '');
      if (!leadId) {
        continue;
      }
      counts[leadId] = Number(row.total ?? 0);
    }
    return counts;
  }

  private resolveFecha(dto: CreateInteractionDto): Date {
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();
    const now = Date.now();
    const oldest =
      now - INTERACTION_MAX_BACKDATE_HOURS * 60 * 60 * 1000;

    if (fecha.getTime() < oldest) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.INTERACTION_DATE_TOO_OLD,
        message: `Interaction date cannot be more than ${INTERACTION_MAX_BACKDATE_HOURS} hours before registration`,
      });
    }

    if (fecha.getTime() > now) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: 'Interaction date cannot be in the future',
      });
    }

    return fecha;
  }

  private assertCanal(dto: CreateInteractionDto): void {
    if (!isCanalAllowedForTipo(dto.tipo, dto.canal)) {
      throw new BadRequestException({
        code: DEMAND_GENERATION_ERROR_CODES.VALIDATION_ERROR,
        message: `Canal ${dto.canal} is not valid for interaction type ${dto.tipo}`,
      });
    }
  }

  private async findLeadOrFail(
    leadId: string,
    transaction?: Transaction,
  ): Promise<Lead> {
    const lead = await this.leadModel.findByPk(leadId, { transaction });

    if (!lead) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Lead not found',
      });
    }

    return lead;
  }

  private toResponseDto(interaction: Interaction): InteractionResponseDto {
    const responsable = interaction.responsable;
    return {
      interaction_id: interaction.interactionId,
      lead_id: interaction.leadId,
      sql_id: interaction.sqlId ?? null,
      etapa: interaction.sqlId ? 'SQL' : 'Previa',
      tipo: interaction.tipo,
      subtipo: interaction.subtipo,
      canal: interaction.canal,
      descripcion: interaction.descripcion,
      resultado: interaction.resultado,
      campana_id: interaction.campanaId,
      responsable_id: interaction.responsableId,
      responsable_nombre: responsable?.fullName ?? null,
      responsable_rol: responsable?.role?.name ?? null,
      fecha: interaction.fecha,
      created_at: interaction.createdAt,
      updated_at: interaction.updatedAt,
    };
  }
}
