import type { LeadEstado, Segmento } from '../types';

/**
 * Business vocabulary for the Gestor/Director de Mercadeo. The technical ENUM
 * (TOFU, MOFU, MQL_PENDING…) stays in the data model; the UI always shows these
 * human labels (spec §5). Keep this map as the single source of truth so badges,
 * columns and filters never diverge.
 */
export const LEAD_ESTADO_LABEL: Record<LeadEstado, string> = {
  Nuevo: 'Nuevo',
  TOFU: 'Por contactar',
  MOFU: 'En nutrición',
  MQL_PENDING: 'Pendiente de aprobación',
  SQL: 'Calificado (a ventas)',
  Reciclaje: 'En reciclaje',
  Descartado: 'Descartado',
};

export function leadEstadoLabel(estado: string): string {
  return LEAD_ESTADO_LABEL[estado as LeadEstado] ?? estado;
}

/** Segment palette — small categorical dot, built only from design tokens. */
export const SEGMENTO_DOT: Record<Segmento, string> = {
  Gobierno: 'bg-navy',
  'D&S': 'bg-blue-500',
  ProyectosEspeciales: 'bg-sky',
  B2B: 'bg-muted',
};

export function segmentoDot(segmento: string): string {
  return SEGMENTO_DOT[segmento as Segmento] ?? 'bg-muted';
}

/**
 * The four guided board lanes, in flow order. Reciclaje/Descartado are NOT lanes
 * — they are exception states shown apart (spec: product decision). SQL is a
 * read-only destination: the promotion to SQL is the Director's decision in the
 * MQL inbox, never a drag.
 */
export type KanbanEstado = Extract<
  LeadEstado,
  'TOFU' | 'MOFU' | 'MQL_PENDING' | 'SQL'
>;

export type KanbanColumn = {
  estado: KanbanEstado;
  label: string;
  hint: string;
  /** State a card must come from to be droppable here (null = no drops). */
  acceptsFrom: KanbanEstado | null;
  /** SQL is fed only by the Director's approval, never by a drag. */
  readOnly: boolean;
};

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    estado: 'TOFU',
    label: 'Por contactar',
    hint: 'Captados, aún sin primera interacción',
    acceptsFrom: null,
    readOnly: false,
  },
  {
    estado: 'MOFU',
    label: 'En nutrición',
    hint: 'Con interacción; trabajando el checklist',
    acceptsFrom: 'TOFU',
    readOnly: false,
  },
  {
    estado: 'MQL_PENDING',
    label: 'Pendiente de aprobación',
    hint: 'Checklist completo; espera al Director',
    acceptsFrom: 'MOFU',
    readOnly: false,
  },
  {
    estado: 'SQL',
    label: 'Calificado',
    hint: 'Aprobado por el Director · solo lectura',
    acceptsFrom: null,
    readOnly: true,
  },
];

/** States treated as exceptions (shown outside the board). */
export const EXCEPTION_ESTADOS: LeadEstado[] = ['Reciclaje', 'Descartado'];
