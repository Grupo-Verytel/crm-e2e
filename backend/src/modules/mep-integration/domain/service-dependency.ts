import {
  ServiceDependency,
  ServiceName,
  ServiceResultStatus,
} from './enums';

export type ServiceResultDependencyView = {
  service: ServiceName;
  status: ServiceResultStatus;
  dependency: ServiceDependency;
};

/**
 * Regla de dependencia entre servicios — §4, INV-01 / INV-22.
 *
 * `TECHNICAL_DESIGN` siempre tiene `dependency = NONE`.
 * `FINANCIAL_DESIGN` puede depender de `TECHNICAL_DESIGN`, nunca al revés.
 * Ningún servicio depende de sí mismo.
 */
export function isDependencyAllowed(
  service: ServiceName,
  dependency: ServiceDependency,
): boolean {
  if (dependency === ServiceDependency.NONE) {
    return true;
  }

  if (service === ServiceName.TECHNICAL_DESIGN) {
    // Un técnico dependiente de un financiero es la dependencia invertida.
    return false;
  }

  return dependency === ServiceDependency.TECHNICAL_DESIGN;
}

/** Maps a dependency token to the service that must advance first (C-4). */
export function dependencyTargetService(
  dependency: ServiceDependency,
): ServiceName | null {
  switch (dependency) {
    case ServiceDependency.TECHNICAL_DESIGN:
      return ServiceName.TECHNICAL_DESIGN;
    case ServiceDependency.FINANCIAL_DESIGN:
      return ServiceName.FINANCIAL_DESIGN;
    case ServiceDependency.NONE:
      return null;
  }
}

/**
 * C-4 — técnico seguido de financiero: el dependiente no sale de RECEIVED
 * hasta que el bloqueante cierre su ciclo (COMPLETED). Combos con dependency
 * NONE no aplican; cualquiera puede avanzar primero (C-3).
 */
export function isServicePrecedenceSatisfied(
  result: ServiceResultDependencyView,
  all: ServiceResultDependencyView[],
): boolean {
  const dependsOn = dependencyTargetService(result.dependency);
  if (dependsOn === null) {
    return true;
  }

  if (
    result.status === ServiceResultStatus.RECEIVED ||
    result.status === ServiceResultStatus.CANCELLED
  ) {
    return true;
  }

  const blocker = all.find((item) => item.service === dependsOn);
  if (!blocker) {
    return true;
  }

  if (
    result.status === ServiceResultStatus.IN_PROGRESS ||
    result.status === ServiceResultStatus.COMPLETED
  ) {
    return blocker.status === ServiceResultStatus.COMPLETED;
  }

  return true;
}
