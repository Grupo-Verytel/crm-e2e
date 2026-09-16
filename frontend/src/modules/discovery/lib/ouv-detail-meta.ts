import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../api/ouvs-api';
import {
  resolveOuvOrigenLabel,
  type OuvDetailExtensions,
} from './ouv-detail-extensions';

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

const SOURCE_CHANNEL_LABEL: Record<string, string> = {
  CAMPANA_DIGITAL: 'Marketing Digital',
  BTL: 'BTL',
  EVENTOS: 'Eventos',
  FABRICA: 'Fábrica',
  GENERACION_DEMANDA_AGENCIA: 'Generación de demanda (agencia)',
  TRADUCTOR_NEGOCIO: 'Traductor de negocio',
  REFERIDO: 'Referido',
};

export function formatOuvSourceChannel(channel: string | null): string {
  if (!channel) return '—';
  return SOURCE_CHANNEL_LABEL[channel] ?? channel;
}

export type OuvMetaField = {
  label: string;
  value: string;
};

/** Read-only metadata rows for the OUV detail header. */
export function buildOuvMetaFields(
  ouv: Ouv,
  extensions: OuvDetailExtensions = {},
): OuvMetaField[] {
  const segmento =
    SEGMENTO_LABEL[ouv.segmento] ??
    ouv.segmento.replace(/([A-Z])/g, ' $1').trim();

  const prob = extensions.probabilidad_cierre?.trim();
  const probDisplay = prob ? (prob.endsWith('%') ? prob : `${prob}%`) : '—';

  return [
    {
      label: 'Consecutivo',
      value: `${ouv.consecutivo} · ${ouv.titulo}`,
    },
    {
      label: 'Origen OUV',
      value: resolveOuvOrigenLabel(ouv.origen_via, extensions),
    },
    { label: 'Origen', value: ouv.origen ?? '—' },
    {
      label: 'Canal de origen',
      value: formatOuvSourceChannel(ouv.canal_origen),
    },
    { label: 'Organización', value: ouv.empresa_nombre },
    { label: 'Segmento', value: segmento },
    { label: 'Vertical', value: ouv.vertical || '—' },
    { label: 'Proyecto', value: extensions.proyecto ?? '—' },
    {
      label: 'Plazo ejecución',
      value: extensions.plazo_ejecucion
        ? `${extensions.plazo_ejecucion} meses`
        : '—',
    },
    { label: 'Probabilidad de cierre', value: probDisplay },
    { label: 'Ciudad', value: extensions.ciudad ?? '—' },
    { label: 'Región', value: extensions.region ?? '—' },
    { label: 'Etapa', value: 'Comercial' },
    {
      label: 'Estado OUV',
      value: RESULTADO_LABEL[ouv.resultado] ?? ouv.resultado,
    },
    { label: 'Fecha creación', value: formatDateTime(ouv.created_at) },
    { label: 'Fecha actualización', value: formatDateTime(ouv.updated_at) },
  ];
}
