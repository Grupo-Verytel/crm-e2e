import {
  RouteStatus,
  ServiceName,
  ServiceOutcome,
  ServiceResultStatus,
} from '../domain/enums';

/** Canonical MEP viabilidad codes projected for CRM (Spanish labels in UI). */
export const PRESALES_VIABILIDAD_ETIQUETAS = {
  RUTA_VIABLE: 'Ruta viable',
  RUTA_NO_VIABLE: 'Ruta no viable',
  SERVICIO_VIABLE: 'Resultado de servicio viable',
  SERVICIO_NO_VIABLE: 'Resultado de servicio no viable',
  SERVICIO_SIN_ENTREGABLE: 'Resultado de servicio sin entregable',
} as const;

export type PresalesViabilidadCodigo = keyof typeof PRESALES_VIABILIDAD_ETIQUETAS;

export interface PresalesViabilidadView {
  codigo: PresalesViabilidadCodigo | null;
  etiqueta: string | null;
}

export interface ResolvePresalesViabilidadInput {
  service: ServiceName;
  outcome: ServiceOutcome | null;
  status: ServiceResultStatus;
  entregablesCount: number;
  routeStatus: RouteStatus | null;
}

/**
 * Maps MEP `service_results[].outcome` and, for technical design only,
 * `route_capacity.route_status` into the five viabilidad labels Preventa uses.
 */
export function resolvePresalesViabilidad(
  input: ResolvePresalesViabilidadInput,
): PresalesViabilidadView {
  const outcome = input.outcome;

  if (
    outcome === ServiceOutcome.VIABLE ||
    outcome === ServiceOutcome.CONDITIONED
  ) {
    return {
      codigo: 'SERVICIO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_VIABLE,
    };
  }
  if (outcome === ServiceOutcome.NOT_VIABLE) {
    return {
      codigo: 'SERVICIO_NO_VIABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_NO_VIABLE,
    };
  }
  if (outcome === ServiceOutcome.PARTIAL) {
    return {
      codigo: 'SERVICIO_SIN_ENTREGABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_SIN_ENTREGABLE,
    };
  }

  if (
    input.service === ServiceName.TECHNICAL_DESIGN &&
    input.routeStatus
  ) {
    if (
      input.routeStatus === RouteStatus.VIABLE ||
      input.routeStatus === RouteStatus.CONDITIONED
    ) {
      return {
        codigo: 'RUTA_VIABLE',
        etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.RUTA_VIABLE,
      };
    }
    if (input.routeStatus === RouteStatus.NOT_VIABLE) {
      return {
        codigo: 'RUTA_NO_VIABLE',
        etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.RUTA_NO_VIABLE,
      };
    }
  }

  const terminal =
    input.status === ServiceResultStatus.COMPLETED ||
    input.status === ServiceResultStatus.CANCELLED;
  if (terminal && input.entregablesCount === 0 && !outcome) {
    return {
      codigo: 'SERVICIO_SIN_ENTREGABLE',
      etiqueta: PRESALES_VIABILIDAD_ETIQUETAS.SERVICIO_SIN_ENTREGABLE,
    };
  }

  return { codigo: null, etiqueta: null };
}
