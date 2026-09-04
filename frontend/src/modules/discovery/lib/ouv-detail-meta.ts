import { formatDateTime } from '../../../lib/format';
import type { Ouv } from '../api/ouvs-api';
import {
  resolveOuvOrigenLabel,
  type OuvDetailExtensions,
} from './ouv-detail-extensions';

export const SEGMENTO_LABEL: Record<string, string> = {
  Gobierno: 'Gobierno',
  'D&S': 'D&S',
  ProyectosEspeciales: 'Proyectos especiales',
  B2B: 'B2B',
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
    { label: 'OUV ID', value: ouv.ouv_id },
    {
      label: 'Consecutivo',
      value: `${ouv.consecutivo} · ${ouv.titulo}`,
    },
    { label: 'SQL ID', value: ouv.sql_id_origen ?? '—' },
    {
      label: 'Origen OUV',
      value: resolveOuvOrigenLabel(ouv.origen_via, extensions),
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
