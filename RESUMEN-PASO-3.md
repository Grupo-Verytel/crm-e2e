# RESUMEN-PASO-3 — Guards + reglas del motor + renombrado `ouv.creada`

**Fecha:** 2026-08-07  
**Estado:** completado — esperando aprobación humana antes del PASO 4  
**Build:** `npm run build` **OK**  
**Tests:** `ouv-funnel.guards` + `guard-entidad-en-estado` → **14/14 OK**

---

## Renombrado `ouv.creada` → `ouv.creada_desde_sql`

| Archivo | Cambio |
|---|---|
| `workflow.rules.ts` | `eventType: 'ouv.creada_desde_sql'` |
| `sqls.service.ts` (`convertirEnOuv`) | `transition(..., 'ouv.creada_desde_sql', ...)` |
| `backend/src/**` | **0** referencias restantes a `'ouv.creada'` |

Histórico en `notifications` con `event_type = 'ouv.creada'` se deja (spec).

---

## Guards nuevos

| Guard | Archivo | Comportamiento |
|---|---|---|
| `guardPresupuestoConfirmado` | `guards/guard-presupuesto-confirmado.ts` | Obligatorio solo si `zona_nueva === ENCIMA_FUNNEL`; lee `payload.presupuesto_confirmado` |
| `guard2InfluenciasEnVerde` | `guards/guard-2-influencias-en-verde.ts` | Obligatorio si destino `EN_FUNNEL` / `MAYOR_PROBABILIDAD`; lee `payload.influencias_verde_count` (calculado en service bajo lock) |
| `guardUsuarioEsComercialDelOUV` | `guards/guard-usuario-es-comercial-del-ouv.ts` | `actorUserId === payload.comercial_id` |

`OuvsService.avanzarZona` ahora envía `presupuesto_confirmado` + `influencias_verde_count` en el payload.  
`ganar` pasa `entity.estado = zonaActual` (`MAYOR_PROBABILIDAD`) para el guard de estado.

---

## Reglas nuevas en `workflow.rules.ts`

| eventType | Guards | Destinatarios |
|---|---|---|
| `ouv.creada_desde_sql` | SQL `Asignado` + comercial del SQL | SoporteComercial |
| `ouv.creada_directa` | `guardUsuarioTieneRol('EjecutivoComercial')` | SoporteComercial |
| `ouv.avance_zona` | comercial OUV + Ejecutivo + presupuesto + 2 verdes | SoporteComercial |
| `ouv.retroceso_zona` | comercial OUV + Ejecutivo | SoporteComercial |
| `ouv.contacto_creado` | comercial OUV | _(vacío — audit only)_ |
| `ouv.contacto_eliminado` | comercial OUV | _(vacío — audit only)_ |
| `ouv.influencia_cambio` | comercial OUV | _(vacío; evaluator en service)_ |
| `ouv.checklist_item_marcado` | comercial OUV | _(vacío; evaluator en service)_ |
| `ouv.presupuesto_actualizado` | comercial OUV | _(vacío; evaluator en service)_ |
| `ouv.criterios_perdidos` | — | usuario `comercial_id` (dedup en persister) |
| `ouv.criterios_recuperados` | — | _(vacío — silencioso)_ |
| `ouv.ganada` | comercial OUV + zona `MAYOR_PROBABILIDAD` | SoporteComercial |
| `ouv.perdida` | comercial OUV | SoporteComercial |
| `ouv.descartada` | comercial OUV | SoporteComercial |
| `ouv.lista_para_implementacion` | — | SoporteComercial |

**No agregados (Wave 2):** `ouv.reabierta`, `ouv.ganada_con_override`.  
**Roles usados:** solo `EjecutivoComercial`, `SoporteComercial`, `DirectorMercadeo`, `GestorMercadeo` (existentes). **Sin** `DirectorComercial`.

---

## CriteriosZonaEvaluator como “side effect”

`WorkflowRule` Fase A no tiene hook `sideEffect`. El evaluator sigue invocándose desde los services de discovery (PASO 2) tras `influencia_cambio` / `checklist_item_marcado` / `presupuesto_actualizado`. Las reglas quedan registradas para audit/notify.

---

## Confirmación tests

- Renombrado no rompe `guard-entidad-en-estado` (5 tests).
- Nuevos guards: 9 tests en `ouv-funnel.guards.spec.ts`.
- Total corrido: **14/14 passed**.

---

## Sugerencias post-implementación

1. Si se quiere query real en `guard2InfluenciasEnVerde` (DI de modelo), extender `WorkflowGuardContext` en Fase B — hoy el count viene del service (alineado al contrato 800).
2. Actualizar skill/regla `800` / ejemplos que aún digan `ouv.creada`.

---

## DETENERSE

PASO 3 listo. **No avanzo al PASO 4** hasta tu aprobación explícita.
