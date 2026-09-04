export type OuvDetailExtensions = {
  proyecto?: 'Recurrente' | 'No recurrente';
  plazo_ejecucion?: string;
  probabilidad_cierre?: string;
  ciudad?: string;
  region?: string;
  /** UI label for OUV origin (maps loosely to origen_via). */
  origen_ouv?: 'Desde SQL' | 'Desde OUV';
};

export const OUV_ORIGEN_OPTIONS = ['Desde SQL', 'Desde OUV'] as const;

export type OuvOrigenLabel = (typeof OUV_ORIGEN_OPTIONS)[number];

export function resolveOuvOrigenLabel(
  origenVia: string | undefined,
  extensions: OuvDetailExtensions = {},
): OuvOrigenLabel {
  if (extensions.origen_ouv) return extensions.origen_ouv;
  return origenVia === 'desde_sql' ? 'Desde SQL' : 'Desde OUV';
}

const STORAGE_PREFIX = 'crm-ouv-detail-ext-';

export function loadOuvExtensions(ouvId: string): OuvDetailExtensions {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ouvId}`);
    if (!raw) return {};
    return JSON.parse(raw) as OuvDetailExtensions;
  } catch {
    return {};
  }
}

export function saveOuvExtensions(
  ouvId: string,
  ext: OuvDetailExtensions,
): void {
  localStorage.setItem(`${STORAGE_PREFIX}${ouvId}`, JSON.stringify(ext));
}
