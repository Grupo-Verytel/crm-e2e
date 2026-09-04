import { EntityType } from './enums/entity-type.enum';
import { guard2InfluenciasEnVerde } from './guards/guard-2-influencias-en-verde';
import { guardEntidadEnEstado } from './guards/guard-entidad-en-estado';
import { guardPresupuestoConfirmado } from './guards/guard-presupuesto-confirmado';
import { guardUsuarioEsComercialDelOUV } from './guards/guard-usuario-es-comercial-del-ouv';
import { guardUsuarioEsComercialDelSQL } from './guards/guard-usuario-es-comercial-del-sql';
import { guardUsuarioTieneRol } from './guards/guard-usuario-tiene-rol';
import type { WorkflowRule } from './types/workflow.types';

/**
 * Declarative registry for Fase A transitions (spec-workflow-engine §2 / §4.2).
 * OUV funnel events: spec-ouv-funnel v1.2 §6 (Adenda A — no DirectorComercial).
 *
 * CriteriosZonaEvaluator is invoked from discovery services (PASO 2), not from
 * rule side-effects — WorkflowRule has no sideEffect hook in Fase A.
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
    guards: [],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nuevo SQL en bandeja',
    mensaje: (ctx) =>
      `Se creó el SQL de ${ctx.entityLabel}. Pendiente de asignación.`,
  },
  {
    // Ruta EjecutivoComercial (demand-gen EARS-29 / calificación EARS-09):
    // audit_log only — no enrutamiento / sin destinatarios.
    eventType: 'sql.creado_directo',
    guards: [],
    destinatarios: [],
    titulo: () => 'SQL creado por ruta directa comercial',
    mensaje: (ctx) =>
      `Se creó el SQL de ${ctx.entityLabel} (ruta directa, ya asignado).`,
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
        resolver: (ctx) =>
          String(
            ctx.payload.comercial_asignado_id ?? ctx.payload.comercial_id ?? '',
          ),
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

  // ─── OUV funnel (spec-ouv-funnel v1.2) ─────────────────────────────

  {
    eventType: 'ouv.creada_desde_sql',
    guards: [
      guardEntidadEnEstado(EntityType.SQL, 'Asignado', (ctx) =>
        String(ctx.payload.sqlId ?? ''),
      ),
      guardUsuarioEsComercialDelSQL,
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nueva OUV creada desde SQL',
    mensaje: (ctx) =>
      `Se creó la OUV ${ctx.entityLabel} a partir de un SQL.`,
  },
  {
    eventType: 'ouv.creada_directa',
    guards: [guardUsuarioTieneRol('EjecutivoComercial')],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nueva OUV directa',
    mensaje: (ctx) =>
      `Se creó la OUV directa ${ctx.entityLabel} (${String(ctx.payload.empresa_nombre ?? '')}).`,
  },
  {
    eventType: 'ouv.avance_zona',
    guards: [
      guardUsuarioEsComercialDelOUV,
      guardUsuarioTieneRol('EjecutivoComercial'),
      guardPresupuestoConfirmado,
      guard2InfluenciasEnVerde,
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'OUV avanzó de zona',
    mensaje: (ctx) =>
      `${ctx.entityLabel}: ${String(ctx.payload.zona_anterior ?? '')} → ${String(ctx.payload.zona_nueva ?? '')}.`,
  },
  {
    eventType: 'ouv.retroceso_zona',
    guards: [
      guardUsuarioEsComercialDelOUV,
      guardUsuarioTieneRol('EjecutivoComercial'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'OUV retrocedió de zona',
    mensaje: (ctx) =>
      `${ctx.entityLabel} retrocedió a ${String(ctx.payload.zona_nueva ?? '')}. Motivo: ${String(ctx.payload.motivo ?? '')}.`,
  },
  {
    // audit_log only (empty destinatarios) — engine still records STATE_CHANGE
    eventType: 'ouv.contacto_creado',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [],
    titulo: () => 'Contacto OUV creado',
    mensaje: (ctx) =>
      `Contacto creado en ${ctx.entityLabel}: ${String(ctx.payload.nombre ?? '')}.`,
  },
  {
    eventType: 'ouv.contacto_eliminado',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [],
    titulo: () => 'Contacto OUV eliminado',
    mensaje: (ctx) =>
      `Contacto eliminado en ${ctx.entityLabel}: ${String(ctx.payload.nombre ?? '')}.`,
  },
  {
    // Evaluator runs in OuvInfluenciasService after transition (PASO 2)
    eventType: 'ouv.influencia_cambio',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [],
    titulo: () => 'Influencia OUV actualizada',
    mensaje: (ctx) =>
      `${ctx.entityLabel}: influencia ${String(ctx.payload.tipo ?? '')} → ${String(ctx.payload.estado_nuevo ?? '')}.`,
  },
  {
    eventType: 'ouv.checklist_item_marcado',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [],
    titulo: () => 'Checklist OUV actualizado',
    mensaje: (ctx) =>
      `${ctx.entityLabel}: item ${String(ctx.payload.codigo_item ?? '')} marcado=${String(ctx.payload.marcado ?? '')}.`,
  },
  {
    eventType: 'ouv.presupuesto_actualizado',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [],
    titulo: () => 'Presupuesto OUV actualizado',
    mensaje: (ctx) =>
      `${ctx.entityLabel}: presupuesto_confirmado=${String(ctx.payload.presupuesto_confirmado ?? '')}.`,
  },
  {
    eventType: 'ouv.criterios_perdidos',
    guards: [],
    destinatarios: [
      {
        tipo: 'usuario',
        resolver: (ctx) => String(ctx.payload.comercial_id ?? ''),
      },
    ],
    titulo: () => 'OUV con gap de criterios',
    mensaje: (ctx) =>
      `${ctx.entityLabel} perdió criterios: ${JSON.stringify(ctx.payload.criterios_faltantes ?? [])}.`,
  },
  {
    // Silencioso: sin destinatarios (dedup/resolución vía historial)
    eventType: 'ouv.criterios_recuperados',
    guards: [],
    destinatarios: [],
    titulo: () => 'OUV recuperó criterios',
    mensaje: (ctx) => `${ctx.entityLabel} ya no tiene gap de criterios.`,
  },
  {
    eventType: 'ouv.ganada',
    guards: [
      guardUsuarioEsComercialDelOUV,
      guardEntidadEnEstado(EntityType.OUV, 'MAYOR_PROBABILIDAD'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'OUV ganada',
    mensaje: (ctx) => `La OUV ${ctx.entityLabel} se marcó como Ganada.`,
  },
  {
    eventType: 'ouv.perdida',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'OUV perdida',
    mensaje: (ctx) =>
      `La OUV ${ctx.entityLabel} se marcó como Perdida (${String(ctx.payload.motivo_snapshot ?? '')}).`,
  },
  {
    eventType: 'ouv.descartada',
    guards: [guardUsuarioEsComercialDelOUV],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'OUV descartada',
    mensaje: (ctx) =>
      `La OUV ${ctx.entityLabel} se marcó como Descartada (${String(ctx.payload.motivo_snapshot ?? '')}).`,
  },
  {
    eventType: 'ouv.lista_para_implementacion',
    guards: [],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'OUV lista para implementación',
    mensaje: (ctx) =>
      `La OUV ${ctx.entityLabel} está lista para Paso a Implementación (Módulo 7).`,
  },

  // ─── Implementación — integración PMO (Control Project) ────────────

  {
    // Ingesta del webhook del PMO: sin guards, el CRM no valida la transición.
    eventType: 'ouv.estado_proyecto_cambiado',
    guards: [],
    destinatarios: [
      {
        tipo: 'usuario',
        resolver: (ctx) => String(ctx.payload.comercial_id ?? ''),
      },
    ],
    dedupDiscriminator: (ctx) => String(ctx.payload.external_event_id ?? ''),
    titulo: () => 'Cambio de estado del proyecto',
    mensaje: (ctx) =>
      `El proyecto de ${ctx.entityLabel} pasó a estado ${ctx.estadoNuevo}.`,
  },
];

/** Lookup helper used by WorkflowEngineService. */
export function findWorkflowRule(eventType: string): WorkflowRule | undefined {
  return workflowRules.find((rule) => rule.eventType === eventType);
}
