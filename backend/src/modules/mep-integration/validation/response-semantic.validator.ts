import { Injectable } from '@nestjs/common';
import { MepErrorCode, ProblemErrorItem } from '../constants/error-catalog';
import {
  BusinessMilestone,
  ServiceOutcome,
  ServiceResultStatus,
} from '../domain/enums';
import { isSharePointDocumentUrl, isHttpsUrl } from '../domain/deliverable-url';
import { MepProblemException } from '../domain/mep-problem.exception';
import {
  isRegression,
  requiredResponseStatus,
  requiresAssignment,
  requiresRouteCapacity,
} from '../domain/milestone-machine';
import { isDependencyAllowed } from '../domain/service-dependency';
import { PublishResponseDto } from '../dtos/publish-response.dto';
import { findForbiddenProperties } from './forbidden-properties';

/** Valor provisional prohibido al cierre (§7.4 INV-18, TS-CLS-02). */
export const PROVISIONAL_CLASSIFICATION_VALUE = 'TIPO-POR-ESPECIFICAR';

export interface ResponseValidationContext {
  /** `{response_id}` tal como viene en la ruta. */
  routeResponseId: string;
  /** Body crudo, antes del pipe — para el barrido de §7.4. */
  rawBody: unknown;
  /** `response_id` ya asociado a esta interacción, o `null` si es el primero. */
  existingResponseId: string | null;
  /** `current_version` persistida, o `null` si aún no hay ninguna. */
  currentVersion: number | null;
  /** Hito de la última versión persistida, o `null`. */
  currentMilestone: BusinessMilestone | null;
}

interface Violation {
  code: MepErrorCode;
  pointer: string;
  detail: string;
}

/**
 * Orden de precedencia del `code` de la respuesta 422 cuando concurren varias
 * violaciones. Todas las violaciones detectadas viajan en `errors[]`; el `code`
 * de nivel superior es el de mayor precedencia (menor índice).
 */
const CODE_PRECEDENCE: MepErrorCode[] = [
  'UNKNOWN_PROPERTY',
  'RESPONSE_ID_MISMATCH',
  'RESPONSE_ID_NOT_STABLE',
  'NON_MONOTONIC_VERSION',
  'INTERACTION_ALREADY_COMPLETED',
  'MILESTONE_REGRESSION',
  'INVERTED_SERVICE_DEPENDENCY',
  'DUPLICATE_SERVICE',
  'INVALID_SERVICE_OUTCOME',
  'MISSING_REASON_CODE',
  'DELIVERABLE_NOT_A_DOCUMENT',
  'INSECURE_URL',
  'INVALID_RESPONSE_STATUS',
  'MILESTONE_REQUIREMENTS_NOT_MET',
  'PREMATURE_CLASSIFICATION',
  'PROVISIONAL_CLASSIFICATION',
  'MISSING_CLASSIFICATION',
];

/**
 * Validador semántico de `PUT .../responses/{response_id}` — §7 y §9.3.
 *
 * Cubre INV-01/INV-16/INV-17/INV-20/INV-22/INV-23/INV-24/INV-25/INV-26/INV-27.
 * Todo lo que aquí falla es **422**: el spec exige error explícito, nunca
 * corrección automática (P-10).
 */
@Injectable()
export class ResponseSemanticValidator {
  validate(
    payload: PublishResponseDto,
    context: ResponseValidationContext,
  ): void {
    const violations: Violation[] = [];

    this.checkForbiddenProperties(context.rawBody, violations);
    this.checkIdentity(payload, context, violations);
    this.checkVersionMonotonicity(payload, context, violations);
    this.checkMilestoneMachine(payload, context, violations);
    this.checkResponseStatus(payload, violations);
    this.checkMilestoneRequirements(payload, violations);
    this.checkServiceResults(payload, violations);
    this.checkOperationalLinks(payload, violations);
    this.checkClassification(payload, violations);

    if (violations.length === 0) {
      return;
    }

    throw this.toProblem(violations);
  }

  /** §7.4 — lista negra de nombres, en cualquier nivel de anidamiento. */
  private checkForbiddenProperties(rawBody: unknown, out: Violation[]): void {
    for (const finding of findForbiddenProperties(rawBody)) {
      out.push({
        code: 'UNKNOWN_PROPERTY',
        pointer: finding.pointer,
        detail: 'Propiedad fuera del contrato: frontera LEAN (§7.4).',
      });
    }
  }

  /** INV-26 / §9.3 — identidad estable del agregado. */
  private checkIdentity(
    payload: PublishResponseDto,
    context: ResponseValidationContext,
    out: Violation[],
  ): void {
    if (payload.response_id !== context.routeResponseId) {
      out.push({
        code: 'RESPONSE_ID_MISMATCH',
        pointer: '/response_id',
        detail: 'El `response_id` del body no coincide con el de la ruta.',
      });
    }

    if (
      context.existingResponseId !== null &&
      context.existingResponseId !== payload.response_id
    ) {
      out.push({
        code: 'RESPONSE_ID_NOT_STABLE',
        pointer: '/response_id',
        detail:
          'La interacción ya tiene un `response_id` estable distinto; no puede cambiar entre hitos.',
      });
    }
  }

  /**
   * §9.3 — `response_version` monotónica estricta por `response_id`.
   *
   * OPEN-02 abierto: se implementa **monotónica creciente, no necesariamente
   * consecutiva** (TS-VER-04 acepta el salto 2 → 7). Cerrar OPEN-02 hacia
   * "consecutiva" solo exige endurecer esta comparación.
   */
  private checkVersionMonotonicity(
    payload: PublishResponseDto,
    context: ResponseValidationContext,
    out: Violation[],
  ): void {
    if (
      context.currentVersion !== null &&
      payload.response_version <= context.currentVersion
    ) {
      out.push({
        code: 'NON_MONOTONIC_VERSION',
        pointer: '/response_version',
        detail: `La versión ${payload.response_version} no supera la versión vigente ${context.currentVersion}.`,
      });
    }
  }

  /** INV-16 — orden no regresivo de los 4 hitos. */
  private checkMilestoneMachine(
    payload: PublishResponseDto,
    context: ResponseValidationContext,
    out: Violation[],
  ): void {
    const current = context.currentMilestone;
    if (current === null) {
      return;
    }

    if (
      current === BusinessMilestone.INTERACTION_COMPLETED &&
      payload.business_milestone !== BusinessMilestone.INTERACTION_COMPLETED
    ) {
      out.push({
        code: 'INTERACTION_ALREADY_COMPLETED',
        pointer: '/business_milestone',
        detail:
          'La interacción ya alcanzó INTERACTION_COMPLETED; no admite otro hito.',
      });
      return;
    }

    if (isRegression(current, payload.business_milestone)) {
      out.push({
        code: 'MILESTONE_REGRESSION',
        pointer: '/business_milestone',
        detail: `No se admite retroceder de ${current} a ${payload.business_milestone}.`,
      });
    }
  }

  /** §7.1 — `response_status` exigido por el hito. */
  private checkResponseStatus(
    payload: PublishResponseDto,
    out: Violation[],
  ): void {
    const required = requiredResponseStatus(payload.business_milestone);
    if (required !== null && payload.response_status !== required) {
      out.push({
        code: 'INVALID_RESPONSE_STATUS',
        pointer: '/response_status',
        detail: `El hito ${payload.business_milestone} exige response_status = ${required}.`,
      });
    }
  }

  /**
   * §7.1 — campos exigidos por hito. Lo exigido por un hito permanece exigido
   * en los hitos posteriores (`assignment` no puede volver a `null`).
   */
  private checkMilestoneRequirements(
    payload: PublishResponseDto,
    out: Violation[],
  ): void {
    const milestone = payload.business_milestone;
    const links = payload.operational_links ?? {};

    if (requiresAssignment(milestone)) {
      if (!payload.assignment) {
        out.push({
          code: 'MILESTONE_REQUIREMENTS_NOT_MET',
          pointer: '/assignment',
          detail: `El hito ${milestone} exige \`assignment\`.`,
        });
      }
      if (!links.planner_interaction_url) {
        out.push({
          code: 'MILESTONE_REQUIREMENTS_NOT_MET',
          pointer: '/operational_links/planner_interaction_url',
          detail: `El hito ${milestone} exige \`planner_interaction_url\`.`,
        });
      }
    }

    if (requiresRouteCapacity(milestone)) {
      if (!payload.route_capacity) {
        out.push({
          code: 'MILESTONE_REQUIREMENTS_NOT_MET',
          pointer: '/route_capacity',
          detail: `El hito ${milestone} exige \`route_capacity\`.`,
        });
      }
      if (!payload.eta_date) {
        out.push({
          code: 'MILESTONE_REQUIREMENTS_NOT_MET',
          pointer: '/eta_date',
          detail: `El hito ${milestone} exige un \`eta_date\` global.`,
        });
      }
      if (!links.route_capacity_register_url) {
        out.push({
          code: 'MILESTONE_REQUIREMENTS_NOT_MET',
          pointer: '/operational_links/route_capacity_register_url',
          detail: `El hito ${milestone} exige \`route_capacity_register_url\`.`,
        });
      }
    }

    if (milestone === BusinessMilestone.INTERACTION_COMPLETED) {
      payload.service_results.forEach((result, index) => {
        const isTerminal =
          result.status === ServiceResultStatus.COMPLETED ||
          result.status === ServiceResultStatus.CANCELLED;

        if (!isTerminal) {
          out.push({
            code: 'MILESTONE_REQUIREMENTS_NOT_MET',
            pointer: `/service_results/${index}/status`,
            detail:
              'INTERACTION_COMPLETED exige que cada servicio esté en estado terminal (COMPLETED o CANCELLED).',
          });
          return;
        }

        // Un servicio CANCELLED cierra sin entregable (ya exige `reason_code`);
        // un servicio COMPLETED sin entregable no es un cierre válido: la
        // entrega final requiere URL de SharePoint Documents (INV-23).
        if (
          result.status === ServiceResultStatus.COMPLETED &&
          result.deliverables.length === 0
        ) {
          out.push({
            code: 'MILESTONE_REQUIREMENTS_NOT_MET',
            pointer: `/service_results/${index}/deliverables`,
            detail:
              'INTERACTION_COMPLETED exige al menos un entregable por servicio completado.',
          });
        }
      });
    }
  }

  /** §6.5 `service_results[]` — fuente de verdad; INV-01, INV-22, INV-23. */
  private checkServiceResults(
    payload: PublishResponseDto,
    out: Violation[],
  ): void {
    const seen = new Set<string>();

    payload.service_results.forEach((result, index) => {
      const base = `/service_results/${index}`;

      if (seen.has(result.service)) {
        out.push({
          code: 'DUPLICATE_SERVICE',
          pointer: `${base}/service`,
          detail: `El servicio ${result.service} aparece más de una vez.`,
        });
      }
      seen.add(result.service);

      if (!isDependencyAllowed(result.service, result.dependency)) {
        out.push({
          code: 'INVERTED_SERVICE_DEPENDENCY',
          pointer: `${base}/dependency`,
          detail: `${result.service} no admite dependency = ${result.dependency}.`,
        });
      }

      const isCompleted = result.status === ServiceResultStatus.COMPLETED;

      // Conflicto interno del spec, resuelto aquí de forma explícita:
      // el diccionario de campos de §6.5 dice que `outcome` es `null` mientras
      // `status ≠ COMPLETED`, pero el ejemplo real del brief en ese mismo §6.5
      // — y el fixture maestro `response-v3` de §15.3 — publican
      // `IN_PROGRESS` + `VIABLE`. El único test del spec sobre la regla,
      // TS-SVC-07, acota el rechazo al caso `status = RECEIVED`.
      // Se implementa esa lectura: sin resultado observado (`RECEIVED`) no
      // puede haber `outcome`; al cerrar (`COMPLETED`) el `outcome` es
      // obligatorio; en `IN_PROGRESS`/`CANCELLED` se admite un resultado
      // provisional. Queda registrado como aclaración pendiente junto a
      // OPEN-01.
      if (
        result.status === ServiceResultStatus.RECEIVED &&
        result.outcome !== null
      ) {
        out.push({
          code: 'INVALID_SERVICE_OUTCOME',
          pointer: `${base}/outcome`,
          detail:
            '`outcome` debe ser null mientras el servicio solo esté RECEIVED.',
        });
      }

      if (isCompleted && result.outcome === null) {
        out.push({
          code: 'INVALID_SERVICE_OUTCOME',
          pointer: `${base}/outcome`,
          detail: 'Un servicio COMPLETED debe declarar su `outcome`.',
        });
      }

      const needsReason =
        result.status === ServiceResultStatus.CANCELLED ||
        result.outcome === ServiceOutcome.NOT_VIABLE ||
        result.outcome === ServiceOutcome.PARTIAL;

      if (needsReason && !result.reason_code) {
        out.push({
          code: 'MISSING_REASON_CODE',
          pointer: `${base}/reason_code`,
          detail:
            '`reason_code` es obligatorio con outcome NOT_VIABLE/PARTIAL o status CANCELLED.',
        });
      }

      result.deliverables.forEach((deliverable, deliverableIndex) => {
        if (!isSharePointDocumentUrl(deliverable.url)) {
          out.push({
            code: 'DELIVERABLE_NOT_A_DOCUMENT',
            pointer: `${base}/deliverables/${deliverableIndex}/url`,
            detail:
              'El entregable debe ser una URL HTTPS de SharePoint Documents; el registro de SharePoint List nunca es entregable.',
          });
        }
      });
    });
  }

  /** §6.5 / §10.3 — HTTPS obligatorio en los enlaces operativos. */
  private checkOperationalLinks(
    payload: PublishResponseDto,
    out: Violation[],
  ): void {
    const links = payload.operational_links ?? {};

    for (const [key, value] of Object.entries(links)) {
      if (typeof value === 'string' && value.length > 0 && !isHttpsUrl(value)) {
        out.push({
          code: 'INSECURE_URL',
          pointer: `/operational_links/${key}`,
          detail: 'Los enlaces operativos exigen HTTPS.',
        });
      }
    }
  }

  /** P-03 / INV-20 — la clasificación solo existe en el cierre. */
  private checkClassification(
    payload: PublishResponseDto,
    out: Violation[],
  ): void {
    const value = payload.delivered_interaction_type;
    const isClosing =
      payload.business_milestone === BusinessMilestone.INTERACTION_COMPLETED;

    if (!isClosing && value !== null) {
      out.push({
        code: 'PREMATURE_CLASSIFICATION',
        pointer: '/delivered_interaction_type',
        detail:
          '`delivered_interaction_type` debe ser null antes de INTERACTION_COMPLETED.',
      });
      return;
    }

    if (!isClosing) {
      return;
    }

    if (value === null) {
      out.push({
        code: 'MISSING_CLASSIFICATION',
        pointer: '/delivered_interaction_type',
        detail:
          'INTERACTION_COMPLETED exige `delivered_interaction_type` no nulo.',
      });
      return;
    }

    if (value === PROVISIONAL_CLASSIFICATION_VALUE) {
      out.push({
        code: 'PROVISIONAL_CLASSIFICATION',
        pointer: '/delivered_interaction_type',
        detail:
          'El valor provisional TIPO-POR-ESPECIFICAR no es una clasificación entregada.',
      });
    }
  }

  private toProblem(violations: Violation[]): MepProblemException {
    const ranked = [...violations].sort(
      (a, b) => precedence(a.code) - precedence(b.code),
    );
    const primary = ranked[0];
    const errors: ProblemErrorItem[] = ranked.map((violation) => ({
      pointer: violation.pointer,
      code: violation.code,
    }));

    return MepProblemException.unprocessable(
      primary.code,
      primary.detail,
      errors,
    );
  }
}

function precedence(code: MepErrorCode): number {
  const index = CODE_PRECEDENCE.indexOf(code);
  return index < 0 ? CODE_PRECEDENCE.length : index;
}
