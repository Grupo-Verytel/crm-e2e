# DR — Acciones de cita en Calificación

**Fecha:** 2026-09-23
**Estado:** Aprobado
**Módulo:** qualification

## Contexto

En `/qualification`, SoporteComercial ve Enrutamiento y SQL asignados. EjecutivoComercial solo ve el tab **Mis SQL** (`/qualification/assigned`). La cita de un SQL asignado no debe volver a asignar el comercial. `sql_citas` no tiene estado de cancelación.

## Decisión

### Redistribución de acciones

Enrutamiento conserva un solo control, Agendar, que abre `AssignSqlModal` y llama a `POST /qualification/sqls/:id/assign`. No muestra Reagendar ni Cancelar.

En SQL asignados la columna Acción usa `vigente` del API:

| Rol | Estado | Sin cita vigente | Con cita vigente |
|---|---|---|---|
| SoporteComercial | `Asignado` | Agendar | — |
| Ejecutivo Comercial dueño | `Asignado` | Agendar | Reagendar |
| Cualquier rol | otro estado (`EnGestion`, `ConvertidoOUV`, `Backlog`, `Descartado`) | — | — |

Cancelar no se muestra. Una cita pasada sigue visible en la columna Cita; la acción pasa a Agendar.

En Reagendar, email, teléfono y contactos adicionales se muestran en solo lectura. Solo se editan los campos que acepta `PATCH /qualification/sqls/:id/cita`: fecha, hora, lugar, duración, nombre del contacto principal, cargo y descripción.

### `POST /qualification/sqls/:id/cita`

Método `createCitaForAssignedSql`. Solo si `sql.estado` es `Asignado`. No modifica `comercial_asignado_id`, `estado` ni `fecha_asignacion`. Lo llaman SoporteComercial o el EjecutivoComercial dueño. El guard CASL es `update` sobre `Opportunity`.

- Sin fila en `sql_citas`: crea la fila y un evento de Teams nuevo.
- Con cita vigente: 400 `CITA_VIGENTE_EXISTS`, sin llamar a Teams.
- Con cita pasada: crea un evento de Teams nuevo y sobrescribe la fila (fecha, hora, contactos, link, `graph_event_id`). El evento anterior no se modifica.
- La sobrescritura usa `instance.update()`, que en Sequelize llama a `save()` y dispara `afterUpdate`. El hook de auditoría escribe un `UPDATE` por columna con valor anterior, valor nuevo, usuario y timestamp.

`PATCH /qualification/sqls/:id/cita` no se amplía a SoporteComercial.

### Vigencia

Se calcula en backend, en `America/Bogota`: la cita está vigente si existe fila y su inicio es ahora o posterior. La respuesta incluye `vigente`. El frontend no recalcula la regla.

## Pendientes de negocio

- Cancelar. Requiere `DELETE` y el enum `sql_citas.estado`. Hasta entonces el icono no se implementa.
- Permiso de SoporteComercial para reagendar citas de un comercial que no es él. Hoy `PATCH :id/cita` responde 403 en ese caso.
