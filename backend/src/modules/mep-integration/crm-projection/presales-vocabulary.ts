import {
  ServiceDependency,
  ServiceHorizon,
  ServiceName,
} from '../domain/enums';

/**
 * Vocabulario de la UI comercial → enumeraciones canónicas del contrato.
 *
 * La pantalla de «Solicitud de preventa» habla en términos de negocio
 * (prioridad, combo de servicios); el contrato habla en `ServiceHorizon` y
 * `requested_services[]` (§3.1, §7.6). Esta es la única frontera donde se
 * traducen, para que ningún componente de UI invente valores de enum.
 */

/** Prioridad comercial de la actividad, tal como la ve el ejecutivo. */
export enum ActivityPriority {
  ASAP = 'ASAP',
  SOMBRA = 'SOMBRA',
}

/**
 * Mapeo prioridad → horizonte de servicio.
 *
 * OJO: el diseño de referencia (rama `Design_JD`) mapeaba `SOMBRA` a un
 * horizonte `SHADOW` que **no existe** en `ServiceHorizon` (§3.1 lo cierra en
 * IMMEDIATE | DEFERRED | UNSPECIFIED) y que el contrato rechazaría con 422.
 * Se traduce a `DEFERRED`, que es el horizonte diferido del spec.
 * Pendiente de confirmación del arquitecto junto con OPEN-01.
 */
export const PRIORITY_TO_HORIZON: Record<ActivityPriority, ServiceHorizon> = {
  [ActivityPriority.ASAP]: ServiceHorizon.IMMEDIATE,
  [ActivityPriority.SOMBRA]: ServiceHorizon.DEFERRED,
};

/** Los 4 casos de forma válida de `requested_services[]` (§7.6). */
export enum ServiceCombo {
  TECHNICAL = 'technical',
  FINANCIAL = 'financial',
  TECHNICAL_AND_FINANCIAL = 'technical_and_financial',
  TECHNICAL_THEN_FINANCIAL = 'technical_then_financial',
}

export interface RequestedServiceShape {
  service: ServiceName;
  dependency: ServiceDependency;
}

/**
 * §7.6 — C-1 … C-4. No existe un quinto combo: el caso negativo (técnico
 * dependiente de financiero) es irrepresentable desde la UI por construcción,
 * y además lo rechaza `INV-01` en el backend.
 */
export const COMBO_TO_SERVICES: Record<ServiceCombo, RequestedServiceShape[]> =
  {
    // C-1: sólo técnico
    [ServiceCombo.TECHNICAL]: [
      {
        service: ServiceName.TECHNICAL_DESIGN,
        dependency: ServiceDependency.NONE,
      },
    ],
    // C-2: financiero directo, sin fase técnica
    [ServiceCombo.FINANCIAL]: [
      {
        service: ServiceName.FINANCIAL_DESIGN,
        dependency: ServiceDependency.NONE,
      },
    ],
    // C-3: técnico y financiero simultáneos e independientes
    [ServiceCombo.TECHNICAL_AND_FINANCIAL]: [
      {
        service: ServiceName.TECHNICAL_DESIGN,
        dependency: ServiceDependency.NONE,
      },
      {
        service: ServiceName.FINANCIAL_DESIGN,
        dependency: ServiceDependency.NONE,
      },
    ],
    // C-4: técnico seguido de financiero dependiente
    [ServiceCombo.TECHNICAL_THEN_FINANCIAL]: [
      {
        service: ServiceName.TECHNICAL_DESIGN,
        dependency: ServiceDependency.NONE,
      },
      {
        service: ServiceName.FINANCIAL_DESIGN,
        dependency: ServiceDependency.TECHNICAL_DESIGN,
      },
    ],
  };

/** Etiquetas en español para la UI; los valores siguen siendo los del enum. */
export const SERVICE_LABELS: Record<ServiceName, string> = {
  [ServiceName.TECHNICAL_DESIGN]: 'Técnica',
  [ServiceName.FINANCIAL_DESIGN]: 'Financiera',
};

export const COMBO_LABELS: Record<ServiceCombo, string> = {
  [ServiceCombo.TECHNICAL]: 'Técnica',
  [ServiceCombo.FINANCIAL]: 'Financiera',
  [ServiceCombo.TECHNICAL_AND_FINANCIAL]: 'Técnico y financiero',
  [ServiceCombo.TECHNICAL_THEN_FINANCIAL]: 'Técnico y luego financiero',
};
