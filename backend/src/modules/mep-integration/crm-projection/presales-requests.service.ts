import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction, UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Ouv } from '../../discovery/models/ouv.model';
import { isSharePointDocumentUrl } from '../domain/deliverable-url';
import { resourceEtag } from '../domain/etag';
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
import { CreatePresalesRequestDto } from './dtos/create-presales-request.dto';
import {
  PresalesRequestView,
  presentPresalesRequest,
} from './presales-request.presenter';
import { COMBO_TO_SERVICES, PRIORITY_TO_HORIZON } from './presales-vocabulary';

/**
 * Solicitudes de preventa — §14 Fase 3 (T-301 … T-304).
 *
 * Esta es la cara **del CRM hacia su propia UI**: JWT + CASL, bajo `api/v1`.
 * No debe confundirse con la superficie `/v1` del contrato, que es
 * servidor-a-servidor y se autentica con la `X-API-Key` de MEP-LEAN (§5.1,
 * §10.3). Ambas leen las mismas tablas; ninguna llama a la otra.
 *
 * El CRM es la autoridad comercial (P-01): aquí se **crea** la interacción que
 * MEP luego recoge por `GET /v1/commercial-interactions`. MEP nunca la crea.
 */
@Injectable()
export class PresalesRequestsService {
  constructor(
    @InjectModel(Ouv) private readonly ouvModel: typeof Ouv,
    @InjectModel(CommercialInteraction)
    private readonly interactionModel: typeof CommercialInteraction,
    @InjectModel(InteractionRequestedService)
    private readonly requestedServiceModel: typeof InteractionRequestedService,
    @InjectModel(CommercialOpportunity)
    private readonly opportunityModel: typeof CommercialOpportunity,
    @InjectModel(MepResponse)
    private readonly responseModel: typeof MepResponse,
    @InjectModel(MepResponseVersion)
    private readonly versionModel: typeof MepResponseVersion,
    @InjectModel(ProcessingReceipt)
    private readonly receiptModel: typeof ProcessingReceipt,
    private readonly sequelize: Sequelize,
  ) {}

  /** Lista las solicitudes de preventa de una OUV, con su proyección MEP. */
  async listByOuv(ouvId: string): Promise<PresalesRequestView[]> {
    const ouv = await this.requireOuv(ouvId);

    const interactions = await this.interactionModel.findAll({
      where: { crmOpportunityRef: ouv.consecutivo },
      include: [InteractionRequestedService],
      order: [['source_created_at', 'DESC']],
    });

    return Promise.all(
      interactions.map((interaction) => this.project(interaction)),
    );
  }

  /** Detalle de una solicitud por su referencia de interacción. */
  async findByRef(
    ouvId: string,
    interactionRef: string,
  ): Promise<PresalesRequestView> {
    const ouv = await this.requireOuv(ouvId);

    const interaction = await this.interactionModel.findOne({
      where: {
        crmInteractionRef: interactionRef,
        crmOpportunityRef: ouv.consecutivo,
      },
      include: [InteractionRequestedService],
    });

    if (!interaction) {
      throw new NotFoundException({
        codigo_error: 'SOLICITUD_PREVENTA_NO_ENCONTRADA',
        detalle: 'La solicitud de preventa no existe para esta OUV.',
      });
    }

    return this.project(interaction);
  }

  /**
   * Crea la solicitud: el espejo de la OUV para el contexto de MEP y la
   * interacción comercial elegible para el pull.
   */
  async create(
    ouvId: string,
    payload: CreatePresalesRequestDto,
  ): Promise<PresalesRequestView> {
    const ouv = await this.requireOuv(ouvId);

    const horizon = PRIORITY_TO_HORIZON[payload.priority];
    const services = COMBO_TO_SERVICES[payload.service_combo];

    const interaction = await this.sequelize.transaction(
      async (transaction) => {
        await this.mirrorOpportunity(ouv, transaction);

        // La referencia es autoridad del CRM y debe ser estable y única. El
        // UNIQUE de `crm_interaction_ref` es el árbitro: si dos solicitudes
        // concurrentes calculan el mismo sufijo, una reintenta.
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const ref = await this.nextInteractionRef(
            ouv.consecutivo,
            transaction,
          );
          try {
            return await this.persist(
              ouv,
              ref,
              horizon,
              services,
              payload,
              transaction,
            );
          } catch (error) {
            if (!(error instanceof UniqueConstraintError)) {
              throw error;
            }
          }
        }

        throw new Error(
          'No fue posible asignar una referencia de interacción única.',
        );
      },
    );

    return this.project(interaction);
  }

  // ---------------------------------------------------------------- helpers

  private async requireOuv(ouvId: string): Promise<Ouv> {
    const ouv = await this.ouvModel.findByPk(ouvId);

    if (!ouv) {
      throw new NotFoundException({
        codigo_error: 'OUV_NO_ENCONTRADA',
        detalle: 'La oportunidad indicada no existe.',
      });
    }

    return ouv;
  }

  /**
   * Mantiene `commercial_opportunity` como espejo de la OUV, que es lo que MEP
   * lee por `GET /v1/commercial-opportunities/{ref}` (§6.3).
   *
   * INV-11: el arquetipo comercial es autoridad del CRM. Se proyecta desde el
   * segmento/vertical de la OUV y MEP no puede sobrescribirlo.
   * INV-09: los opcionales sin valor quedan en `null`, nunca en `""` ni `0`.
   */
  private async mirrorOpportunity(
    ouv: Ouv,
    transaction: Transaction,
  ): Promise<void> {
    const existing = await this.opportunityModel.findOne({
      where: { crmOpportunityRef: ouv.consecutivo },
      transaction,
    });

    const sourceVersion = String(
      (existing ? Number(existing.sourceVersion) : 0) + 1,
    );

    const values = {
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
      commercialOwnerName: null,
      archetypeRef: ouv.segmentId ?? null,
      archetypeName: ouv.segmento ?? null,
      sourceVersion,
      etag: resourceEtag(`ouv-${ouv.consecutivo}`, `v${sourceVersion}`),
      updatedAt: new Date(),
    };

    if (existing) {
      await this.opportunityModel.update(values, {
        where: { id: existing.id },
        transaction,
      });
      return;
    }

    await this.opportunityModel.create(values, { transaction });
  }

  private resolveSharePointUrl(raw: string | undefined): string | null {
    if (raw === undefined || raw === '') {
      return null;
    }
    if (!isSharePointDocumentUrl(raw)) {
      throw new BadRequestException({
        codigo_error: 'SHAREPOINT_DOCUMENT_URL_INVALIDA',
        detalle:
          'El link debe ser una URL HTTPS de SharePoint Documents, no un registro de Lista.',
      });
    }
    return raw;
  }

  /** `int_<consecutivo-de-ouv>_<n>` — legible y trazable en auditoría. */
  private async nextInteractionRef(
    opportunityRef: string,
    transaction: Transaction,
  ): Promise<string> {
    const used = await this.interactionModel.count({
      where: { crmOpportunityRef: opportunityRef },
      transaction,
    });

    const slug = opportunityRef.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return `int_${slug}_${used + 1}`;
  }

  private async persist(
    ouv: Ouv,
    interactionRef: string,
    horizon: (typeof PRIORITY_TO_HORIZON)[keyof typeof PRIORITY_TO_HORIZON],
    services: (typeof COMBO_TO_SERVICES)[keyof typeof COMBO_TO_SERVICES],
    payload: CreatePresalesRequestDto,
    transaction: Transaction,
  ): Promise<CommercialInteraction> {
    const now = new Date();

    const interaction = await this.interactionModel.create(
      {
        crmInteractionRef: interactionRef,
        crmOpportunityRef: ouv.consecutivo,
        serviceHorizon: horizon,
        subject: payload.subject ?? null,
        sharepointDocumentUrl: this.resolveSharePointUrl(
          payload.sharepoint_document_url,
        ),
        // P-07: se persiste tal cual llegó, sin trim ni normalización.
        sourceContent: payload.source_content,
        sourceCreatedAt: now,
        sourceVersion: '1',
        etag: resourceEtag(interactionRef, 'v1'),
        eligibleForMep: true,
      },
      { transaction },
    );

    const requested: InteractionRequestedService[] = [];

    for (const [position, service] of services.entries()) {
      requested.push(
        await this.requestedServiceModel.create(
          {
            interactionId: interaction.id,
            service: service.service,
            dependency: service.dependency,
            position,
          } as Partial<InteractionRequestedService>,
          { transaction },
        ),
      );
    }

    interaction.requestedServices = requested;
    return interaction;
  }

  /** Arma la vista comercial con las respuestas MEP y los acuses técnicos. */
  private async project(
    interaction: CommercialInteraction,
  ): Promise<PresalesRequestView> {
    const aggregate = await this.responseModel.findOne({
      where: { interactionId: interaction.id },
    });

    const versions = aggregate
      ? await this.versionModel.findAll({
          where: { mepResponseId: aggregate.id },
          include: [{ model: MepServiceResult, include: [MepDeliverable] }],
          order: [['response_version', 'DESC']],
        })
      : [];

    const receipts = await this.receiptModel.findAll({
      where: { interactionId: interaction.id },
      order: [['observed_at', 'DESC']],
    });

    return presentPresalesRequest(interaction, versions, receipts);
  }
}
