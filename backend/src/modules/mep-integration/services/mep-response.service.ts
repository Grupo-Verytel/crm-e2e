import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { canonicalHash } from '../domain/canonical-json';
import { BusinessMilestone } from '../domain/enums';
import { etagMatches, resourceEtag } from '../domain/etag';
import { MepProblemException } from '../domain/mep-problem.exception';
import { PublishResponseDto } from '../dtos/publish-response.dto';
import {
  AuditOutcome,
  CommercialInteraction,
  MepDeliverable,
  MepResponse,
  MepResponseVersion,
  MepServiceResult,
} from '../models';
import {
  ResponseContract,
  presentResponseVersion,
} from '../presenters/contract.presenter';
import { ResponseSemanticValidator } from '../validation/response-semantic.validator';
import { IdempotencyService } from './idempotency.service';
import { MepAuditService } from './mep-audit.service';
import { MepWriteContext, MepWriteResult } from './write-result.interface';

/**
 * Respuesta comercial agregada — §6.5 y §6.6 (T-203 … T-208).
 *
 * **ETag del agregado.** Se calcula en vivo como
 * `"{response_id}-v{response_version}-{interaction.source_version}"`, de modo
 * que incorpora los dos relojes que pueden invalidar lo que MEP leyó: la
 * versión de la respuesta y la versión de origen de la interacción. Esto es lo
 * que hace verificable AC-27 / TS-CONC-02: si un usuario comercial edita la
 * interacción entre el `GET` y el `PUT` de MEP, `source_version` avanza, el
 * `If-Match` que MEP sostiene deja de coincidir y la escritura recibe `412`
 * sin mutar nada — la edición humana se conserva y MEP debe releer y
 * reconciliar. El mismo valor se devuelve en el `PUT` y en el `GET`, por lo
 * que INV-15 se cumple por construcción.
 *
 * **Relojes independientes (INV-17).** Este servicio no deriva jamás
 * `route_capacity.version` de `response_version` ni al revés: `rc_version` se
 * persiste tal como MEP lo publica, incluso cuando se queda en `V2` mientras
 * la versión 5 informa el cierre.
 */
@Injectable()
export class MepResponseService {
  constructor(
    @InjectModel(CommercialInteraction)
    private readonly interactionModel: typeof CommercialInteraction,
    @InjectModel(MepResponse)
    private readonly responseModel: typeof MepResponse,
    @InjectModel(MepResponseVersion)
    private readonly versionModel: typeof MepResponseVersion,
    @InjectModel(MepServiceResult)
    private readonly serviceResultModel: typeof MepServiceResult,
    @InjectModel(MepDeliverable)
    private readonly deliverableModel: typeof MepDeliverable,
    private readonly idempotency: IdempotencyService,
    private readonly validator: ResponseSemanticValidator,
    private readonly audit: MepAuditService,
    private readonly sequelize: Sequelize,
  ) {}

  // ---------------------------------------------------------------- publish

  async publish(
    interactionRef: string,
    routeResponseId: string,
    payload: PublishResponseDto,
    context: MepWriteContext,
  ): Promise<MepWriteResult> {
    const interaction = await this.interactionModel.findOne({
      where: { crmInteractionRef: interactionRef },
    });

    if (!interaction) {
      throw MepProblemException.notFound(
        'La interacción indicada no existe o no es visible para esta identidad.',
      );
    }

    const requestHash = canonicalHash(context.rawBody);

    const reservation = await this.idempotency.begin({
      apiKeyId: context.identity.apiKeyId,
      method: context.httpMethod,
      path: context.httpPath,
      idempotencyKey: context.idempotencyKey,
      requestHash,
    });

    // INV-29: el replay devuelve lo guardado sin ejecutar la lógica de
    // negocio, por eso `response_version` no avanza con un retry.
    if (reservation.kind === 'replay') {
      await this.auditReplay(context, interaction, payload, requestHash);
      return {
        status: reservation.status,
        body: reservation.body,
        etag: reservation.etag,
        replay: true,
      };
    }

    try {
      return await this.sequelize.transaction(
        { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
        async (transaction) => {
          // §9.2 — `SELECT … FOR UPDATE` sobre el agregado al publicar.
          const aggregate = await this.responseModel.findOne({
            where: { interactionId: interaction.id },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          const currentVersion = aggregate
            ? Number(aggregate.currentVersion)
            : null;

          const currentEtag = this.aggregateEtag(
            aggregate?.responseId ?? routeResponseId,
            currentVersion,
            interaction.sourceVersion,
          );

          // En la primera publicación todavía no existe un ETag de respuesta
          // que MEP haya podido leer, así que también se acepta el de la
          // interacción — el único recurso que sí leyó. Si un usuario comercial
          // editó la interacción entre ese GET y este PUT, ese ETag tampoco
          // coincide y la escritura recibe 412 (AC-27).
          const precondicionSatisfecha =
            !context.ifMatch ||
            etagMatches(context.ifMatch, currentEtag) ||
            (aggregate === null &&
              etagMatches(context.ifMatch, interaction.etag));

          if (!precondicionSatisfecha) {
            throw MepProblemException.preconditionFailed(
              'El `If-Match` está desactualizado; relea el recurso y reconcilie antes de reintentar.',
            );
          }

          const currentMilestone = aggregate
            ? await this.latestMilestone(aggregate.id, transaction)
            : null;

          // §9.3 — un mismo `(response_id, response_version)` con contenido
          // distinto es 409; el caso idéntico ya se resolvió como replay por
          // `Idempotency-Key`, y con clave nueva cae en la monotonía (422).
          if (aggregate) {
            const sameVersion = await this.versionModel.findOne({
              where: {
                mepResponseId: aggregate.id,
                responseVersion: payload.response_version,
              },
              transaction,
            });

            if (sameVersion && sameVersion.payloadHash !== requestHash) {
              throw MepProblemException.conflict(
                'VERSION_CONTENT_CONFLICT',
                'Ya existe esa `response_version` con contenido distinto.',
              );
            }
          }

          this.validator.validate(payload, {
            routeResponseId,
            rawBody: context.rawBody,
            existingResponseId: aggregate?.responseId ?? null,
            currentVersion,
            currentMilestone,
          });

          const beforeState = aggregate
            ? await this.readLatest(aggregate, transaction)
            : null;

          const etag = this.aggregateEtag(
            payload.response_id,
            payload.response_version,
            interaction.sourceVersion,
          );

          const persistedAggregate =
            aggregate ??
            (await this.responseModel.create(
              {
                interactionId: interaction.id,
                responseId: payload.response_id,
                currentVersion: payload.response_version,
                etag,
              } as Partial<MepResponse>,
              { transaction },
            ));

          const version = await this.writeVersion(
            persistedAggregate.id,
            payload,
            requestHash,
            etag,
            transaction,
          );

          if (aggregate) {
            await this.responseModel.update(
              { currentVersion: payload.response_version, etag },
              { where: { id: aggregate.id }, transaction },
            );
          }

          const body = presentResponseVersion(version, payload.response_id);

          // INV-32: auditoría en la misma transacción que la mutación.
          await this.audit.record(
            {
              correlationId: context.correlationId,
              requestId: context.requestId,
              actorIdentity: context.identity.identity,
              apiKeyPrefix: context.identity.keyPrefix,
              sourceIp: context.sourceIp,
              httpMethod: context.httpMethod,
              httpPath: context.httpPath,
              httpStatus: 200,
              operation: 'response.publish',
              resourceType: 'mep_response_version',
              resourceRef: `${payload.response_id}#${payload.response_version}`,
              interactionRef,
              opportunityRef: interaction.crmOpportunityRef,
              idempotencyKey: context.idempotencyKey,
              idempotentReplay: false,
              ifMatch: context.ifMatch,
              outcome: AuditOutcome.SUCCESS,
              requestHash,
              beforeState,
              afterState: body,
              latencyMs: Date.now() - context.startedAt,
            },
            transaction,
          );

          await this.idempotency.complete(
            reservation.recordId,
            { status: 200, body, etag },
            transaction,
          );

          return { status: 200, body, etag, replay: false };
        },
      );
    } catch (error) {
      await this.idempotency.release(reservation.recordId);

      if (error instanceof MepProblemException) {
        const status = error.getStatus();
        if (status === 422 || status === 409 || status === 412) {
          await this.auditRejection(
            context,
            interactionRef,
            payload,
            status,
            error.code,
          );
        }
      }

      throw error;
    }
  }

  // -------------------------------------------------------------------- get

  /**
   * §6.6 — verificación post-write.
   *
   * Sin `version` devuelve la última publicada; con `?version=n` devuelve esa
   * versión concreta del histórico inmutable (404 si no existe). INV-15: la
   * representación y el `ETag` son idénticos a los del `PUT`.
   */
  async read(
    interactionRef: string,
    responseId: string,
    version?: number,
  ): Promise<{ body: ResponseContract; etag: string }> {
    const interaction = await this.interactionModel.findOne({
      where: { crmInteractionRef: interactionRef },
    });

    if (!interaction) {
      throw MepProblemException.notFound('La interacción indicada no existe.');
    }

    const aggregate = await this.responseModel.findOne({
      where: { interactionId: interaction.id, responseId },
    });

    if (!aggregate) {
      throw MepProblemException.notFound(
        'No hay respuesta publicada con ese `response_id` para esta interacción.',
      );
    }

    const targetVersion = version ?? Number(aggregate.currentVersion);

    const row = await this.versionModel.findOne({
      where: {
        mepResponseId: aggregate.id,
        responseVersion: targetVersion,
      },
      include: [{ model: MepServiceResult, include: [MepDeliverable] }],
    });

    if (!row) {
      throw MepProblemException.notFound(
        `No existe la versión ${targetVersion} de esta respuesta.`,
      );
    }

    return {
      body: presentResponseVersion(row, aggregate.responseId),
      etag: this.aggregateEtag(
        aggregate.responseId,
        targetVersion,
        interaction.sourceVersion,
      ),
    };
  }

  // ---------------------------------------------------------------- helpers

  private aggregateEtag(
    responseId: string,
    version: number | null,
    sourceVersion: string,
  ): string {
    return resourceEtag(responseId, `${version ?? 0}-${sourceVersion}`);
  }

  private async latestMilestone(
    mepResponseId: string,
    transaction: Transaction,
  ): Promise<BusinessMilestone | null> {
    const latest = await this.versionModel.findOne({
      where: { mepResponseId },
      order: [['response_version', 'DESC']],
      transaction,
    });

    return latest ? latest.businessMilestone : null;
  }

  private async readLatest(
    aggregate: MepResponse,
    transaction: Transaction,
  ): Promise<ResponseContract | null> {
    const row = await this.versionModel.findOne({
      where: {
        mepResponseId: aggregate.id,
        responseVersion: aggregate.currentVersion,
      },
      include: [{ model: MepServiceResult, include: [MepDeliverable] }],
      transaction,
    });

    return row ? presentResponseVersion(row, aggregate.responseId) : null;
  }

  /**
   * Persiste una versión inmutable con sus servicios y entregables.
   * P-08: `narrative_note` guarda solo el texto de esta versión; no se
   * concatena con las anteriores ni se reescribe ninguna versión previa.
   */
  private async writeVersion(
    mepResponseId: string,
    payload: PublishResponseDto,
    payloadHash: string,
    etag: string,
    transaction: Transaction,
  ): Promise<MepResponseVersion> {
    const links = payload.operational_links ?? {};

    const version = await this.versionModel.create(
      {
        mepResponseId,
        responseVersion: payload.response_version,
        businessMilestone: payload.business_milestone,
        responseStatus: payload.response_status,
        etaDate: payload.eta_date ?? null,
        nextMilestone: payload.next_milestone ?? null,
        respondedAt: new Date(payload.responded_at),
        respondedByRef: payload.responded_by.ref,
        respondedByName: payload.responded_by.display_name,
        assignmentEngineerRef: payload.assignment?.engineer.ref ?? null,
        assignmentEngineerName:
          payload.assignment?.engineer.display_name ?? null,
        assignmentAssignedAt: payload.assignment
          ? new Date(payload.assignment.assigned_at)
          : null,
        rcVersion: payload.route_capacity?.version ?? null,
        rcRouteStatus: payload.route_capacity?.route_status ?? null,
        rcCapacityStatus: payload.route_capacity?.capacity_status ?? null,
        rcSummary: payload.route_capacity?.summary ?? null,
        rcRegisteredAt: payload.route_capacity
          ? new Date(payload.route_capacity.registered_at)
          : null,
        rcRegisteredByRef: payload.route_capacity?.registered_by.ref ?? null,
        rcRegisteredByName:
          payload.route_capacity?.registered_by.display_name ?? null,
        plannerInteractionUrl: links.planner_interaction_url ?? null,
        routeCapacityRegisterUrl: links.route_capacity_register_url ?? null,
        narrativeNote: payload.narrative_note,
        deliveredInteractionType: payload.delivered_interaction_type,
        semanticFingerprint: payload.semantic_fingerprint,
        payloadHash,
        etag,
      },
      { transaction },
    );

    const serviceResults: MepServiceResult[] = [];

    for (const [index, result] of payload.service_results.entries()) {
      const created = await this.serviceResultModel.create(
        {
          responseVersionId: version.id,
          service: result.service,
          status: result.status,
          outcome: result.outcome,
          dependency: result.dependency,
          summary: result.summary,
          reasonCode: result.reason_code,
          position: index,
        } as Partial<MepServiceResult>,
        { transaction },
      );

      const deliverables: MepDeliverable[] = [];

      for (const deliverable of result.deliverables) {
        deliverables.push(
          await this.deliverableModel.create(
            {
              serviceResultId: created.id,
              url: deliverable.url,
              label: deliverable.label ?? null,
              publishedAt: deliverable.published_at
                ? new Date(deliverable.published_at)
                : null,
            } as Partial<MepDeliverable>,
            { transaction },
          ),
        );
      }

      created.deliverables = deliverables;
      serviceResults.push(created);
    }

    version.serviceResults = serviceResults;
    return version;
  }

  private async auditReplay(
    context: MepWriteContext,
    interaction: CommercialInteraction,
    payload: PublishResponseDto,
    requestHash: string,
  ): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.audit.record(
        {
          correlationId: context.correlationId,
          requestId: context.requestId,
          actorIdentity: context.identity.identity,
          apiKeyPrefix: context.identity.keyPrefix,
          sourceIp: context.sourceIp,
          httpMethod: context.httpMethod,
          httpPath: context.httpPath,
          httpStatus: 200,
          operation: 'response.replay',
          resourceType: 'mep_response_version',
          resourceRef: `${payload.response_id}#${payload.response_version}`,
          interactionRef: interaction.crmInteractionRef,
          opportunityRef: interaction.crmOpportunityRef,
          idempotencyKey: context.idempotencyKey,
          idempotentReplay: true,
          ifMatch: context.ifMatch,
          outcome: AuditOutcome.SUCCESS,
          requestHash,
          latencyMs: Date.now() - context.startedAt,
        },
        transaction,
      );
    });
  }

  private async auditRejection(
    context: MepWriteContext,
    interactionRef: string,
    payload: PublishResponseDto,
    status: number,
    errorCode: string,
  ): Promise<void> {
    await this.sequelize.transaction(async (transaction) => {
      await this.audit.record(
        {
          correlationId: context.correlationId,
          requestId: context.requestId,
          actorIdentity: context.identity.identity,
          apiKeyPrefix: context.identity.keyPrefix,
          sourceIp: context.sourceIp,
          httpMethod: context.httpMethod,
          httpPath: context.httpPath,
          httpStatus: status,
          operation:
            status === 409
              ? 'response.conflict'
              : status === 412
                ? 'response.precondition_failed'
                : 'response.reject',
          resourceType: 'mep_response_version',
          resourceRef: `${payload.response_id}#${payload.response_version}`,
          interactionRef,
          idempotencyKey: context.idempotencyKey,
          ifMatch: context.ifMatch,
          outcome: AuditOutcome.REJECTED,
          errorCode,
          latencyMs: Date.now() - context.startedAt,
        },
        transaction,
      );
    });
  }
}
