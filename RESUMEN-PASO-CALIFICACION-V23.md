# RESUMEN — Calificación v2.3

**Fecha:** 2026-08-12  
**Spec:** `docs/specs/spec-calificacion.md` v2.3 (APROBADO)  
**Prompt:** `PROMPT-IMPLEMENTACION-CALIFICACION-V23.md`  
**Estado:** cerrado — DoD cumplido  
**§7 KPI:** **no** implementado (Hallazgo 6A diferido)

## Verificación prerrequisitos (EARS-01b / EARS-09)

| Chequeo | Resultado |
|---|---|
| Schema `ouvs.account_id` / `ouv_contactos.person_id` / `ouvs.segment_id` | OK (ouv-funnel v1.4) |
| `sqls.origen_creacion` + `comercial_asignado_id` | OK (demand-gen v2.5) |
| Ruta `EjecutivoComercial` → SQL `Asignado` + `directo_comercial` + `comercialAsignadoId = createdBy` | OK en `leads.service.ts` |
| `workflowEngine.transition(..., 'sql.creado_directo', ...)` **misma txn** | OK (~L941–944) |
| Regla `sql.creado_directo` en `workflow.rules.ts` | OK (sin destinatarios) |
| Calificación **no** crea SQL ni re-emite `sql.creado_directo` | OK |

## Qué se hizo

### Discovery (mínimo)
- `CrearOuvDto`: `segment_id` obligatorio + `subsegment_id` opcional (coexiste con ENUM `segmento`).
- `OuvsService.crearDesdeSql`: valida vía `DemandGenerationService.assertSegmentSubsegment` y persiste `segmentId`/`subsegmentId` (no copia subsegment del lead).

### Demand-generation (API pública)
- `assertSegmentSubsegment(segmentId, subsegmentId?)` exportado para EARS-17 sin deep-import.

### Qualification
- `SqlDetailDto` + `toDetailResponse`: exponen `origen_creacion`.
- `assign` WF payload: `comercial_asignado_id` (canónico EARS-04).
- `convertirEnOuv`: sigue orquestando → `crearDesdeSql` + update SQL + `ouv.creada_desde_sql` (sin reescribir contactos/account).

### Workflow
- `sql.asignado` destinatario: `payload.comercial_asignado_id` (fallback `comercial_id`).

### Frontend
- `ConvertirSqlEnOuvModal`: select `segment_id` / `subsegment_id` desde `GET /segments`; mapea nombre → ENUM `segmento` para coexistencia; prefill `segment_id` del lead; **no** prefill subsegment.
- Bandeja KAM + detalle: badge “Directo” si `origen_creacion = directo_comercial`.
- Roles siguen por PascalCase (`EjecutivoComercial`, `SoporteComercial`).

## Definition of Done

- [x] EARS-01b verificado + bandejas
- [x] EARS-09 sin duplicar alta/`sql.creado_directo` en calificación
- [x] EARS-12 via `crearDesdeSql`
- [x] EARS-11/15/16/17 segment_id (+ subsegment opcional)
- [x] `comercial_asignado_id` canónico en assign payload
- [x] `origen_creacion` en responses / badge UI
- [x] Roles PascalCase
- [x] §7 KPI **no** tocado
- [x] `tsc` backend + frontend OK

## Cómo probar

1. Lead ruta `EjecutivoComercial` → SQL en “Mis SQL” con badge Directo; **no** en inbox Soporte.
2. Approve MQL → SQL en inbox; assign con `comercial_asignado_id` → notificación al KAM.
3. Convertir SQL→OUV: elegir segment (+ subsegment opcional) → OUV con `segment_id`/`account_id`/contactos `person_id`.
4. Confirmar que no hay endpoints de KPI ni de crear SQL en `/qualification`.

## Archivos tocados

- `backend/src/modules/discovery/dtos/crear-ouv.dto.ts`
- `backend/src/modules/discovery/services/ouvs.service.ts`
- `backend/src/modules/demand-generation/services/demand-generation.service.ts`
- `backend/src/modules/qualification/dtos/sql-response.dto.ts`
- `backend/src/modules/qualification/services/sqls.service.ts`
- `backend/src/modules/workflow-engine/workflow.rules.ts`
- `frontend/src/modules/qualification/api/sqls-api.ts`
- `frontend/src/modules/qualification/components/ConvertirSqlEnOuvModal.tsx`
- `frontend/src/modules/qualification/pages/AssignedSqlsPage.tsx`
- `frontend/src/modules/qualification/pages/SqlDetailPage.tsx`
- `RESUMEN-PASO-CALIFICACION-V23.md`

## Fuera de alcance (como el prompt)

- KPI §7 / MQL Rate / SQL Rate
- EARS-14 descartar SQL
- Reasignación / reestructurar contactos otra vez
- Commit / PR (solo si lo pedís)
