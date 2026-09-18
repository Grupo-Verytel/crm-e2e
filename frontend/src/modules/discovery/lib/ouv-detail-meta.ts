import { formatDateTime } from '../../../lib/format';
import { CANAL_ORIGEN_LABEL } from '../../demand-generation/lib/lead-vocab';
import type { CanalOrigen } from '../../demand-generation/types';
import type { Ouv } from '../api/ouvs-api';
import type { OuvDetailExtensions } from './ouv-detail-extensions';

export const SEGMENTO_LABEL: Record<string, string> = {
  'Ciudades y gobernaciones': 'Ciudades y gobernaciones',
  'Gobierno central': 'Gobierno central',
  'Defensa y seguridad': 'Defensa y seguridad',
  Industria: 'Industria',
  Gobierno: 'Gobierno central',
  'D&S': 'Defensa y seguridad',
  ProyectosEspeciales: 'Ciudades y gobernaciones',
  'Seguridad ciudadana': 'Ciudades y gobernaciones',
  B2B: 'Industria',
};

export const RESULTADO_LABEL: Record<string, string> = {
  EnCurso: 'En curso',
  Ganada: 'Ganada',
  Perdida: 'Perdida',
  Descartada: 'Descartada',
};

export type OuvMetaField = {
  label: string;
  value: string;
};

function displayLoc(
  persisted: string | null | undefined,
  fallback?: string,
): string {
  const primary = persisted?.trim();
  if (primary) return primary;
  const secondary = fallback?.trim();
  if (secondary) return secondary;
  return '—';
}

export function formatOuvOrigin(origin: string | null | undefined): string {
  const value = origin?.trim();
  return value || '—';
}

export function formatOuvSourceChannel(
  channel: string | null | undefined,
): string {
  const value = channel?.trim();
  if (!value) return '—';
  return CANAL_ORIGEN_LABEL[value as CanalOrigen] ?? value;
}

/** Read-only metadata rows for the OUV detail header. */
export function buildOuvMetaFields(
  ouv: Ouv,
  extensions: OuvDetailExtensions = {},
): OuvMetaField[] {
  const segmento =
    SEGMENTO_LABEL[ouv.segmento] ?? ouv.segmento.replace(/([A-Z])/g, ' $1').trim();

  const prob = extensions.probabilidad_cierre?.trim();
  const probDisplay = prob ? (prob.endsWith('%') ? prob : `${prob}%`) : '—';

  return [
    { label: 'Organización', value: ouv.empresa_nombre },
    { label: 'Segmento', value: segmento },
    { label: 'Vertical', value: ouv.vertical || '—' },
    { label: 'Origen', value: formatOuvOrigin(ouv.origin) },
    {
      label: 'Canal de origen',
      value: formatOuvSourceChannel(ouv.source_channel),
    },
    { label: 'Proyecto', value: extensions.proyecto ?? '—' },
    {
      label: 'Plazo ejecución',
      value: extensions.plazo_ejecucion
        ? `${extensions.plazo_ejecucion} meses`
        : '—',
    },
    { label: 'Probabilidad de cierre', value: probDisplay },
    {
      label: 'Ciudad',
      value: displayLoc(ouv.city, extensions.ciudad),
    },
    {
      label: 'Región',
      value: displayLoc(ouv.region, extensions.region),
    },
    { label: 'Etapa', value: 'Comercial' },
    { label: 'Fecha creación', value: formatDateTime(ouv.created_at) },
    { label: 'Fecha actualización', value: formatDateTime(ouv.updated_at) },
  ];
}
