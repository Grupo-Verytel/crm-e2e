import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import { CreateInteractionDto } from '../dtos/create-interaction.dto';
import { InteractionResponseDto } from '../dtos/interaction-response.dto';
import { Interaction } from '../models/interaction.model';
import { Lead } from '../models/lead.model';

@Injectable()
export class InteractionsService {
  constructor(
    @InjectModel(Interaction)
    private readonly interactionModel: typeof Interaction,
    @InjectModel(Lead) private readonly leadModel: typeof Lead,
  ) {}

  /**
   * Register an interaction for a lead and refresh its
   * `fecha_ultima_interaccion` (DG-04).
   */
  async create(
    leadId: string,
    dto: CreateInteractionDto,
    responsableId: string,
  ): Promise<InteractionResponseDto> {
    const lead = await this.findLeadOrFail(leadId);
    const fecha = dto.fecha ? new Date(dto.fecha) : new Date();

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

  async listByLead(leadId: string): Promise<InteractionResponseDto[]> {
    await this.findLeadOrFail(leadId);

    const interactions = await this.interactionModel.findAll({
      where: { leadId },
      order: [['fecha', 'DESC']],
    });

    return interactions.map((interaction) => this.toResponseDto(interaction));
  }

  async countByLead(leadId: string): Promise<number> {
    return this.interactionModel.count({ where: { leadId } });
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

  private toResponseDto(interaction: Interaction): InteractionResponseDto {
    return {
      interaction_id: interaction.interactionId,
      lead_id: interaction.leadId,
      tipo: interaction.tipo,
      subtipo: interaction.subtipo,
      canal: interaction.canal,
      descripcion: interaction.descripcion,
      resultado: interaction.resultado,
      campana_id: interaction.campanaId,
      responsable_id: interaction.responsableId,
      fecha: interaction.fecha,
      created_at: interaction.createdAt,
      updated_at: interaction.updatedAt,
    };
  }
}
