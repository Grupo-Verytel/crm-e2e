export type OuvDetailTab =
  | 'detalle'
  | 'preventa'
  | 'interacciones'
  | 'recordatorios';

/** Reads `?tab=` on `/opportunities/:id`. Unknown values fall back to detalle. */
export function parseOuvDetailTab(value: string | null): OuvDetailTab {
  if (
    value === 'preventa' ||
    value === 'interacciones' ||
    value === 'recordatorios'
  ) {
    return value;
  }
  return 'detalle';
}
