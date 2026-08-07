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

/** How the OUV was created (Vía 1 vs Vías 2/3/4). */
export enum OuvOrigenVia {
  DesdeSql = 'desde_sql',
  Directa = 'directa',
}

/**
 * Verytel vertical catalog (Wave 1 hardcoded).
 * Spec §2.6 said "7 values"; canonical list is the 8 already in the repo.
 * Column remains VARCHAR(80) — validation only in DTO/TS (A2).
 */
export enum OuvVertical {
  SeguridadCiudadana = 'Seguridad Ciudadana',
  Defensa = 'Defensa',
  Telecomunicaciones = 'Telecomunicaciones',
  SmartCities = 'Smart Cities',
  InfraestructuraCritica = 'Infraestructura Crítica',
  Educacion = 'Educación',
  Salud = 'Salud',
  Otros = 'Otros',
}

/** @deprecated Prefer OuvVertical — kept for DTO IsIn compatibility. */
export const VERTICALES_PROVISIONALES = Object.values(OuvVertical);

export type VerticalProvisional = OuvVertical;

export enum InfluenciaTipo {
  Economica = 'Economica',
  Tecnica = 'Tecnica',
  Fabrica = 'Fabrica',
}

export enum InfluenciaEstado {
  Verde = 'Verde',
  Rojo = 'Rojo',
  Amarillo = 'Amarillo',
  SinEvaluar = 'SinEvaluar',
}

export enum PresupuestoMoneda {
  COP = 'COP',
  USD = 'USD',
}

export enum PresupuestoFuente {
  ClienteDeclaro = 'cliente_declaro',
  ContratoPrevio = 'contrato_previo',
  LicitacionPublicada = 'licitacion_publicada',
  EstimacionComercial = 'estimacion_comercial',
  SinVerificar = 'sin_verificar',
}
