# RESUMEN-PASO-2 — Influencias multi-contacto (backend)

**Fecha:** 2026-09-24  
**Estado:** completado en `crm_e2e` (RDS dev). No correr esta migración en otro ambiente: se descartó 1 nota.  
`RESUMEN-PASO-2.md` de agosto no se tocó.

## Migración

`backend/database/migrations/20260924120000-ouv-influencias-multi-contacto.js`

Primera ejecución (los datos ya no estaban en los reintentos):

| Medida | Valor |
|---|---|
| Filas sin contacto eliminadas | 1519 |
| De esas, en `Verde` | 1 |
| `ouv_id` | `5f0adb9a-04b7-56aa-ba9c-3b55f41ed882` |
| Notas descartadas (solo el número) | 1 |
| Auditorías `Amarillo` → `SinEvaluar` | 1 |

La fila en `Verde` sin contacto se eliminó con las demás, como se aprobó. El texto de la nota no quedó en `audit_log` ni en otra tabla.

El índice `uq_ouv_influencias_ouv_tipo` no se podía soltar mientras fuera el único índice de la FK `ouv_id`. El `up` crea antes `uq_ouv_influencias_ouv_tipo_contacto`. La FK de `contacto_ouv_id` era `ON DELETE SET NULL`, incompatible con `NOT NULL`; pasó a `ON DELETE RESTRICT`. El borrado de un contacto de la OUV hace soft-delete de sus filas de influencia en el servicio.

`down` restaura el enum con `Amarillo`, la nulabilidad y el único `(ouv_id, tipo)`. No devuelve valores `Amarillo`, notas descartadas ni filas placeholder. Si hay varios contactos por tipo, conserva una fila por `(ouv_id, tipo)`.

## Endpoints

Prefijo `/api/v1/discovery/ouvs/:id`. CASL: lectura `read` Opportunity, mutaciones `update` Opportunity. Errores de regla: `application/problem+json` (`type`, `title`, `status`, `detail` en español).

| Método | Ruta | Body | Respuesta |
|---|---|---|---|
| GET | `/influencias` | — | `{ influencias: [...], filtro: { passed, greenTypes, required: 2 } }` |
| POST | `/influencias/:tipo/contactos` | `{ contacto_ouv_id }` | fila, **201** (`@HttpCode(HttpStatus.CREATED)`) |
| DELETE | `/influencias/:tipo/contactos/:contactoOuvId` | — | 204 |
| PATCH | `/influencias/:tipo/contactos/:contactoOuvId/estado` | `{ estado }` | fila |
| PATCH | `/influencias/:tipo/contactos/:contactoOuvId/notas` | `{ notas }` máx. 1000 | fila |

Cada fila: `influencia_id`, `ouv_id`, `tipo`, `estado`, `contacto_ouv_id`, `notas`, `motivo_estado`, `fecha_ultimo_cambio`, `created_at`.

Alta de una terna soft-deleted: `restore`, `estado` = `SinEvaluar`, `notas` = null. Máximo 5 y unicidad dentro de la transacción con lock de la OUV. El PATCH por tipo dejó de existir.

## Tests

27 pasaron:

- `evaluate-influence-filter.spec.ts` — 7 casos D3
- `ouv-influencias.service.spec.ts` — 6º contacto, contacto repetido, nota de 1001, auditoría de calificación
- `actualizar-influencia.dto.spec.ts` y `ouv-funnel.guards.spec.ts`

`npx tsc -p tsconfig.json --noEmit` OK.

## Detención

Paso 3 (frontend) no iniciado. El GET ya no devuelve un array; la ficha actual se rompe hasta ese paso. No migrar otro ambiente mientras la nota descartada (1) no esté aceptada ahí.
