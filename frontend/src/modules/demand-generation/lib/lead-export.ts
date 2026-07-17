import { leadEstadoLabel } from './lead-vocab';
import type { Lead } from '../types';

const COLUMNS: { header: string; value: (lead: Lead) => string }[] = [
  { header: 'Empresa', value: (l) => l.empresa_nombre },
  { header: 'Contacto', value: (l) => l.contacto_nombre },
  { header: 'Email', value: (l) => l.email },
  { header: 'Teléfono', value: (l) => l.telefono ?? '' },
  { header: 'Segmento', value: (l) => l.segmento },
  { header: 'Industria', value: (l) => l.industria ?? '' },
  { header: 'Estado', value: (l) => leadEstadoLabel(l.estado) },
  { header: 'Origen', value: (l) => l.origen },
  { header: 'Canal de origen', value: (l) => l.canal_origen },
  { header: 'Campaña', value: (l) => l.campana_id ?? '' },
  { header: 'Responsable', value: (l) => l.responsable_id },
  { header: 'Región', value: (l) => l.region },
  { header: 'Última interacción', value: (l) => l.fecha_ultima_interaccion ?? '' },
  { header: 'Fecha de captura', value: (l) => l.fecha_captura },
];

function escapeCell(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** Build a CSV string for the given leads using the Mercadeo vocabulary. */
export function buildLeadsCsv(leads: Lead[]): string {
  const header = COLUMNS.map((column) => column.header).join(',');
  const rows = leads.map((lead) =>
    COLUMNS.map((column) => escapeCell(column.value(lead))).join(','),
  );
  return [header, ...rows].join('\n');
}

/** Trigger a client-side download of the selected leads as a CSV file. */
export function downloadLeadsCsv(leads: Lead[]): void {
  const csv = buildLeadsCsv(leads);
  // BOM so Excel opens accented Spanish text correctly.
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `leads-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
