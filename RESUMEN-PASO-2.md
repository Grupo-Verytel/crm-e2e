# RESUMEN-PASO-2 — Services de dominio (embudo OUV v1.2)

**Fecha:** 2026-08-07  
**Estado:** completado — esperando aprobación humana antes del PASO 3  
**Build:** `npm run build` (backend) **OK**

---

## Servicios creados / extendidos

| Service | Métodos |
|---|---|
| **OuvsService** (extendido) | `crearDesdeSql` (+ leadId, copia contactos, seed influencias/checklist UNIVERSO, `empresa_nombre` desde lead), `crearDirecta`, `avanzarZona`, `retrocederZona`, `ganar`, `perder`, `descartar`, `actualizarPresupuesto`, `listarPorComercial` |
| **OuvContactosService** (nuevo) | `crearDesdeLead`, `crear`, `actualizar`, `eliminar` (soft-delete + null FKs en influencias), `listByOuv` |
| **OuvInfluenciasService** (nuevo) | `seedInfluenciasParaOuv`, `listByOuv`, `actualizarEstado` (+ validación mismo OUV), `countVerde` |
| **OuvChecklistService** (nuevo) | `seedChecklistParaZona`, `listByOuvZona`, `marcarItem` |
| **CriteriosZonaEvaluator** (nuevo) | `evaluate` → persiste `tiene_gap` / `criterios_faltantes`; emite `ouv.criterios_perdidos` / `ouv.criterios_recuperados` |

Helper: `lib/ouv-zona-order.ts` (`nextZona` / `prevZona` / `zonaRank`).

---

## Contrato regla 800

Todas las mutaciones de estado/negocio usan:
1. `sequelize.transaction`
2. `findByPk` + `lock: UPDATE` sobre la OUV (o entidad protagonista)
3. Assert de ownership (`comercial_id`) y de `resultado === EnCurso` (o zona para Ganada)
4. `workflowEngine.transition(..., transaction)` con `ctx.entity.estado` = valor leído bajo lock

---

## Límites de módulo

- Copia de contactos vía **`DemandGenerationService.findLeadById`** (API pública) — no se importa el modelo `LeadContact`.
- `DiscoveryModule` importa `DemandGenerationModule` + `WorkflowEngineModule`.
- `SqlsService.convertirEnOuv` ahora pasa `leadId` a `crearDesdeSql`.
- Evento de conversión sigue siendo **`ouv.creada`** (R8 — renombre en PASO 3).

---

## Eventos que invocan `transition` (reglas en PASO 3)

Los métodos ya emiten estos `eventType`. **Hasta PASO 3 fallarán en runtime** con `WorkflowRuleNotFoundException` (excepto el flujo SQL→OUV que usa `ouv.creada`):

| Evento | Origen |
|---|---|
| `ouv.creada_directa` | `crearDirecta` |
| `ouv.avance_zona` / `ouv.retroceso_zona` | avance / retroceso |
| `ouv.contacto_creado` / `ouv.contacto_eliminado` | contactos |
| `ouv.influencia_cambio` | influencias |
| `ouv.checklist_item_marcado` | checklist |
| `ouv.presupuesto_actualizado` | presupuesto |
| `ouv.criterios_perdidos` / `ouv.criterios_recuperados` | evaluator |
| `ouv.ganada` + `ouv.lista_para_implementacion` | ganar |
| `ouv.perdida` / `ouv.descartada` | perder / descartar |

---

## Criterios de gap (evaluator)

| Zona actual | Criterios duros |
|---|---|
| `UNIVERSO` | ninguno |
| `ENCIMA_FUNNEL`+ | `presupuesto_confirmado` |
| `EN_FUNNEL`+ | `presupuesto_confirmado` + ≥2 influencias `Verde` |

Códigos en `criterios_faltantes`: `presupuesto_confirmado`, `influencias_verde`.

---

## DTOs añadidos (prep. PASO 4)

- `crear-ouv-directa.dto.ts`
- `listar-ouvs-query.dto.ts`
- `cierre-ouv.dto.ts` (ganar / perder / descartar / retroceder)
- `actualizar-presupuesto.dto.ts`
- `ouv-contacto.dto.ts`
- `actualizar-influencia.dto.ts`
- `marcar-checklist-item.dto.ts`

---

## Archivos tocados

**Creados:** services + DTOs + `lib/ouv-zona-order.ts` listados arriba.  
**Modificados:** `ouvs.service.ts`, `discovery.module.ts`, `sqls.service.ts` (`leadId`).

---

## Sugerencias post-implementación

1. Seed de `zona_checklist_templates` + motivos — sin seed, checklist UNIVERSO nace vacío.
2. Ganada con `motivo_id` opcional reutiliza lookup en `motivos_perdida` (no hay catálogo de motivos de ganancia). Valorar catálogo propio o quitar validación.
3. PASO 3 debe registrar las reglas antes de ejercitar `crearDirecta` / avance / cierre en E2E.
4. `actualizar` de contacto no emite evento (spec no lo pide); solo crear/eliminar.

---

## DETENERSE

PASO 2 listo. **No avanzo al PASO 3** hasta tu aprobación explícita.
