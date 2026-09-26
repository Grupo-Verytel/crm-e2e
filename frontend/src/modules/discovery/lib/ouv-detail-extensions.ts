export type OuvDetailExtensions = {
  proyecto?: 'Recurrente' | 'No recurrente';
  plazo_ejecucion?: string;
  probabilidad_cierre?: string;
  ciudad?: string;
  region?: string;
};

type Proyecto = NonNullable<OuvDetailExtensions['proyecto']>;

/** `ouvs.is_recurring` manda; lo guardado en el navegador es respaldo legado. */
export function proyectoDeOuv(
  isRecurring: boolean | null | undefined,
  extensions: OuvDetailExtensions,
): Proyecto | undefined {
  if (isRecurring === true) return 'Recurrente';
  if (isRecurring === false) return 'No recurrente';
  return extensions.proyecto;
}

export function isRecurringDeProyecto(
  proyecto: Proyecto | undefined,
): boolean | null {
  if (proyecto === 'Recurrente') return true;
  if (proyecto === 'No recurrente') return false;
  return null;
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
