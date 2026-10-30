import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { AuditFieldUpdate } from '../../audit/services/audit.service';
import { AuditService } from '../../audit/services/audit.service';
import type { AuthenticatedUser } from '../../auth/interfaces/authenticated-user.interface';
import { User } from '../../auth/models/user.model';
import type { StatusHistoryListItem } from '../../workflow-engine/services/status-history.service';
import { StatusHistoryService } from '../../workflow-engine/services/status-history.service';
import type { CommercialReportDetailsQueryDto } from '../dtos/commercial-report.dto';
import type {
  CommercialReportQueryDto,
  PipelineHealthQueryDto,
} from '../dtos/commercial-report.dto';
import { canReadAllOuvs } from '../lib/ouv-access';
import {
  COMMERCIAL_REPORT_AMOUNT_FIELDS,
  buildCommitteeReport,
  buildPipelineHealth,
  isSyntheticMetadata,
  listCommercialReportDetails,
  parseAuditAmount,
  reportOfKind,
  type CommercialReportAmountChange,
  type CommercialReportDetailItem,
  type CommercialReportHistory,
  type CommercialReportInput,
  type CommercialReportKind,
  type CommercialReportOuv,
  type CommitteeReport,
  type PipelineHealthReport,
} from '../lib/commercial-report-metrics';
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

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

@Injectable()
export class CommercialReportsService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly statusHistoryService: StatusHistoryService,
    private readonly auditService: AuditService,
  ) {}

  async getCommittee(
    query: CommercialReportQueryDto,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<CommitteeReport> {
    const input = await this.loadCommittee(query, user, now);
    return buildCommitteeReport(input);
  }

  async getPipelineHealth(
    query: PipelineHealthQueryDto,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<PipelineHealthReport> {
    const ouvs = await this.loadOuvs(query, user);
    return buildPipelineHealth({
      ouvs,
      history: [],
      amountChanges: [],
      period: {},
      now,
    });
  }

  async getDetails(
    query: CommercialReportDetailsQueryDto,
    user: AuthenticatedUser,
    now = new Date(),
  ): Promise<{
    kind: CommercialReportKind;
    items: CommercialReportDetailItem[];
    total: number;
    amount_total: number;
    ouv_count: number;
    ouv_amount: number;
    page: number;
    limit: number;
  }> {
    if (reportOfKind(query.kind) !== query.report) {
      throw new BadRequestException(
        'kind does not belong to the requested report',
      );
    }
    const input =
      query.report === 'committee'
        ? await this.loadCommittee(query, user, now)
        : {
            ouvs: await this.loadOuvs(query, user),
            history: [],
            amountChanges: [],
            period: {},
            now,
          };
    const listed = listCommercialReportDetails(input, query.kind, {
      fromEstado: query.from_estado?.trim() || undefined,
      toEstado: query.to_estado?.trim() || undefined,
      resultado: query.resultado,
    });
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const start = (page - 1) * limit;
    return {
      kind: query.kind,
      items: listed.items.slice(start, start + limit),
      total: listed.total,
      amount_total: listed.amount_total,
      ouv_count: listed.ouv_count,
      ouv_amount: listed.ouv_amount,
      page,
      limit,
    };
  }

  private async loadCommittee(
    query: CommercialReportQueryDto,
    user: AuthenticatedUser,
    now: Date,
  ): Promise<CommercialReportInput> {
    const ouvs = await this.loadOuvs(query, user);
    const ids = ouvs.map((ouv) => ouv.ouvId);
    const [historyRows, amountRows] = await Promise.all([
      this.statusHistoryService.listForEntities('OUV', ids),
      this.auditService.listFieldUpdates('ouvs', ids, [
        ...COMMERCIAL_REPORT_AMOUNT_FIELDS,
      ]),
    ]);
    const names = await this.loadNames([
      ...historyRows.map((row) => row.changedBy),
      ...amountRows.map((row) => row.usuarioId),
    ]);
    return {
      ouvs,
      history: historyRows.map((row) => this.toHistory(row, names)),
      amountChanges: amountRows.map((row) => this.toAmount(row, names)),
      period: {
        year: query.year,
        quarter: query.quarter,
        periodFrom: query.period_from,
        periodTo: query.period_to,
      },
      fechaCorte: query.fecha_corte,
      now,
    };
  }

  private async loadOuvs(
    query: { comercial_id?: string; segmento?: string },
    user: AuthenticatedUser,
  ): Promise<CommercialReportOuv[]> {
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
        'empresaNombre',
        'presupuestoMoneda',
        'monedaFinal',
        'expectedCloseDate',
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
    return ouvs.map((ouv) => this.toOuv(ouv));
  }

  private async loadNames(
    ids: Array<string | null | undefined>,
  ): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((id): id is string => !!id))];
    if (unique.length === 0) return new Map();
    const users = await this.userModel.findAll({
      where: { userId: { [Op.in]: unique } },
      attributes: ['userId', 'fullName'],
    });
    return new Map(users.map((user) => [user.userId, user.fullName]));
  }

  private toOuv(ouv: Ouv): CommercialReportOuv {
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
      empresaNombre: ouv.empresaNombre,
      presupuestoMoneda: ouv.presupuestoMoneda,
      monedaFinal: ouv.monedaFinal,
      expectedCloseDate: toDateOnly(ouv.expectedCloseDate),
    };
  }

  private toHistory(
    row: StatusHistoryListItem,
    names: Map<string, string>,
  ): CommercialReportHistory {
    return {
      historyId: row.historyId,
      ouvId: row.entityId,
      fromEstado: row.fromEstado,
      toEstado: row.toEstado,
      trigger: row.trigger,
      changedAt: toDate(row.changedAt) ?? new Date(0),
      changedBy: row.changedBy ? (names.get(row.changedBy) ?? null) : null,
      synthetic: isSyntheticMetadata(row.metadata),
    };
  }

  private toAmount(
    row: AuditFieldUpdate,
    names: Map<string, string>,
  ): CommercialReportAmountChange {
    return {
      auditId: row.auditId,
      ouvId: row.registroId,
      campo: row.campoModificado ?? '',
      previousAmount: parseAuditAmount(row.valorAnterior),
      newAmount: parseAuditAmount(row.valorNuevo),
      changedAt: toDate(row.timestamp) ?? new Date(0),
      changedBy: names.get(row.usuarioId) ?? null,
    };
  }
}
