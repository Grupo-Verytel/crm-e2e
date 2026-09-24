export const OUV_ZONAS = [
  'UNIVERSO',
  'ENCIMA_FUNNEL',
  'EN_FUNNEL',
  'MAYOR_PROBABILIDAD',
] as const;

export type OuvZona = (typeof OUV_ZONAS)[number];

export const OUV_ZONA_LABEL: Record<OuvZona, string> = {
  UNIVERSO: 'Universo',
  ENCIMA_FUNNEL: 'Encima Funnel',
  EN_FUNNEL: 'En Funnel',
  MAYOR_PROBABILIDAD: 'Mayor Probabilidad',
};

/** Labels for the funnel traceability ribbon (uppercase, per blueprint). */
export const OUV_ZONA_RIBBON_LABEL: Record<OuvZona, string> = {
  UNIVERSO: 'UNIVERSO',
  ENCIMA_FUNNEL: 'ENCIMA DEL FUNNEL',
  EN_FUNNEL: 'FUNNEL',
  MAYOR_PROBABILIDAD: 'MAYOR PROBABILIDAD',
};

export function nextOuvZona(zona: OuvZona): OuvZona | null {
  const idx = OUV_ZONAS.indexOf(zona);
  if (idx < 0 || idx >= OUV_ZONAS.length - 1) return null;
  return OUV_ZONAS[idx + 1];
}

export function prevOuvZona(zona: OuvZona): OuvZona | null {
  const idx = OUV_ZONAS.indexOf(zona);
  if (idx <= 0) return null;
  return OUV_ZONAS[idx - 1];
}

/** Guards that the motor will evaluate for the destination zona. */
export function guardsForDestino(
  destino: OuvZona,
): { code: string; label: string }[] {
  const guards: { code: string; label: string }[] = [
    {
      code: 'guardUsuarioEsComercialDelOUV',
      label: 'Debes ser el comercial dueño de la OUV',
    },
  ];
  if (destino === 'ENCIMA_FUNNEL') {
    guards.push({
      code: 'guardPresupuestoConfirmado',
      label: 'Presupuesto confirmado',
    });
  }
  if (destino === 'EN_FUNNEL' || destino === 'MAYOR_PROBABILIDAD') {
    guards.push({
      code: 'guard2InfluenciasEnVerde',
      label: 'Al menos 2 tipos en Verde entre Económica, Técnica y Fábrica',
    });
  }
  return guards;
}

export const OUV_RESULTADOS = [
  'EnCurso',
  'Ganada',
  'Perdida',
  'Descartada',
] as const;

export type OuvResultado = (typeof OUV_RESULTADOS)[number];

export const OUV_RESULTADO_LABEL: Record<OuvResultado, string> = {
  EnCurso: 'En curso',
  Ganada: 'Ganada',
  Perdida: 'Perdida',
  Descartada: 'Descartada',
};

export const INFLUENCIA_TIPOS = [
  'Economica',
  'Tecnica',
  'Fabrica',
  'Usuario',
  'Coach',
] as const;
export type InfluenciaTipo = (typeof INFLUENCIA_TIPOS)[number];

export const INFLUENCIA_TIPO_LABEL: Record<InfluenciaTipo, string> = {
  Economica: 'Económica',
  Tecnica: 'Técnica',
  Fabrica: 'Fábrica',
  Usuario: 'Usuario',
  Coach: 'Coach',
};

export const INFLUENCIA_ESTADOS = ['SinEvaluar', 'Verde', 'Rojo'] as const;

export type InfluenciaEstado = (typeof INFLUENCIA_ESTADOS)[number];

export const INFLUENCIA_FILTRO_TIPOS = [
  'Economica',
  'Tecnica',
  'Fabrica',
] as const;

export const INFLUENCIA_ESTADO_LABEL: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'Sin evaluar',
  Verde: 'Verde',
  Rojo: 'Rojo',
};

/** StatusBadge-style tones for influencia estado. */
export const INFLUENCIA_ESTADO_TONE_CLASS: Record<string, string> = {
  neutral: 'border-border text-muted',
  positive: 'border-semaphore-verde text-semaphore-verde',
  danger: 'border-danger text-danger',
};

export const INFLUENCIA_ESTADO_TONE: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'neutral',
  Verde: 'positive',
  Rojo: 'danger',
};

export const INFLUENCIA_ESTADO_DOT: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'border border-dashed border-muted bg-transparent',
  Verde: 'bg-semaphore-verde',
  Rojo: 'bg-danger',
};

export const INFLUENCIA_ESTADO_CARD: Record<InfluenciaEstado, string> = {
  SinEvaluar: 'border-border bg-bg/90',
  Verde: 'border-semaphore-verde/70 bg-semaphore-verde/20',
  Rojo: 'border-danger/70 bg-danger/15',
};

/** Ring around the compact-card avatar (estado is also in aria-label / title). */
export function influenciaAvatarRingClass(
  estado: InfluenciaEstado,
  hasContact: boolean,
): string {
  if (!hasContact) {
    return 'border-dashed border-muted text-muted';
  }
  if (estado === 'Verde') {
    return 'border-solid border-semaphore-verde text-semaphore-verde';
  }
  if (estado === 'Rojo') {
    return 'border-solid border-danger text-danger';
  }
  return 'border-solid border-muted text-ink';
}

export const VERTICALES = [
  'Seguridad Ciudadana',
  'Defensa',
  'Telecomunicaciones',
  'Smart Cities',
  'Infraestructura Crítica',
  'Educación',
  'Salud',
  'Otros',
] as const;

export const SEGMENTOS = [
  'Ciudades y gobernaciones',
  'Gobierno central',
  'Defensa y seguridad',
  'Industria',
] as const;

export const OUV_EVENT_PREFIX = 'ouv.';

export function isOuvNotificationEvent(eventType: string | undefined): boolean {
  return Boolean(eventType?.startsWith(OUV_EVENT_PREFIX));
}
