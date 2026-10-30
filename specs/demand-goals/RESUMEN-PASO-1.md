# RESUMEN-PASO-1 — Metas de generación de demanda (spec EARS)

Fecha: 2026-10-29. Sin código de producto.

## Entrega

Spec EARS en `specs/demand-goals/spec.md`. Decisiones aprobadas del Paso 0 en `specs/decisions/2026-10-29-metas-generacion-demanda.md`.

Incorpora D1–D5 y A1–A3.

El spec cubre:

- esquema nuevo de `marketing_dashboard_targets` (año fiscal, Q, métrica, meta semanal) y el no-heredar 50 / 3 / 3;
- una migración que crea la tabla en una base limpia y transforma el grano viejo si `period_type` existe, con `down` y los casos T1–T5;
- `GET` / `PUT /api/v1/dashboard/marketing/goals` y `DELETE .../goals/:id`, subject `DemandGoal` solo para `DirectorMercadeo` y `Admin`;
- prorrateo dentro de `GET /dashboard/marketing`, en `weekly.goals`, dejando los contadores numéricos;
- `target: null` sin periodo («Selecciona un período») y `target: 0` con periodo sin meta («Sin meta definida»);
- auditoría solo por `AuditHooksService`;
- engranaje según `user.permissions`, barra con los tres cortes y copy «Convertidos a OUV».

## Base compartida con el diseño

Eliminar `period_type`, `interactions`, `period_leads` y `converted_ouvs` rompe `crm-e2e-DesignJD` si sigue usando esta misma base local.

Ese repo lee y escribe la tabla con el grano viejo:

- modelo `backend/src/modules/demand-generation/models/marketing-dashboard-target.model.ts` (`periodType`, `interactions`, `periodLeads`, `convertedOuvs`);
- `GET` y `PUT /dashboard/marketing/targets`;
- el modal `MarketingDashboardTargetsModal`.

Después de migrar, ese modelo deja de coincidir con las columnas y el tablero de diseño falla al leer o guardar metas. `crm-e2e` no modifica ese repo. Quien use los dos contra el mismo MySQL tiene que quedarse en un solo esquema.

El `down` de T2 devuelve el grano viejo desde el snapshot. Eso reabre el diseño solo si no hay metas vivas del esquema nuevo; si ya las hay, el `down` aborta.

## Pendiente

`/demand/dashboard` sigue respondiendo por URL para roles que no tienen la pestaña (`TraductorDeNegocio`, `ProductManager`), si el API les deja leer `Lead`. Este paso no lo cambia.

## Pruebas

No aplica. No hay código de producto en este paso. T1–T5 y el prorrateo quedan como criterios del spec para el paso de backend.

## STOP

Sin paso de backend hasta que se apruebe `specs/demand-goals/spec.md`.

Sin hallazgos pendientes — listo para aprobación.
