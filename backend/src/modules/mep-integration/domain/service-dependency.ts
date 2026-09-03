import { ServiceDependency, ServiceName } from './enums';

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
