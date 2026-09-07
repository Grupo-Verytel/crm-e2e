# Module: offer-closing (api)

Propuestas (versionadas), contratos, QA documental jur/tec/eco, firma, venta declarada.

## Boundaries (see .cursor/rules/700-modules.mdc)
- Expose ONE public service + DTOs/events. No deep imports from other modules.
- Cross-module access goes through the other module's public service only.
- Shared code -> libs/.

## Wave
Commercial phase — build in its assigned sprint (work plan).

## Implementado

### Kickoff (`api/v1/offer-closing/ouvs/:ouvId/kickoff`)

Un kickoff por OUV, persistido en MySQL. Antes vivía en `localStorage`, lo que
dejaba el vínculo con el evento real de Microsoft 365 (`graph_event_id`) fuera
del alcance del resto de usuarios: nadie más veía el estado ni podía cancelar o
reagendar la reunión.

| Método | Acción CASL | Descripción |
| --- | --- | --- |
| `GET` | `read Kickoff` | Devuelve `{ kickoff }`; `null` si la OUV aún no lo agendó (no es 404). |
| `PUT` | `update Kickoff` | Upsert: reemplaza el kickoff completo, invitados y aprobaciones, en una transacción. |
| `DELETE` | `delete Kickoff` | Borra el kickoff y cancela en Microsoft 365 el evento asociado (best-effort). |

Tablas: `kickoffs`, `kickoff_invitees`, `kickoff_approvals`
(migración `20260905120000-create-kickoff-tables`).

`kickoffs.active_ouv_id` es una columna generada (`ouv_id` mientras la fila está
viva, `NULL` tras el soft-delete) con índice único: garantiza un solo kickoff
activo por OUV sin impedir volver a agendar después de eliminarlo — en MySQL un
índice único sobre `(ouv_id, deleted_at)` no serviría, porque admite duplicados
cuando la columna es `NULL`.

Permisos (migración `20260905120100-kickoff-permissions`): agendan
`EjecutivoComercial` y `SoporteComercial`; consultan `PMO`, `DirectorMercadeo`,
`Preventa` y `Pricing`; `Admin` todo.

La cancelación en Microsoft 365 la hace `GraphIntegrationModule`.
