# RESUMEN-PASO-2.1 — Correcciones de backend

**Fecha:** 2026-09-24  
**Estado:** listo para revisión. Sin merge y sin push. El frontend no se tocó.

## 1. Creación de OUV

`seedInfluenciasParaOuv` ya no existe. `crearDesdeSql` y `crearDirecta` no insertan filas en `ouv_influencias`. La migración `20260916120000` solo sembró Usuario/Coach en OUVs que ya existían en ese momento; no corre al crear una OUV nueva. No hay seed ni fixture que inserte placeholders con `contacto_ouv_id` NULL.

`listByOuv` de una OUV sin filas devuelve `influencias: []` y `filtro: { passed: false, greenTypes: [], required: 2 }`. Cubierto por test.

Tests: `ouv-creacion-sin-influencias.spec.ts` (desde SQL y directa, sin error y sin seed de influencias).

## 2. Auditoría D5

`AuditService.recordChange` (el writer append-only de `registrar-auditoria`) escribe una fila por operación:

| Operación | Dónde | Acción |
|---|---|---|
| Alta | `OuvInfluenciasService.agregarContacto` | `INSERT` |
| Restore de terna soft-deleted | el mismo método, antes de resetear a `SinEvaluar` y nota null | `INSERT` |
| Baja | `quitarContacto` | `DELETE` |
| Nota | `editarNota` | `UPDATE` |
| Calificación | `calificar` | `STATE_CHANGE` |
| Quitar el contacto de la OUV | `OuvContactosService.eliminar` | un `DELETE` por cada fila de influencia de ese contacto |

Tests en `ouv-influencias.service.spec.ts` y `ouv-contactos-influencia-audit.spec.ts`.

## 3. Filtro D3 en la transición

La validación anterior (`countVerde` / `verdeWithAssignedContactWhere`) quedó reemplazada por `evaluateInfluenceFilter`.

| Lugar | Función |
|---|---|
| `ouvs.service.ts` | `assertGuardsForDestino` — llama `filtroForOuv` y, si no pasa, lanza `InfluenciaProblemException` 422 |
| `criterios-zona.evaluator.ts` | `computeFaltantes` — si no pasa, agrega `influencias_verde` |
| `ouv-influencias.service.ts` | `listByOuv` y `filtroForOuv` |

El `detail` del bloqueo es: `Se requieren 2 tipos de influencia en Verde (Económica, Técnica, Fábrica). Actualmente: 1 (Económica).` El filtro HTTP lo emite `InfluenciaProblemFilter` como `application/problem+json`. Test en `ouv-creacion-sin-influencias.spec.ts`.

## 4. POST

`POST /api/v1/discovery/ouvs/:id/influencias/:tipo/contactos` responde **201** (`@HttpCode(HttpStatus.CREATED)`). También quedó anotado en `RESUMEN-PASO-2-influencias-multi-contacto.md`.

## 5. OUV `5f0adb9a-04b7-56aa-ba9c-3b55f41ed882` (solo lectura)

| Campo | Valor |
|---|---|
| Consecutivo | `OUV-0388` |
| Zona | `UNIVERSO` |
| Resultado | `EnCurso` |
| Influencias vivas | Económica `SinEvaluar`, Técnica `Verde`, Usuario `SinEvaluar` |
| D3 | No cumple. Solo 1 tipo del filtro en `Verde` (Técnica). |

No se modificó.

## 6. Base y certificación

La única base configurada en este repo es `crm_e2e` en el RDS `xtam-video-dev`. No hay un segundo host ni un segundo schema de certificación. No puedo confirmar otro ambiente: si el equipo llama «certificación» a esa misma base, es la que ya migró el Paso 2.

## Tests

`npx tsc --noEmit` OK. 20 tests de este paso en verde (creación, filtro vacío, auditoría, bloqueo 422 y los 7 casos D3).

## Detención

Paso 3 no iniciado. Sin merge y sin push a `develop`.
