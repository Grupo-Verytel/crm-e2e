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
      label: 'Al menos 2 influencias en Verde',
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

export const INFLUENCIA_TIPOS = ['Economica', 'Tecnica', 'Fabrica'] as const;
export type InfluenciaTipo = (typeof INFLUENCIA_TIPOS)[number];

export const INFLUENCIA_ESTADOS = [
  'SinEvaluar',
  'Verde',
  'Amarillo',
  'Rojo',
] as const;

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
  'Gobierno',
  'D&S',
  'ProyectosEspeciales',
  'B2B',
] as const;

export const OUV_EVENT_PREFIX = 'ouv.';

export function isOuvNotificationEvent(eventType: string | undefined): boolean {
  return Boolean(eventType?.startsWith(OUV_EVENT_PREFIX));
}
