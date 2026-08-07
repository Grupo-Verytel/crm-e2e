import { EntityType } from './enums/entity-type.enum';
import { guardEntidadEnEstado } from './guards/guard-entidad-en-estado';
import { guardUsuarioEsComercialDelSQL } from './guards/guard-usuario-es-comercial-del-sql';
import { guardUsuarioTieneRol } from './guards/guard-usuario-tiene-rol';
import type { WorkflowRule } from './types/workflow.types';

/**
 * Declarative registry for Fase A transitions (spec-workflow-engine §2 / §4.2).
 * Sole source of truth for who is notified and under which guards (EARS-13).
 *
 * Note on lead.mql_aprobado: domain estado is `MQL_PENDING` (not the shorthand
 * `MQL` in the spec example) — matches LeadEstado.MqlPending.
 *
 * sql.convertido_ouv / sql.descartado: rules registered for Fase A notify path;
 * domain consumers land with Módulo 2 / Taller T2 (spec-calificacion EARS-10+).
 */
export const workflowRules: WorkflowRule[] = [
  {
    eventType: 'lead.mql_aprobado',
    guards: [
      guardEntidadEnEstado(EntityType.LEAD, 'MQL_PENDING'),
      guardUsuarioTieneRol('DirectorMercadeo'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nuevo MQL aprobado',
    mensaje: (ctx) =>
      `El lead ${ctx.entityLabel} pasó a MQL y requiere enrutamiento.`,
  },
  {
    eventType: 'sql.creado',
    // System / WF002: no role/estado gate — SQL was just inserted as PendienteAsignacion.
    guards: [],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nuevo SQL en bandeja',
    mensaje: (ctx) =>
      `Se creó el SQL de ${ctx.entityLabel}. Pendiente de asignación.`,
  },
  {
    eventType: 'sql.asignado',
    guards: [
      guardEntidadEnEstado(EntityType.SQL, 'PendienteAsignacion'),
      guardUsuarioTieneRol('SoporteComercial'),
    ],
    destinatarios: [
      {
        tipo: 'usuario',
        resolver: (ctx) => String(ctx.payload.comercial_id ?? ''),
      },
    ],
    titulo: () => 'Nuevo SQL asignado',
    mensaje: (ctx) =>
      `Se te asignó el SQL de ${ctx.entityLabel}. Revisa tu bandeja.`,
  },
  {
    eventType: 'sql.cita_reagendada',
    guards: [
      guardEntidadEnEstado(EntityType.SQL, 'Asignado'),
      guardUsuarioTieneRol('EjecutivoComercial'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Cita reagendada',
    mensaje: (ctx) =>
      `Se reagendó la cita del SQL de ${ctx.entityLabel}.`,
  },
  {
    eventType: 'sql.convertido_ouv',
    guards: [
      guardEntidadEnEstado(EntityType.SQL, 'Asignado'),
      guardUsuarioTieneRol('EjecutivoComercial'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'SQL convertido a OUV',
    mensaje: (ctx) =>
      `El SQL de ${ctx.entityLabel} fue convertido a OUV.`,
  },
  {
    eventType: 'sql.descartado',
    guards: [
      guardEntidadEnEstado(EntityType.SQL, 'Asignado'),
      guardUsuarioTieneRol('EjecutivoComercial'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'DirectorMercadeo' },
    ],
    titulo: () => 'SQL descartado',
    mensaje: (ctx) =>
      `El SQL de ${ctx.entityLabel} fue descartado.`,
  },
  {
    eventType: 'ouv.creada',
    guards: [
      guardEntidadEnEstado(EntityType.SQL, 'Asignado', (ctx) =>
        String(ctx.payload.sqlId ?? ''),
      ),
      guardUsuarioEsComercialDelSQL,
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'DirectorComercial' },
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nueva OUV creada',
    mensaje: (ctx) =>
      `Se creó la OUV ${ctx.entityLabel} a partir de un SQL.`,
  },
];

/** Lookup helper used by WorkflowEngineService. */
export function findWorkflowRule(eventType: string): WorkflowRule | undefined {
  return workflowRules.find((rule) => rule.eventType === eventType);
}
