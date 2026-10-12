import { fetchOuvs, type Ouv } from '../api/ouvs-api';
import {
  OUV_ZONA_RIBBON_LABEL,
  type OuvResultado,
} from './ouv-vocab';

const EXPORT_PAGE_SIZE = 100;

const ESTADO_LABEL: Record<OuvResultado, string> = {
  EnCurso: 'En curso',
  Ganada: 'Ganada',
  Perdida: 'Perdida',
  Descartada: 'Descartada',
};

export type OuvExportCurrentUser = {
  user_id: string;
  full_name: string;
};

function ejecutivoNombre(
  ouv: Ouv,
  currentUser?: OuvExportCurrentUser | null,
): string {
  if (ouv.comercial_nombre?.trim()) return ouv.comercial_nombre.trim();
  if (currentUser && ouv.comercial_id === currentUser.user_id) {
    return currentUser.full_name;
  }
  return '';
}

function formatCreationDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function escapeCell(value: string): string {
  if (/[",\n;]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowValues(
  ouv: Ouv,
  currentUser?: OuvExportCurrentUser | null,
): string[] {
  return [
    ouv.consecutivo,
    ouv.empresa_nombre,
    ouv.titulo,
    ejecutivoNombre(ouv, currentUser),
    ouv.segmento,
    OUV_ZONA_RIBBON_LABEL[ouv.zona_actual] ?? ouv.zona_actual,
    ESTADO_LABEL[ouv.resultado] ?? ouv.resultado,
    formatCreationDate(ouv.created_at),
  ];
}

const HEADERS = [
  'ID_OUV',
  'EMPRESA',
  'NOMBRE_OUV',
  'EJECUTIVO',
  'SEGMENTO',
  'ETAPA_FUNNEL',
  'ESTADO',
  'FEC_CREACION',
];

export function buildOuvsCsv(
  ouvs: Ouv[],
  currentUser?: OuvExportCurrentUser | null,
): string {
  const rows = ouvs.map((ouv) =>
    rowValues(ouv, currentUser).map(escapeCell).join(';'),
  );
  return [HEADERS.join(';'), ...rows].join('\n');
}

export function downloadOuvsCsv(
  ouvs: Ouv[],
  currentUser?: OuvExportCurrentUser | null,
): void {
  const csv = buildOuvsCsv(ouvs, currentUser);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `ouvs-${stamp}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Pages through the list API so the CSV includes every accessible OUV. */
export async function fetchAllOuvsForExport(
  canListAll: boolean,
): Promise<Ouv[]> {
  const collected: Ouv[] = [];
  let page = 1;
  let total = Number.POSITIVE_INFINITY;

  while (collected.length < total) {
    const data = await fetchOuvs({
      page,
      limit: EXPORT_PAGE_SIZE,
      all: canListAll || undefined,
    });
    total = data.total;
    collected.push(...data.items);
    if (data.items.length === 0) break;
    page += 1;
    if (page > 500) break;
  }

  return collected;
}
