# RESUMEN-PASO-2a — POST /qualification/sqls/:id/cita

**Fecha:** 2026-09-23
**Estado:** backend listo. V1–V3 verificados sin cambio de lógica. El frontend está en `RESUMEN-PASO-2b.md`.

## Qué quedó

`POST /qualification/sqls/:id/cita` llama a `createCitaForAssignedSql`.

- Solo si `sql.estado` es `Asignado`. No escribe `comercial_asignado_id`, `estado` ni `fecha_asignacion`.
- Lo pueden llamar SoporteComercial, o el EjecutivoComercial cuyo id es `comercial_asignado_id`. Admin no está en esa lista y recibe 403.
- El guard CASL es `update` sobre `Opportunity`, el subject de este repo. El diseño usa subject `Sql`; no se renombró.
- Sin fila en `sql_citas`: crea la fila y un evento de Teams (`createTeamsMeetingForCita`) con el comercial ya asignado.
- Con fila cuya cita ya pasó: crea un evento nuevo y sobrescribe fecha, hora, contactos, link y `graph_event_id`. No llama a `updateTeamsMeetingForCita`. El evento anterior queda en Teams.
- Con cita vigente: 400 `CITA_VIGENTE_EXISTS`, sin llamar a Teams.
- `PATCH /qualification/sqls/:id/cita` no cambió. Soporte sigue sin poder reagendar.
- Cada cita de la API incluye `vigente` (inicio >= ahora en `America/Bogota`). Lo calcula `isCitaVigente`. No hay columna nueva ni migración.

## Auditoría (A2) y V1

`createCitaForAssignedSql` persiste la cita pasada con `existing.update(...)`. En Sequelize 6 ese método de instancia llama a `save()`, y `save()` dispara `afterUpdate` antes de limpiar `changed()` y `_previousDataValues`. No usa `Model.update()` estático ni QueryBuilder.

`AuditHooksService.afterUpdate` escribe un `UPDATE` por columna. El test `SoporteComercial replacing a past cita writes UPDATE audit rows...` registra el hook real y comprueba `valor_anterior` / `valor_nuevo` de `fecha`, `hora`, `teams_join_url` y `graph_event_id`.

## V2 — fallo de Graph, igual que `assign`

No se agregó compensación. `createTeamsMeetingForCita` lanza `TEAMS_MEETING_FAILED` y no borra el evento.

En `assign`, la fila se inserta dentro de la transacción y después se llama a Graph. Si Graph falla, la transacción revierte la fila. Si Graph ya creó el evento y luego falla la escritura de `graph_event_id` o el workflow, la transacción revierte la base y el evento queda huérfano.

En `createCitaForAssignedSql` Graph se llama antes de escribir `sql_citas`. Si Graph falla, no hay cambio confirmado en la cita. Si Graph crea el evento y después falla el `create` o el `update` de la fila, la transacción revierte la base y el evento nuevo queda huérfano. En el reemplazo de una cita pasada, el evento anterior no se tocó. No hay `delete` de Graph en ninguno de los dos caminos.

## V3 — SoporteComercial

El caso feliz de alta sin cita previa está en `SoporteComercial creates a Teams meeting...`. El reemplazo de una cita pasada por SoporteComercial es el test de auditoría de V1.

## Tests

`npx jest src/modules/qualification/lib/cita-vigencia.spec.ts src/modules/qualification/services/sqls.service.spec.ts`

10 tests en verde, incluidos el alta de SoporteComercial, el reemplazo de cita pasada con filas `UPDATE` de auditoría, 400 `CITA_VIGENTE_EXISTS`, 403 si el Ejecutivo no es el dueño y 400 si el estado no es `Asignado`.

## Archivos

- `backend/src/modules/qualification/controllers/sqls.controller.ts`
- `backend/src/modules/qualification/services/sqls.service.ts`
- `backend/src/modules/qualification/services/sqls.service.spec.ts`
- `backend/src/modules/qualification/dtos/assign-sql.dto.ts` (`CreateAssignedSqlCitaDto`)
- `backend/src/modules/qualification/dtos/sql-response.dto.ts` (`vigente`)
- `backend/src/modules/qualification/constants/qualification.constants.ts`
- `backend/src/modules/qualification/lib/cita-vigencia.ts`
- `backend/src/modules/qualification/lib/cita-vigencia.spec.ts`

## Nota para el Paso 2b

No hay un formulario de cita extraído de `AssignSqlModal`. Sí existen `CitaContactosFields` y `CitaAvailabilityGrid`. El modal de Agendar/Reagendar en SQL asignados no debe modificar `AssignSqlModal`.

Matriz de la columna Acción (estado `Asignado`): Soporte sin cita vigente → Agendar; Soporte con cita vigente → "—"; Ejecutivo dueño sin cita vigente → Agendar; Ejecutivo dueño con cita vigente → Reagendar. Otros estados → "—". Cancelar no se muestra.
