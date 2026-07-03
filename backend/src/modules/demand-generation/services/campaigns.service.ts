import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, UniqueConstraintError, WhereOptions } from 'sequelize';
import { User } from '../../auth/models/user.model';
import { DEMAND_GENERATION_ERROR_CODES } from '../constants/demand-generation.constants';
import { CreateCampaignDto } from '../dtos/create-campaign.dto';
import {
  CampaignResponseDto,
  CampaignsQueryDto,
  PaginatedCampaignsResponseDto,
} from '../dtos/campaign-response.dto';
import { UpdateCampaignStatusDto } from '../dtos/update-campaign-status.dto';
import { CampaignEstado } from '../models/enums/campaign.enums';
import { Campaign } from '../models/campaign.model';

@Injectable()
export class CampaignsService {
  constructor(
    @InjectModel(Campaign) private readonly campaignModel: typeof Campaign,
    @InjectModel(User) private readonly userModel: typeof User,
  ) {}

  async create(dto: CreateCampaignDto): Promise<CampaignResponseDto> {
    await this.ensureUserExists(dto.responsable_id);

    try {
      const campaign = await this.campaignModel.create({
        nombre: dto.nombre.trim(),
        tipo: dto.tipo,
        canal: dto.canal.trim(),
        objetivo: dto.objetivo,
        segmentoObjetivo: dto.segmento_objetivo,
        responsableId: dto.responsable_id,
        fechaInicio: dto.fecha_inicio,
        fechaFin: dto.fecha_fin,
        presupuesto:
          dto.presupuesto !== undefined ? String(dto.presupuesto) : null,
        gastoReal: dto.gasto_real !== undefined ? String(dto.gasto_real) : null,
        estado: CampaignEstado.Borrador,
        leadsGenerados: 0,
        cpl: null,
      });

      return this.toResponseDto(campaign);
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new ConflictException({
          code: DEMAND_GENERATION_ERROR_CODES.DUPLICATE_CAMPAIGN_NAME,
          message: 'Campaign name already exists for this year',
        });
      }

      throw error;
    }
  }

  async findAll(
    query: CampaignsQueryDto,
  ): Promise<PaginatedCampaignsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;
    const where: WhereOptions<Campaign> = {};

    if (query.estado) {
      where.estado = query.estado;
    }

    if (query.tipo) {
      where.tipo = query.tipo;
    }

    if (query.from || query.to) {
      where.fechaInicio = {
        ...(query.from ? { [Op.gte]: query.from } : {}),
        ...(query.to ? { [Op.lte]: query.to } : {}),
      };
    }

    const { rows, count } = await this.campaignModel.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    return {
      items: rows.map((campaign) => this.toResponseDto(campaign)),
      total: count,
      page,
      limit,
    };
  }

  async updateStatus(
    campanaId: string,
    dto: UpdateCampaignStatusDto,
  ): Promise<CampaignResponseDto> {
    const campaign = await this.campaignModel.findByPk(campanaId);

    if (!campaign) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.NOT_FOUND,
        message: 'Campaign not found',
      });
    }

    await campaign.update({ estado: dto.estado });
    return this.toResponseDto(campaign);
  }

  async incrementLeadCount(campanaId: string): Promise<void> {
    const campaign = await this.campaignModel.findByPk(campanaId);

    if (!campaign) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.CAMPAIGN_NOT_FOUND,
        message: 'Campaign not found',
      });
    }

    const leadsGenerados = campaign.leadsGenerados + 1;
    const cpl = this.calculateCpl(campaign.gastoReal, leadsGenerados);

    await campaign.update({ leadsGenerados, cpl });
  }

  async findByIdOrFail(campanaId: string): Promise<Campaign> {
    const campaign = await this.campaignModel.findByPk(campanaId);

    if (!campaign) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.CAMPAIGN_NOT_FOUND,
        message: 'Campaign not found',
      });
    }

    return campaign;
  }

  /** DG-11: leads cannot be linked to Finalizada/Cancelada campaigns. */
  async assertCampaignAcceptsLeads(campanaId: string): Promise<Campaign> {
    const campaign = await this.findByIdOrFail(campanaId);

    if (
      campaign.estado === CampaignEstado.Finalizada ||
      campaign.estado === CampaignEstado.Cancelada
    ) {
      throw new ConflictException({
        code: DEMAND_GENERATION_ERROR_CODES.CAMPAIGN_CLOSED,
        message: `Campaign is ${campaign.estado}; new leads cannot be linked`,
      });
    }

    return campaign;
  }

  calculateCpl(
    gastoReal: string | null,
    leadsGenerados: number,
  ): string | null {
    if (!gastoReal || leadsGenerados <= 0) {
      return null;
    }

    const cost = Number(gastoReal) / leadsGenerados;
    return cost.toFixed(2);
  }

  private async ensureUserExists(userId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);

    if (!user) {
      throw new NotFoundException({
        code: DEMAND_GENERATION_ERROR_CODES.USER_NOT_FOUND,
        message: 'User not found',
      });
    }
  }

  private toResponseDto(campaign: Campaign): CampaignResponseDto {
    return {
      campana_id: campaign.campanaId,
      nombre: campaign.nombre,
      tipo: campaign.tipo,
      canal: campaign.canal,
      objetivo: campaign.objetivo,
      segmento_objetivo: campaign.segmentoObjetivo,
      responsable_id: campaign.responsableId,
      fecha_inicio: campaign.fechaInicio,
      fecha_fin: campaign.fechaFin,
      presupuesto: campaign.presupuesto,
      gasto_real: campaign.gastoReal,
      estado: campaign.estado,
      leads_generados: campaign.leadsGenerados,
      cpl: campaign.cpl,
      created_at: campaign.createdAt,
      updated_at: campaign.updatedAt,
    };
  }
}
