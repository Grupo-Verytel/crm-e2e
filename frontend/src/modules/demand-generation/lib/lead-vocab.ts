import type { CanalOrigen, LeadEstado, Segmento } from '../types';

/**
 * Business vocabulary for the Gestor/Director de Mercadeo.
 * Spec §1 / §4: machine is TOFU → MOFU → BOFU (persisted as MQL_PENDING) → SQL.
 * Keep this map as the single source of truth so badges, columns and filters never diverge.
 */
export const LEAD_ESTADO_LABEL: Record<LeadEstado, string> = {
  Nuevo: 'Nuevo',
  TOFU: 'TOFU',
  MOFU: 'MOFU',
  MQL_PENDING: 'BOFU',
  SQL: 'SQL',
  Reciclaje: 'En reciclaje',
  Descartado: 'Descartado',
};

export function leadEstadoLabel(estado: string): string {
  return LEAD_ESTADO_LABEL[estado as LeadEstado] ?? estado;
}

export const CANAL_ORIGEN_LABEL: Record<CanalOrigen, string> = {
  CAMPANA_DIGITAL: 'Marketing Digital',
  BTL: 'BTL',
  FABRICA: 'Fábrica',
  GENERACION_DEMANDA_AGENCIA: 'Generación de demanda (agencia)',
  TRADUCTOR_NEGOCIO: 'Traductor de negocio',
  EVENTOS: 'Eventos',
};

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
 * The four guided board lanes, in flow order (spec §4). Reciclaje/Descartado are
 * NOT lanes — they are exception states. SQL is a read-only destination: the
 * promotion to SQL is the Director's decision in the MQL inbox, never a drag.
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
    label: 'Por Contactar - TOFU',
    hint: 'Captados, aún sin primera interacción',
    acceptsFrom: null,
    readOnly: false,
  },
  {
    estado: 'MOFU',
    label: 'En nutrición - MOFU',
    hint: 'Con interacción; trabajando el checklist',
    acceptsFrom: 'TOFU',
    readOnly: false,
  },
  {
    estado: 'MQL_PENDING',
    label: 'Pendiente aprobación - BOFU',
    hint: 'Checklist completo; espera al Director',
    acceptsFrom: 'MOFU',
    readOnly: false,
  },
  {
    estado: 'SQL',
    label: 'SQL',
    hint: 'Aprobado por el Director · solo lectura',
    acceptsFrom: null,
    readOnly: true,
  },
];

/** Spec §4.1 — applicable states per canal_origen (BOFU = MQL_PENDING). */
export const CHANNEL_ROUTES: Partial<Record<CanalOrigen, KanbanEstado[]>> = {
  CAMPANA_DIGITAL: ['TOFU', 'MOFU', 'MQL_PENDING', 'SQL'],
  BTL: ['TOFU', 'MOFU', 'MQL_PENDING', 'SQL'],
  FABRICA: ['TOFU', 'MQL_PENDING', 'SQL'],
  GENERACION_DEMANDA_AGENCIA: ['MOFU', 'MQL_PENDING', 'SQL'],
  EVENTOS: ['TOFU', 'MOFU', 'MQL_PENDING', 'SQL'],
};

/** States treated as exceptions (shown outside the board). */
export const EXCEPTION_ESTADOS: LeadEstado[] = ['Reciclaje', 'Descartado'];
