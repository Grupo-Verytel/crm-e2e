/** Shared localStorage helpers for OUV Interacciones tab. */

export type InteraccionEntry = {
  id: string;
  titulo: string;
  observaciones: string;
  fechaRegistrada: string;
  registradoPor: string;
  etiquetas?: string[];
};

export type InteraccionRecord = InteraccionEntry & {
  hilos: InteraccionEntry[];
};

const STORAGE_PREFIX = 'crm-ouv-interacciones-v2-';

export function loadOuvInteracciones(ouvId: string): InteraccionRecord[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${ouvId}`);
    if (!raw) return [];
    return JSON.parse(raw) as InteraccionRecord[];
  } catch {
    return [];
  }
}

export function saveOuvInteracciones(
  ouvId: string,
  items: InteraccionRecord[],
): void {
  localStorage.setItem(`${STORAGE_PREFIX}${ouvId}`, JSON.stringify(items));
}

/** Prepend a top-level interaction (e.g. OUV perdida cierre). */
export function appendOuvInteraccion(
  ouvId: string,
  input: {
    titulo: string;
    observaciones: string;
    etiquetas?: string[];
    registradoPor?: string;
  },
): InteraccionRecord {
  const entry: InteraccionRecord = {
    id: `int-${Date.now()}`,
    titulo: input.titulo,
    observaciones: input.observaciones,
    fechaRegistrada: new Date().toISOString(),
    registradoPor: input.registradoPor ?? 'Usuario actual',
    etiquetas: input.etiquetas,
    hilos: [],
  };
  const next = [entry, ...loadOuvInteracciones(ouvId)];
  saveOuvInteracciones(ouvId, next);
  return entry;
}
