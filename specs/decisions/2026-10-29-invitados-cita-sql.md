# 2026-10-29 — Invitados por defecto de la cita SQL

Estado: aprobada el 2026-10-29. No cambia el stack ni agrega dependencias.

Decisiones de producto: aprobación del Paso 0 (D1–D5) en el chat del 2026-10-29. Descubrimiento: `specs/invitados-cita-sql/RESUMEN-PASO-0.md`.

## D1 — Graph

En el alta, los invitados por defecto activos entran como attendees de la reunión de Teams. Se resuelve la lista **una vez**, antes de llamar a Graph, y ese mismo arreglo alimenta el snapshot y `citaAttendees`. Se omite el UPN del organizador (comparación en minúsculas). Graph ya deduplica por email.

- `POST /qualification/sqls/:id/assign` cuando el body trae `cita`. Orden, igual que hoy y con el snapshot en medio: insertar `sql_citas` → insertar `sql_cita_attendees` → `createTeamsMeetingForCita` al final.
- `POST /qualification/sqls/:id/cita`. La llamada a Graph **sigue donde está hoy** (antes de insertar o actualizar la fila). No se mueve al final.
- Reagendado de cita abierta (`PATCH /qualification/sqls/:id/cita`, `updateCita`): Graph se arma con los contactos, el invitado de Soporte y el **snapshot ya guardado**. No se lee `default_meeting_attendees`.
- Reutilización de `cita_id` en `POST /:id/cita` (`existing.update` de `createCitaForAssignedSql`): el snapshot se reemplaza (D2). Graph usa el arreglo que se va a guardar, no las filas viejas y no una segunda lectura de la lista.

No se modifican `GraphService.createMeeting` ni `buildEventDraft`.

Riesgo conocido, preexistente, **fuera de esta rama:** Graph no participa de la transacción de Sequelize. Si la escritura en base falla después de crear o actualizar el evento, el evento queda en Teams y la transacción hace rollback. No se reordena `POST /:id/cita` para corregirlo.

## D2 — Alcance del snapshot

El snapshot se escribe en los dos altas: `assign` con `cita` y `POST /:id/cita`.

- Primera fila de `sql_citas`: se insertan los activos.
- `POST /:id/cita` reutiliza un `cita_id` porque la cita existente no está vigente (la condición que hoy ya permite `existing.update` y rechaza `CITA_VIGENTE_EXISTS`): en la misma transacción se borran las filas anteriores de `sql_cita_attendees` y se insertan las nuevas. Primero el borrado, después el alta, para no chocar con `UNIQUE(cita_id, email)`.
- `PATCH /:id/cita`: no inserta, no borra y no actualiza `sql_cita_attendees`.
- El snapshot guarda solo invitados por defecto (`source = 'default'`). Los contactos del cliente (`sql_citas.contactos`) y el invitado de Soporte siguen como hoy y no se copian a esta tabla. Si un correo por defecto coincide con un contacto o con Soporte, la fila del snapshot igual se guarda; Graph lo muestra una sola vez.

Quien agenda no envía invitados. El DTO de la cita no acepta un arreglo de invitados. Con `forbidNonWhitelisted`, un body que lo traiga responde 400. `source = 'manual'` existe en el ENUM y esta iteración no lo escribe.

## D3 — Engranaje

Ícono `Settings` en `QualificationNav`, visible solo si `user.permissions` contiene `{ action: 'manage_default_attendees', subject: 'DefaultMeetingAttendee' }`. Abre un `ModalShell` con la lista. No hay ruta nueva. Admin no se queda en `/qualification` (redirige a `/qualification/assigned`); el nav sí lo ve en asignados y en el dashboard.

## D4 — Nombres y modelo

Tablas nuevas en inglés. `sql_citas` no se renombra.

PKs al patrón del repo (`commercial_goal_id`, `sql_appointment_event_id`), no la columna genérica `id` del prompt:

- `default_meeting_attendees.default_meeting_attendee_id`
- `sql_cita_attendees.sql_cita_attendee_id`

### `default_meeting_attendees`

`paranoid: true`.

| Columna | Tipo | Notas |
|---|---|---|
| `default_meeting_attendee_id` | `CHAR(36)` PK | UUID v4 |
| `email` | `VARCHAR(180)` NOT NULL | Se guarda en minúsculas, sin espacios. Mismo largo que `users.email` |
| `name` | `VARCHAR(120)` NULL | |
| `sort_order` | `INTEGER` NOT NULL | |
| `is_active` | `BOOLEAN` NOT NULL | Default `true` |
| `created_at` / `updated_at` | `DATE` NOT NULL | |
| `deleted_at` | `DATE` NULL | Soft-delete |
| `active_marker` | `TINYINT` generada STORED | `IF(deleted_at IS NULL, 1, NULL)`, igual que `commercial_goals` |

Índice único `uq_default_meeting_attendees_active_email` sobre `(email, active_marker)`.

«Activo» para la unicidad es la fila no eliminada. `is_active = false` sigue ocupando el correo. El soft-delete libera el correo y permite crearlo otra vez. El modelo Sequelize no declara `active_marker` como atributo escribible.

### `sql_cita_attendees` — excepción a R2

`paranoid: false`. **No hay `deleted_at`.** La fila sigue el ciclo de `sql_citas`, que se borra con `destroy()` al cancelar y tampoco es paranoid.

| Columna | Tipo | Notas |
|---|---|---|
| `sql_cita_attendee_id` | `CHAR(36)` PK | UUID v4 |
| `cita_id` | `CHAR(36)` NOT NULL | FK `sql_citas.cita_id`, ON UPDATE CASCADE, **ON DELETE CASCADE** |
| `email` | `VARCHAR(180)` NOT NULL | Copia en minúsculas al agendar |
| `name` | `VARCHAR(120)` NULL | Copia al agendar |
| `user_id` | `CHAR(36)` NULL | FK `users.user_id`, ON UPDATE CASCADE, ON DELETE SET NULL |
| `source` | `ENUM('default','manual')` NOT NULL | Esta iteración solo `default` |
| `sort_order` | `INTEGER` NOT NULL | Copia del `sort_order` al agendar, para no depender del orden de inserción |
| `created_at` / `updated_at` | `DATE` NOT NULL | |

`UNIQUE(cita_id, email)` con nombre `uq_sql_cita_attendees_cita_email`. Índice en `user_id`. Motor InnoDB para que el CASCADE aplique.

`sort_order` en el snapshot no estaba en el bosquejo del prompt. Hace falta para cumplir el orden de la lista y para que un cambio posterior de `default_meeting_attendees.sort_order` no reordene una cita ya guardada.

### `user_id`

Método público nuevo `UsersService.findByEmail`. Normaliza a minúsculas y recorta espacios. Respeta `paranoid` de `users`: un usuario eliminado no enlaza. No filtra por `is_active`. Si no hay fila, devuelve `null`. Calificación no consulta el modelo `User`.

## D5 — Auditoría

La escriben los hooks de `AuditHooksService` al crear, actualizar o destruir el modelo, como `commercial_goals`. El servicio de invitados no inserta en `audit_log`. No se llama a `AuditWriterService` (no está exportado).

El CASCADE de MySQL al borrar `sql_citas` no dispara `afterDestroy` de cada invitado. No se agregan filas de auditoría a mano por ese borrado. La auditoría del evento es el `DELETE` de `sql_citas`, que el hook ya registra. Los altas y el reemplazo hechos por el modelo Sequelize sí disparan hooks.

Pendiente, fuera de esta rama: el skill `.cursor/skills/registrar-auditoria/SKILL.md` sigue describiendo un `AuditService.log` manual. No se actualiza aquí. Queda anotado en `specs/invitados-cita-sql/RESUMEN-PASO-1.md`.

## Permiso

Una sola regla: `{ action: 'manage_default_attendees', subject: 'DefaultMeetingAttendee' }`.

- `buildPermissions`: solo si `roleName === 'Admin'`. No entra a `ACTION_MAP` (no es una letra). No se la lleva SoporteComercial.
- Migración re-ejecutable sobre la fila `roles.name = 'Admin'`. El `down` quita solo esa regla. No toca `Gerente Comercial` ni ningún otro rol.
- Las cuatro rutas de administración usan `@CheckAbility` con esa regla. No se parte en `create` / `read` / `update` / `delete`.

Agendar y ver la cita conservan `update` / `read` de `Opportunity` y los asserts de rol actuales. Admin sigue sin poder llamar `POST /:id/cita` salvo que el assert preexistente lo deje pasar (hoy no lo deja). Esta spec no cambia ese assert.

## API de administración

Prefijo `api/v1`. Recurso bajo calificación. JWT en todas.

| Método | Ruta | Ability | Respuesta |
|---|---|---|---|
| GET | `/qualification/default-meeting-attendees` | `manage_default_attendees` `DefaultMeetingAttendee` | `{ items }` de las filas con `deleted_at` NULL, activas e inactivas, orden `sort_order ASC`, `email ASC` |
| POST | `/qualification/default-meeting-attendees` | la misma | 201 y el ítem |
| PATCH | `/qualification/default-meeting-attendees/:id` | la misma | El ítem |
| DELETE | `/qualification/default-meeting-attendees/:id` | la misma | 200 `{ deleted: true }` y soft-delete |

`GET` no está paginado: la lista es corta y la administra una persona.

POST: `email` obligatorio, `name` opcional. El servidor asigna `sort_order` = máximo de las filas no eliminadas + 1, o 1 si no hay filas. `is_active` queda `true`. El cliente no envía `sort_order` ni `is_active` en el alta.

PATCH: `name` (string o `null`) y `is_active` (boolean). Al menos uno. El correo no se edita. Un body con `email` responde 400 por `forbidNonWhitelisted`.

Ítem:

```json
{
  "default_meeting_attendee_id": "uuid",
  "email": "erobles@grupoverytel.com",
  "name": null,
  "sort_order": 1,
  "is_active": true,
  "created_at": "2026-10-29T00:00:00.000Z",
  "updated_at": "2026-10-29T00:00:00.000Z"
}
```

Errores, forma `{ code, message }`:

| Caso | HTTP | code | message |
|---|---|---|---|
| Correo inválido, vacío o de más de 180 caracteres | 400 | `VALIDATION_ERROR` | `El correo no es válido.` |
| `name` de más de 120 caracteres | 400 | `VALIDATION_ERROR` | `El nombre no puede pasar de 120 caracteres.` |
| PATCH sin campos | 400 | `VALIDATION_ERROR` | `No hay cambios para guardar.` |
| Correo ya usado por una fila no eliminada | 409 | `CONFLICT` | `Ese correo ya está en la lista.` |
| Sin la regla CASL | 403 | `FORBIDDEN` | El mensaje que ya responde `CaslGuard` |
| Id inexistente o eliminado | 404 | `NOT_FOUND` | `No se encontró el invitado.` |

El 409 también cubre el correo que está inactivo: no se crea otro; se reactiva el existente desde el modal.

## Cita: snapshot, Graph y detalle

Lectura de la lista por defecto para un alta: `deleted_at` NULL, `is_active = true`, orden `sort_order ASC`, `email ASC`.

Por cada fila, el snapshot guarda `email`, `name`, `sort_order`, `source = 'default'` y `user_id` de `findByEmail`. Un fallo de esa búsqueda no se traga: si `findByEmail` lanza, la transacción revierte. Un `null` no es fallo.

`citaAttendees` suma esos correos a contactos e invitado de Soporte, con `type: 'required'`. Si `name` es null o vacío, no se envía nombre (Graph ya acepta solo la dirección). Se excluye el correo que sea igual al UPN del organizador. No se excluye del snapshot.

`SqlCitaResponseDto` gana `attendees`, siempre un arreglo, ordenado por `sort_order ASC`, `email ASC`:

```json
{
  "sql_cita_attendee_id": "uuid",
  "email": "erobles@grupoverytel.com",
  "name": null,
  "user_id": null,
  "source": "default",
  "sort_order": 1
}
```

Entra en el detalle, en la respuesta de `assign`, en `POST /:id/cita` y en `PATCH /:id/cita`. En las listas, una sola consulta `WHERE cita_id IN (...)` por página, no una por fila. La card del detalle es la que lo muestra.

Lista vacía: la cita se agenda, `attendees` es `[]`, Graph queda con contactos y Soporte como hoy, y no hay error.

Si la inserción del snapshot falla, la excepción sale de la transacción. En `assign` la cita y el snapshot revierten, y Graph todavía no se llamó. En `POST /:id/cita` aplica el riesgo conocido de D1.

Cancelar (`DELETE /:id/cita`) sigue haciendo `cita.destroy()`. El CASCADE borra `sql_cita_attendees` de ese `cita_id`. No hay borrado adicional en el servicio.

Seed en la migración de la tabla, idempotente: si no hay fila viva con ese correo, insertar activo, `name` NULL y `sort_order` 1, 2 y 3:

1. `erobles@grupoverytel.com`
2. `jherrera@grupoverytel.com`
3. `otros@grupoverytel.com`

## Requisitos EARS

### REQ-01 (Evento)

Cuando un usuario agenda una cita en `POST /assign` con `cita` o en `POST /:id/cita` y el SQL no tenía fila, el sistema debe copiar a `sql_cita_attendees` todos los `default_meeting_attendees` con `is_active = true` y sin `deleted_at`, en orden de `sort_order`, con email, nombre, `sort_order`, `source = 'default'` y `user_id` si el correo pertenece a un usuario no eliminado.

Criterio: con tres activos, la cita queda con tres filas en ese orden. El correo que existe en `users` trae `user_id`. El que no existe trae `user_id` NULL. Un usuario con `deleted_at` no enlaza. Un usuario inactivo sí enlaza.

### REQ-02 (No deseado)

Si la lista por defecto no tiene filas activas, el sistema debe agendar la cita sin filas en `sql_cita_attendees` y sin error.

Criterio: `attendees` es `[]` y la respuesta de la cita es 200 o 201, la que ya corresponda al endpoint.

### REQ-03 (Ubicuo)

El sistema debe impedir dos filas con el mismo correo en la misma cita.

Criterio: el índice `uq_sql_cita_attendees_cita_email` rechaza el segundo insert del mismo par. El servicio no inserta duplicados aunque la lista llegara repetida.

### REQ-04 (No deseado)

Si falla la inserción del snapshot, el sistema debe revertir la creación o la actualización de la cita de esa transacción.

Criterio: un fallo forzado al insertar invitados deja la transacción en rollback. En un alta por `assign`, no queda fila nueva en `sql_citas` ni en `sql_cita_attendees`.

### REQ-05 (Evento)

Cuando se consulta el detalle del SQL, el sistema debe devolver los invitados guardados en esa cita, ordenados por `sort_order`.

Criterio: `GET /qualification/sqls/:id` incluye `cita.attendees` con las filas de esa `cita_id`. No lee `default_meeting_attendees` para armar esa respuesta.

### REQ-06 (Evento)

Cuando se agenda por `assign` con cita o por `POST /:id/cita`, el sistema debe incluir en los attendees de Graph el arreglo resuelto de invitados por defecto, sin el UPN del organizador, y sin modificar `GraphService`.

Criterio: `createMeeting` recibe esos correos además de contactos y Soporte. El correo del comercial organizador, si también está en la lista, no va en el payload. Los archivos `graph.service.ts` no cambian de firma ni de mapeo de attendees. Una lista vacía no agrega elementos.

### REQ-07 (Evento)

Cuando se reagenda una cita abierta con `PATCH /:id/cita`, el sistema debe armar los attendees de Graph con el snapshot guardado y debe conservar esas filas.

Criterio: después del PATCH, `sql_cita_attendees` de esa cita es el mismo conjunto (mismos id, email, name, user_id, sort_order). Si la lista por defecto cambió entre el alta y el PATCH, Graph recibe los correos viejos. Los contactos y Soporte se siguen sumando como hoy.

### REQ-08 (Evento)

Cuando `POST /:id/cita` reutiliza un `cita_id` cuya cita no estaba vigente, el sistema debe borrar el snapshot anterior e insertar la lista activa actual en la misma transacción, y Graph debe usar ese arreglo nuevo.

Criterio: la cita que estaba `Realizada`, `NoAsistio` o abierta pero no vigente pasa a tener solo los activos de ahora. Una cita vigente sigue respondiendo `CITA_VIGENTE_EXISTS` y no toca el snapshot. El borrado ocurre antes del insert.

### REQ-09 (Evento)

Cuando se cancela la cita, el sistema debe borrar las filas de `sql_cita_attendees` de ese `cita_id` por el `ON DELETE CASCADE` del FK.

Criterio: tras el `destroy` de `sql_citas`, un `SELECT` de ese `cita_id` en `sql_cita_attendees` no devuelve filas. El servicio no las borra una a una.

### REQ-10 (Evento)

Cuando cambia la lista por defecto, el sistema no debe modificar las filas de `sql_cita_attendees` ya guardadas, salvo el reemplazo explícito de REQ-08.

Criterio: editar nombre, desactivar o eliminar un invitado por defecto deja intacta una cita agendada antes de ese cambio. Su detalle sigue mostrando el snapshot.

### REQ-11 (Estado)

Mientras el usuario tenga `manage_default_attendees` sobre `DefaultMeetingAttendee`, el sistema debe permitir listar, agregar, editar el nombre, activar o desactivar y eliminar con soft-delete.

Criterio: Admin, después de la migración y de volver a iniciar sesión, completa las cinco operaciones. `buildPermissions('Admin')` contiene la regla. `buildPermissions('SoporteComercial')` y `buildPermissions('EjecutivoComercial')` no. La fila de Gerente Comercial no se actualiza en la migración.

### REQ-12 (No deseado)

Si un usuario sin `manage_default_attendees` llama un endpoint de administración, el sistema debe responder 403.

Criterio: SoporteComercial, Gerente Comercial y EjecutivoComercial reciben 403 en GET, POST, PATCH y DELETE, y no queda fila nueva ni cambio.

### REQ-13 (No deseado)

Si el correo es inválido o ya pertenece a una fila no eliminada, el sistema debe rechazarlo con el mensaje de la tabla de errores.

Criterio: `no-es-correo` responde 400 `El correo no es válido.` Un segundo POST del mismo correo, aunque el primero esté `is_active = false`, responde 409 `Ese correo ya está en la lista.` Tras el soft-delete, el mismo correo responde 201.

### REQ-14 (Evento)

Cuando ocurre un alta, un cambio o una eliminación de `default_meeting_attendees`, el sistema debe registrarlo en `audit_log` mediante `AuditHooksService`.

Criterio: el POST deja un `INSERT`, el PATCH de `name` o `is_active` deja un `UPDATE` con `campo_modificado`, `valor_anterior` y `valor_nuevo`, y el DELETE deja un `DELETE`. El servicio no escribe `audit_log`. El skill `registrar-auditoria` no se edita.

## UX

Card «Cita» en `/qualification/sqls/:id` (`SqlDetailPage`, la sección que ya existe). `?from=assigned` no cambia el contenido.

Si hay cita, debajo de los contactos:

- Título «Invitados (N)» con el ícono `Users` de lucide. N es `attendees.length`.
- Cada ítem: `name` si tiene texto; si no, el email. El email va en una línea secundaria atenuada. Si el título ya es el email, la línea secundaria no se repite.
- Orden del arreglo que devolvió el API. El cliente no reordena.
- Cero invitados: «Sin invitados».
- Sin cita: se mantiene «Sin cita agendada.» y no aparece el bloque de invitados.

Tokens y `cardClass` del módulo. La lista hace salto de línea en móvil. Sin librerías nuevas.

Administración, solo con el permiso de D3:

- `Settings` en `QualificationNav`, `title` y `aria-label` «Invitados por defecto», área de al menos 36 px.
- `ModalShell` titulado «Invitados por defecto».
- Alta: email y nombre opcional. Guardar llama al POST. El error 400 o 409 se muestra con `message`, nunca con `code`.
- Editar nombre en la fila.
- Activar o desactivar con el PATCH de `is_active`. Un inactivo se distingue con texto atenuado y la etiqueta «Inactivo».
- Eliminar pide confirmación (`window.confirm`) y llama al DELETE.
- Vacío: «No hay invitados por defecto.»
- Quien no tiene el permiso no ve el ícono. No hay página `/qualification/invitados` ni equivalente.

## Fuera de alcance

- Corregir que Graph quede fuera de la transacción.
- Cambiar `GraphService`.
- Dejar que quien agenda quite o agregue invitados en la cita.
- Escribir `source = 'manual'`.
- Dar a Admin la capacidad de `POST /:id/cita`.
- Actualizar el skill `registrar-auditoria`.
- Reordenar la lista por defecto desde la UI (`sort_order` lo asigna el servidor al crear).

## Pruebas que cierran el Paso 2

Además del criterio de cada REQ:

- Cita con lista poblada, lista vacía, correo que coincide con un usuario y correo que no coincide.
- Rollback del alta si falla el insert del snapshot.
- Cambiar la lista no altera una cita ya agendada.
- `PATCH` conserva el snapshot y el payload de Graph usa esos correos, no los vigentes.
- `POST /:id/cita` sobre una cita no vigente reemplaza el snapshot.
- Cancelar deja cero filas hijas.
- Admin administra. SoporteComercial, Gerente Comercial y EjecutivoComercial reciben 403 en la administración.
- El diff de `backend/src/modules/graph-integration/services/graph.service.ts` no incluye esta feature.
