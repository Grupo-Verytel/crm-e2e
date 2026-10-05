import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from '../../auth/models/user.model';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { OuvDashboardQueryDto } from '../dtos/ouv-dashboard.dto';
import { canReadAllOuvs } from '../lib/ouv-access';
import {
  buildOuvDashboard,
  type OuvDashboardMetrics,
  type OuvDashboardSourceRow,
} from '../lib/ouv-dashboard-metrics';
import { Ouv } from '../models/ouv.model';

function toNumber(value: string | null | undefined): number {
  if (value == null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

@Injectable()
export class OuvDashboardService {
  constructor(@InjectModel(Ouv) private readonly ouvModel: typeof Ouv) {}

  async getDashboard(
    query: OuvDashboardQueryDto,
    user: AuthenticatedUser,
  ): Promise<OuvDashboardMetrics> {
    const comercialId = canReadAllOuvs(user.roleName)
      ? query.comercial_id
      : user.userId;

    const ouvs = await this.ouvModel.findAll({
      where: {
        ...(comercialId ? { comercialId } : {}),
        ...(query.segmento ? { segmento: query.segmento } : {}),
      },
      attributes: [
        'ouvId',
        'consecutivo',
        'titulo',
        'comercialId',
        'segmento',
        'zonaActual',
        'resultado',
        'presupuestoMonto',
        'montoFinal',
        'montoEstimadoPerdido',
        'fechaCierre',
        'createdAt',
        'updatedAt',
        'origin',
        'origenVia',
        'motivoSnapshot',
      ],
      include: [
        {
          model: User,
          as: 'comercial',
          attributes: ['fullName'],
          required: false,
        },
      ],
    });

    return buildOuvDashboard(
      ouvs.map((ouv) => this.toRow(ouv)),
      {
        year: query.year,
        quarter: query.quarter,
        periodFrom: query.period_from,
        periodTo: query.period_to,
      },
      new Date(),
    );
  }

  private toRow(ouv: Ouv): OuvDashboardSourceRow {
    return {
      ouvId: ouv.ouvId,
      consecutivo: ouv.consecutivo,
      titulo: ouv.titulo,
      comercialId: ouv.comercialId,
      comercialName: ouv.comercial?.fullName ?? '',
      segmento: ouv.segmento,
      zonaActual: ouv.zonaActual,
      resultado: ouv.resultado,
      presupuestoMonto: toNumber(ouv.presupuestoMonto),
      montoFinal: toNumber(ouv.montoFinal),
      montoPerdido: toNumber(ouv.montoEstimadoPerdido),
      fechaCierre: toDate(ouv.fechaCierre),
      createdAt: toDate(ouv.createdAt) ?? new Date(0),
      updatedAt: toDate(ouv.updatedAt) ?? new Date(0),
      origin: ouv.origin,
      origenVia: ouv.origenVia,
      motivoSnapshot: ouv.motivoSnapshot,
    };
  }
}
