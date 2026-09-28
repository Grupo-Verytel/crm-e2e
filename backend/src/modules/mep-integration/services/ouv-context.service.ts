import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { User } from '../../auth/models/user.model';
import { Ouv } from '../../discovery/models/ouv.model';
import {
  applyOuvFieldsToCommercialOpportunity,
  ouvToOpportunityProjection,
} from '../domain/apply-ouv-to-commercial-opportunity';
import { resourceEtag } from '../domain/etag';
import { MepProblemException } from '../domain/mep-problem.exception';
import { ouvContextEtag } from '../domain/ouv-context-etag';
import {
  CommercialInteraction,
  CommercialOpportunity,
  InteractionRequestedService,
  MepDeliverable,
  MepResponse,
  MepResponseVersion,
  MepServiceResult,
  ProcessingReceipt,
} from '../models';
import {
  OpportunityContract,
  presentOpportunity,
} from '../presenters/contract.presenter';
import {
  PresalesRequestView,
  presentPresalesRequest,
} from '../crm-projection/presales-request.presenter';

export interface OuvContextBody {
  /** ETag de este agregado. Igual al header `ETag`. No se persiste. */
  etag: string;
  opportunity: OpportunityContract;
  mep_interactions: {
    items: PresalesRequestView[];
  };
}

interface HistoryClock {
  interactionCount: number;
  interactionClock: string;
  responseClock: string;
  receiptClock: string;
}

/**
 * Lectura contextual de una OUV para el conector externo.
 *
 * Solo SELECT. No actualiza la OUV, `commercial_opportunity`, versiones,
 * contadores ni el ETag persistido, y no escribe auditoría.
 * `{ouv_id}` es el consecutivo (`OUV-####`), el mismo identificador que
 * `crm_opportunity_ref`.
 */
@Injectable()
export class OuvContextService {
  constructor(
    @InjectModel(Ouv)
    private readonly ouvModel: typeof Ouv,
    @InjectModel(CommercialOpportunity)
    private readonly opportunityModel: typeof CommercialOpportunity,
    @InjectModel(CommercialInteraction)
    private readonly interactionModel: typeof CommercialInteraction,
    @InjectModel(MepResponse)
    private readonly responseModel: typeof MepResponse,
    @InjectModel(MepResponseVersion)
    private readonly versionModel: typeof MepResponseVersion,
    @InjectModel(ProcessingReceipt)
    private readonly receiptModel: typeof ProcessingReceipt,
    private readonly sequelize: Sequelize,
  ) {}

  async read(ouvRef: string): Promise<OuvContextBody> {
    const ouv = await this.ouvModel.findOne({
      where: { consecutivo: ouvRef },
      include: [
        {
          model: User,
          as: 'comercial',
          attributes: ['fullName'],
        },
      ],
    });

    if (!ouv) {
      throw MepProblemException.notFound(
        'La oportunidad indicada no existe o no es visible para esta identidad.',
      );
    }

    const stored = await this.opportunityModel.findOne({
      where: { crmOpportunityRef: ouv.consecutivo },
    });
    const opportunity = this.draftOpportunity(ouv, stored);
    const presented = presentOpportunity(opportunity);

    const rows = await this.interactionModel.findAll({
      where: { crmOpportunityRef: ouv.consecutivo },
      include: [InteractionRequestedService],
      order: [
        ['source_created_at', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    const clock = await this.historyClock(ouv.consecutivo);

    return {
      etag: ouvContextEtag({
        opportunityRef: ouv.consecutivo,
        opportunityEtag: presented.etag,
        interactionCount: clock.interactionCount,
        interactionClock: clock.interactionClock,
        responseClock: clock.responseClock,
        receiptClock: clock.receiptClock,
      }),
      opportunity: presented,
      mep_interactions: {
        items: await this.presentPage(rows),
      },
    };
  }

  /**
   * Copia de lectura. Si hay fila `commercial_opportunity`, conserva su
   * `source_version` y el resto de columnas de autoridad CRM, y superpone
   * en memoria los mismos campos que `OpportunityService.findByRef`.
   * Si no hay fila, proyecta desde `ouvs` con `source_version` `0` sin insertar.
   */
  private draftOpportunity(
    ouv: Ouv,
    stored: CommercialOpportunity | null,
  ): CommercialOpportunity {
    const projection = ouvToOpportunityProjection(ouv);
    const values = stored
      ? {
          crmOpportunityRef: stored.crmOpportunityRef,
          title: stored.title,
          organizationRef: stored.organizationRef,
          organizationName: stored.organizationName,
          commercialAmount: stored.commercialAmount,
          commercialCurrency: stored.commercialCurrency,
          stageRef: stored.stageRef,
          stageName: stored.stageName,
          status: stored.status,
          expectedCloseDate: stored.expectedCloseDate,
          commercialOwnerRef: stored.commercialOwnerRef,
          commercialOwnerName: stored.commercialOwnerName,
          archetypeRef: stored.archetypeRef,
          archetypeName: stored.archetypeName,
          sourceVersion: stored.sourceVersion,
          etag: stored.etag,
        }
      : {
          crmOpportunityRef: ouv.consecutivo,
          title: ouv.titulo,
          organizationRef: ouv.accountId,
          organizationName: ouv.empresaNombre,
          commercialAmount: ouv.presupuestoMonto,
          commercialCurrency: ouv.presupuestoMoneda,
          stageRef: ouv.zonaActual,
          stageName: ouv.zonaActual,
          status: null,
          expectedCloseDate: null,
          commercialOwnerRef: ouv.comercialId,
          commercialOwnerName: projection.commercialOwnerDisplayName,
          archetypeRef: ouv.segmentId ?? null,
          archetypeName: ouv.segmento ?? null,
          sourceVersion: '0',
          etag: resourceEtag(`ouv-${ouv.consecutivo}`, 'v0'),
        };

    const draft = this.opportunityModel.build(values);
    applyOuvFieldsToCommercialOpportunity(draft, projection);
    return draft;
  }

  private async presentPage(
    rows: CommercialInteraction[],
  ): Promise<PresalesRequestView[]> {
    if (rows.length === 0) {
      return [];
    }

    const interactionIds = rows.map((row) => row.id);
    const responses = await this.responseModel.findAll({
      where: { interactionId: interactionIds },
    });
    const responseIds = responses.map((response) => response.id);
    const versions =
      responseIds.length === 0
        ? []
        : await this.versionModel.findAll({
            where: { mepResponseId: responseIds },
            include: [{ model: MepServiceResult, include: [MepDeliverable] }],
          });
    const receipts = await this.receiptModel.findAll({
      where: { interactionId: interactionIds },
    });

    const responseByInteraction = new Map(
      responses.map((response) => [String(response.interactionId), response]),
    );
    const versionsByResponse = new Map<string, MepResponseVersion[]>();
    for (const version of versions) {
      const key = String(version.mepResponseId);
      const bucket = versionsByResponse.get(key) ?? [];
      bucket.push(version);
      versionsByResponse.set(key, bucket);
    }
    const receiptsByInteraction = new Map<string, ProcessingReceipt[]>();
    for (const receipt of receipts) {
      const key = String(receipt.interactionId);
      const bucket = receiptsByInteraction.get(key) ?? [];
      bucket.push(receipt);
      receiptsByInteraction.set(key, bucket);
    }

    return rows.map((row) => {
      const response = responseByInteraction.get(String(row.id));
      const history = response
        ? (versionsByResponse.get(String(response.id)) ?? [])
        : [];
      return presentPresalesRequest(
        row,
        history,
        receiptsByInteraction.get(String(row.id)) ?? [],
      );
    });
  }

  private async historyClock(opportunityRef: string): Promise<HistoryClock> {
    const rows = await this.sequelize.query<{
      interaction_count: number | string;
      interaction_clock: Date | string | null;
      response_clock: Date | string | null;
      receipt_clock: Date | string | null;
    }>(
      `
        SELECT
          (SELECT COUNT(*) FROM commercial_interaction
            WHERE crm_opportunity_ref = :ref) AS interaction_count,
          (SELECT MAX(updated_at) FROM commercial_interaction
            WHERE crm_opportunity_ref = :ref) AS interaction_clock,
          (SELECT MAX(v.created_at)
            FROM mep_response_version v
            INNER JOIN mep_response r ON r.id = v.mep_response_id
            INNER JOIN commercial_interaction ci ON ci.id = r.interaction_id
            WHERE ci.crm_opportunity_ref = :ref) AS response_clock,
          (SELECT MAX(pr.created_at)
            FROM processing_receipt pr
            INNER JOIN commercial_interaction ci ON ci.id = pr.interaction_id
            WHERE ci.crm_opportunity_ref = :ref) AS receipt_clock
      `,
      { replacements: { ref: opportunityRef }, type: QueryTypes.SELECT },
    );
    const row = rows[0];

    return {
      interactionCount: Number(row?.interaction_count ?? 0),
      interactionClock: clockToken(row?.interaction_clock),
      responseClock: clockToken(row?.response_clock),
      receiptClock: clockToken(row?.receipt_clock),
    };
  }

}

function clockToken(value: Date | string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'none';
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return String(value);
}
