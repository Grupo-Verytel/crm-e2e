import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/sequelize';
import { Sequelize } from 'sequelize';
import { SYSTEM_USER_ID } from '../../audit/constants/system-user.constants';
import { Ouv } from '../../discovery/models/ouv.model';
import { OuvResultado } from '../../discovery/models/enums/ouv.enums';
import { OuvsService } from '../../discovery/services/ouvs.service';
import { EntityType } from '../../workflow-engine/enums/entity-type.enum';
import { WorkflowEngineService } from '../../workflow-engine/workflow-engine.service';
import {
  CreatePmoProjectDto,
  PmoCreateProjectPayload,
  PmoProjectCreatedDto,
} from '../dtos/create-pmo-project.dto';
import {
  ProjectExecutionDto,
  ProjectStateHistoryDto,
} from '../dtos/project-execution.dto';
import { StatusChangeAckDto, StatusChangeDto } from '../dtos/status-change.dto';
import { ProjectStatusEvent } from '../models/project-status-event.model';
import { PmoApiClient } from './pmo-api.client';

/** `notifications.estado_nuevo` is VARCHAR(40); the PMO vocabulary is free text. */
const ESTADO_MAX_LENGTH = 40;

/** `pro_project.PRO_CNAME` is VARCHAR(255). */
const PRO_CNAME_MAX_LENGTH = 255;

export const PROJECT_STATUS_CHANGED_EVENT = 'ouv.estado_proyecto_cambiado';

/**
 * Public service of the implementation module — PMO (Control Project) integration.
 * Write: opens the delivery project in the PMO once the OUV is won.
 * Pull: execution indicators and state history of that project.
 * Push: ingestion of the PMO webhook, which notifies the OUV's comercial.
 */
@Injectable()
export class ProjectExecutionService {
  constructor(
    @InjectConnection() private readonly sequelize: Sequelize,
    @InjectModel(ProjectStatusEvent)
    private readonly statusEventModel: typeof ProjectStatusEvent,
    private readonly ouvsService: OuvsService,
    private readonly workflowEngine: WorkflowEngineService,
    private readonly pmoApi: PmoApiClient,
  ) {}

  /**
   * Opens the delivery project in the PMO for a won OUV. Deliberately not wired
   * into `OuvsService.ganar()`: an outbound HTTP call inside that transaction
   * would let a PMO outage block the closing of the opportunity.
   */
  async createPmoProject(
    ouvId: string,
    dto: CreatePmoProjectDto,
  ): Promise<PmoProjectCreatedDto> {
    const ouv = await this.requireOuv(ouvId);

    if (ouv.resultado !== OuvResultado.Ganada) {
      throw new BadRequestException({
        code: 'OUV_NOT_WON',
        message: `OUV ${ouvId} is ${ouv.resultado}; only a Ganada OUV goes to the PMO`,
      });
    }

    if (new Date(dto.fechaFin) < new Date(dto.fechaInicio)) {
      throw new BadRequestException({
        code: 'INVALID_PROJECT_DATES',
        message: 'fechaFin cannot be earlier than fechaInicio',
      });
    }

    const { PRO_NCODE } = await this.pmoApi.createProject(
      this.toPmoPayload(ouv, dto),
    );

    return { ouvId: ouv.ouvId, projectId: PRO_NCODE };
  }

  /** Maps CRM vocabulary onto the PMO's own column names. */
  private toPmoPayload(
    ouv: Ouv,
    dto: CreatePmoProjectDto,
  ): PmoCreateProjectPayload {
    const contrato = dto.valorContrato ?? this.toNumber(ouv.montoFinal);

    const payload: PmoCreateProjectPayload = {
      PRO_CNAME: (dto.nombreProyecto ?? ouv.titulo).slice(
        0,
        PRO_CNAME_MAX_LENGTH,
      ),
      PRO_DASSIGNMENT: dto.fechaAsignacion ?? new Date().toISOString(),
      PRO_DSTART: dto.fechaInicio,
      PRO_DEND: dto.fechaFin,
      OUV_ID: ouv.ouvId,
    };

    // Omitted keys are omitted from the PMO INSERT too, so its column DEFAULTs apply.
    if (dto.tipoProyecto) payload.PRO_CPROJECT_TYPE = dto.tipoProyecto;
    if (dto.sharepointUrl) payload.PRO_CSHAREPOINT_URL = dto.sharepointUrl;
    if (contrato !== null) payload.N_CONTRACT_VALUE = contrato;
    if (dto.costosEsperados !== undefined) {
      payload.N_EXPECTED_TOTAL_COSTS = dto.costosEsperados;
    }

    return payload;
  }

  /** Sequelize returns DECIMAL columns as strings. */
  private toNumber(value: string | null): number | null {
    if (value === null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  async getExecution(ouvId: string): Promise<ProjectExecutionDto> {
    await this.requireOuv(ouvId);
    return this.pmoApi.getExecution(ouvId);
  }

  async getStateHistory(ouvId: string): Promise<ProjectStateHistoryDto> {
    await this.requireOuv(ouvId);
    return this.pmoApi.getStateHistory(ouvId);
  }

  /**
   * Ingest-only: the notification is recorded verbatim and the OUV's comercial is
   * alerted. Neither the status value nor the transition itself is validated.
   */
  async registerStatusChange(
    dto: StatusChangeDto,
  ): Promise<StatusChangeAckDto> {
    const ouv = await this.requireOuv(dto.referenceId);

    return this.sequelize.transaction(async (transaction) => {
      const alreadyIngested = await this.statusEventModel.findOne({
        where: { externalEventId: dto.externalEventId },
        transaction,
      });

      if (alreadyIngested) {
        return this.toAck(alreadyIngested, true);
      }

      const event = await this.statusEventModel.create(
        {
          ouvId: ouv.ouvId,
          externalEventId: dto.externalEventId,
          newStatus: dto.newStatus,
          occurredAt: new Date(dto.occurredAt),
          comment: dto.comment ?? null,
          receivedAt: new Date(),
        },
        { transaction },
      );

      await this.workflowEngine.transition(
        EntityType.OUV,
        ouv.ouvId,
        PROJECT_STATUS_CHANGED_EVENT,
        {
          estadoAnterior: null,
          estadoNuevo: dto.newStatus.slice(0, ESTADO_MAX_LENGTH),
          entityLabel: ouv.consecutivo,
          actorUserId: SYSTEM_USER_ID,
          payload: {
            comercial_id: ouv.comercialId,
            external_event_id: dto.externalEventId,
            new_status: dto.newStatus,
            occurred_at: dto.occurredAt,
            comment: dto.comment ?? null,
          },
        },
        transaction,
      );

      return this.toAck(event, false);
    });
  }

  private async requireOuv(ouvId: string): Promise<Ouv> {
    const ouv = await this.ouvsService.findById(ouvId);

    if (!ouv) {
      throw new NotFoundException({
        code: 'OUV_NOT_FOUND',
        message: `OUV ${ouvId} not found`,
      });
    }

    return ouv;
  }

  private toAck(
    event: ProjectStatusEvent,
    duplicate: boolean,
  ): StatusChangeAckDto {
    return {
      projectStatusEventId: event.projectStatusEventId,
      externalEventId: event.externalEventId,
      duplicate,
    };
  }
}
