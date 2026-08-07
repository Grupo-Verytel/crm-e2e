/** Zona del embudo comercial Verytel (Wave 1 entry = UNIVERSO). */
export enum OuvZona {
  Universo = 'UNIVERSO',
  EncimaFunnel = 'ENCIMA_FUNNEL',
  EnFunnel = 'EN_FUNNEL',
  MayorProbabilidad = 'MAYOR_PROBABILIDAD',
}

export enum OuvResultado {
  EnCurso = 'EnCurso',
  Ganada = 'Ganada',
  Perdida = 'Perdida',
  Descartada = 'Descartada',
}

/**
 * Canonical segmento values (same as demand-generation Segmento).
 * Duplicated here to avoid deep-importing another module's internals.
 */
export enum OuvSegmento {
  Gobierno = 'Gobierno',
  DS = 'D&S',
  ProyectosEspeciales = 'ProyectosEspeciales',
  B2B = 'B2B',
}

/** Provisional Verytel vertical catalog (Wave 1). */
export const VERTICALES_PROVISIONALES = [
  'Seguridad Ciudadana',
  'Defensa',
  'Telecomunicaciones',
  'Smart Cities',
  'Infraestructura Crítica',
  'Educación',
  'Salud',
  'Otros',
] as const;

export type VerticalProvisional = (typeof VERTICALES_PROVISIONALES)[number];
