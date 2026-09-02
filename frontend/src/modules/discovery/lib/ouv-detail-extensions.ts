export type OuvDetailExtensions = {
  proyecto?: 'Recurrente' | 'No recurrente';
  plazo_ejecucion?: string;
  probabilidad_cierre?: string;
  ciudad?: string;
  region?: string;
};

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
