# RESUMEN-PASO-0 — Invitados por defecto al agendar cita en Asignar SQL

Fecha: 2026-10-29. Rama: `EP-Feature-InvitadosCita` (creada desde `develop`). Solo lectura del código. Sin código de producto.

El workspace estaba en `EP-Feature-Reportes` con el árbol limpio. Este resumen vive en la rama pedida.

## a) Quién crea la cita

Hay dos persistencias. El modal es el mismo (`AssignSqlModal`); el endpoint cambia según el modo.

| Flujo de UI | Cliente | Endpoint | Servicio |
|---|---|---|---|
| Enrutamiento, «Asignar y registrar cita» | `handleAssignWithCita` → `assignSql` | `POST /api/v1/qualification/sqls/:id/assign` con `cita` | `SqlsService.assign` → `createCita` |
| SQL ya asignado, «Agendar cita» / «Agendar nueva reunión» | `handleScheduleOnlyWithCita` → `createAssignedSqlCita` | `POST /api/v1/qualification/sqls/:id/cita` | `SqlsService.createCitaForAssignedSql` |

Archivos:

- Controller: `backend/src/modules/qualification/controllers/sqls.controller.ts` (`assign` líneas 113-121, `createCita` líneas 144-157).
- Servicio: `backend/src/modules/qualification/services/sqls.service.ts`. `assign` en la línea 202. `createCita` (privado) en la línea 947. `createCitaForAssignedSql` en la línea 605.
- Modelo: `SqlCita` en `backend/src/modules/qualification/models/sql-cita.model.ts`.
- Modal: `frontend/src/modules/qualification/components/AssignSqlModal.tsx`. Título «Asignar SQL» o «Agendar cita» si `scheduleOnly`. La bandeja de enrutamiento abre el modal sin `scheduleOnly` (`RoutingInboxPage.tsx`). «SQL asignados» y el detalle lo abren con `scheduleOnly`.

`assign` solo inserta la cita si el body trae `cita`. «Asignar ahora y agendar después» llama al mismo `POST /assign` sin `cita` y no crea fila.

`createCitaForAssignedSql` inserta si el SQL no tiene fila. Si ya hay una cita y no está vigente, **actualiza la misma fila** (`existing.update`, líneas 705-721). No crea un segundo `cita_id`. `sql_id` es único.

`PATCH /qualification/sqls/:id/cita` (`updateCita`, línea 332) reagenda una cita abierta. No es el alta.

## b) Dónde se persiste y si ya hay invitados

Tabla real: **`sql_citas`**. PK `cita_id` (`CHAR(36)`). FK `sql_id` única, 1:1 con `sqls`. Migración inicial: `backend/database/migrations/20260805220000-sql-estado-and-sql-citas.js`.

El modelo tiene `paranoid: false`. No hay `deleted_at`. Cancelar la cita hace `destroy()` (borrado físico) en `cancelCitaForAssignedSql`.

No existe tabla de invitados o asistentes de la cita SQL. Lo que sí hay, y no es esa lista:

- `sql_citas.contactos` (JSON) más las columnas `contacto_nombre`, `contacto_email`, `contacto_telefono`, `contacto_cargo`. Son los contactos del cliente citados en la reunión. Migración `20260909080000-add-cita-contactos-json.js`.
- `sql_appointment_events` (modelo `SqlAppointmentEvent`, `paranoid: true`). Es la traza de estados de la cita (Agendada, Reagendada, Realizada, NoAsistio), no una lista de personas. El modelo vive en `sql-appointment-event.model.ts`. La card de traza es `SqlCitaTraceCard`, debajo de la card «Cita».
- Invitado de Graph en memoria: `resolveSoporteInvitee` (línea 1044). Si quien agenda es `SoporteComercial`, su correo entra a la reunión de Teams junto con los contactos. No se guarda como fila.
- Kickoff (`offer-closing`) tiene invitados propios. Es otra entidad. No se reutiliza.

Ajuste de nombres frente al prompt (R1):

| Prompt | Repo |
|---|---|
| `<cita>` | `sql_citas` / modelo `SqlCita` / PK `cita_id` |
| `<cita>_attendees` | tabla nueva propuesta `sql_cita_attendees`, FK `cita_id` → `sql_citas.cita_id` |
| `default_meeting_attendees` | el nombre no choca con nada existente; se puede usar tal cual |

`sql_citas` queda en español: es anterior a la convención de inglés y no se renombra (R3). Las tablas nuevas van en inglés y con `paranoid: true` / `deleted_at`. La padre no lo tiene.

Unicidad del email con soft-delete: un `UNIQUE(email)` simple impide volver a crear un correo ya eliminado. El requisito distingue «ya existente (activo)». El patrón del repo para eso es la columna generada `active_marker` de `commercial_goals` (`uq_commercial_goals_active_natural`). Conviene el mismo recurso en `default_meeting_attendees` y, si el snapshot se reemplaza sobre el mismo `cita_id`, también en `sql_cita_attendees` (`cita_id` + `email`).

`UsersService` no tiene búsqueda por email. `users.email` es único y el alta lo guarda en minúsculas (`users.service.ts`). `UsersService` sí está exportado por `AuthModule`. Enlazar `user_id` pide un método público nuevo en ese servicio. Calificación no debe consultar el modelo `User` por su cuenta: la frontera del módulo es el servicio público, aunque `User` ya esté en `SequelizeModule.forFeature` de `QualificationModule`.

## c) Outlook / Graph — sí sincroniza. R8: no se toca hasta aprobación

La cita de SQL **ya crea y actualiza** un evento de calendario con reunión de Teams.

Puntos:

1. `assign`, dentro de la transacción y después de `createCita`, llama `createTeamsMeetingForCita` (línea 262) y guarda `graph_event_id`, `graph_organizer_upn`, `teams_join_url`, `duration_minutes`.
2. `createCitaForAssignedSql` llama a Graph **antes** de insertar o actualizar la fila (línea 662).
3. `updateCita` hace `updateTeamsMeetingForCita` si ya hay `graph_event_id` (línea 394).
4. Cancelar borra el evento con `graphService` antes del `destroy` de la fila.

`createTeamsMeetingForCita` (línea 1117) arma la lista con `citaAttendees` (línea 1089): contactos con `@`, más el invitado de Soporte si no es el organizador ni está ya en la lista. Esa lista entra a `graphService.createMeeting({ attendees, isOnlineMeeting: true, ... })`.

`GraphService.buildEventDraft` (`graph.service.ts`, cerca de la línea 378) deduplica por email en minúsculas y mapea `{ email, name, type }` a `attendees[].emailAddress` de Graph. `type` por defecto `required`. El organizador tiene que ser un buzón `frisson.net.co` o `grupoverytel.com` (`assertOrgMailbox`). Los invitados no pasan por ese filtro.

Cómo se agregarían los invitados por defecto **sin cambiar Graph** (propuesta, no implementada):

- Resolver la lista activa en el servicio de calificación y pasarla a `citaAttendees` (o a un argumento nuevo de `createTeamsMeetingForCita` / `updateTeamsMeetingForCita`).
- Graph ya deduplica. Hay que omitir el UPN del organizador, igual que hoy se omite el correo de Soporte si coincide.
- En el reagendado (`updateCita` y el `existing.update` de `createCitaForAssignedSql`) la lista de Graph debe salir del **snapshot de esa cita**, no de la lista por defecto vigente (R5). Si solo se agregan en el alta, un `PATCH` posterior reconstruye los attendees de Graph solo con contactos + Soporte y **sacaría** a los invitados por defecto del evento de Outlook.
- No hace falta modificar `GraphService.createMeeting` ni `buildEventDraft`.

Riesgo ya presente: la llamada a Graph está dentro de la transacción de Sequelize, pero Graph no participa de ella. Si la inserción de invitados falla después de crear el evento, la fila de `sql_citas` hace rollback y el evento de Teams queda creado. En `createCitaForAssignedSql` el evento se crea incluso antes de la fila.

**Detención R8.** No se implementa el alta de estos correos como attendees de Graph hasta que se apruebe esta propuesta. El snapshot en base de datos puede seguir sin tocar Graph.

## d) Card «Cita»

No hay un componente aparte. La card está inline en `frontend/src/modules/qualification/pages/SqlDetailPage.tsx`, líneas 300-418: `<section className={cardClass}>` y `<h2>Cita</h2>`.

Muestra estado, lugar, fecha, enlace de Teams y contactos (`sql.cita.contactos`). Vacío: «Sin cita agendada.» Si el lead trae cita de agencia aún no generada, muestra el aviso de bandeja de enrutamiento.

La ruta es `/qualification/sqls/:id`. `?from=assigned` solo cambia el enlace de regreso (`backLink`). El detalle se carga con `GET /api/v1/qualification/sqls/:id` → `SqlsService.findById` → `toDetailResponse` → `toCitaResponse`. El DTO `SqlCitaResponseDto` (`sql-response.dto.ts`, línea 39) no trae invitados. El tipo de cliente es `SqlCita` en `frontend/src/modules/qualification/api/sqls-api.ts`.

La sección «Invitados (N)» entra en esa misma `<section>`, leyendo un arreglo nuevo del DTO de la cita. No hace falta otro endpoint.

Estilos del módulo: `cardClass` en `frontend/src/modules/qualification/components/ui.ts`. Tokens, sin hex.

## e) CASL y permisos de agendar / ver

No hay enum de subjects. `AppAbility` es `MongoAbility<[string, string]>`. `CaslAbilityFactory.createForPermissions` recorre `{ action, subject }` guardados en `roles.permissions`.

Dónde nace un permiso:

1. Matriz de seeds: `backend/database/seeders/lib/role-permissions.js`. `SUBJECTS` + `MATRIX` + `buildPermissions`. Las acciones de una letra (`C/R/U/D/...`) salen de `ACTION_MAP`. Una acción con nombre libre, como `manage_high_value`, se empuja a mano al final de `buildPermissions` (hoy solo `SoporteComercial` y `Admin`, líneas 217-220).
2. Migración que hace `UPDATE roles SET permissions` sobre las filas ya sembradas. Modelo: `20261018120100-account-high-value-permission.js` (una regla) y `20261020231100-commercial-goal-permissions.js` (varias). Sin esta migración, un rol ya existente no ve el permiso nuevo hasta re-seed.
3. El JWT / `GET /auth/me` devuelve `permissions` de la fila del rol. El cliente no compara nombres de rol para estos permisos: mira `user.permissions` (`can-manage-high-value.ts`, `can-read-commercial-goals.ts`).
4. La ruta lleva `@CheckAbility({ action, subject })`. `CaslGuard` responde 403 `{ code, message: 'Insufficient permissions' }` si falta la regla.

`manage_default_attendees` no existe. Propuesta alineada al patrón de alto valor, **solo Admin**:

- En `buildPermissions`, `if (roleName === 'Admin') rules.push({ action: 'manage_default_attendees', subject: 'DefaultMeetingAttendee' })`. No entra Soporte, Ejecutivo ni Gerente.
- Migración que agrega esa única regla a la fila `roles.name = 'Admin'` y la quita en `down`.
- Subject nuevo `DefaultMeetingAttendee`. La acción no cabe en `ACTION_MAP` (no es una letra).

`Gerente Comercial` no está en `BASE_ROLES` ni en `buildPermissions`. Sus reglas viven solo en la fila de `roles`. Esta feature no le agrega nada.

Permisos actuales de la cita (no se crean otros, R7):

| Acción | CASL | Regla extra en el servicio |
|---|---|---|
| Asignar SQL, con o sin cita | `update` `Opportunity` | `assertSoporteOrAdmin`: `SoporteComercial` o `Admin` (línea 1334) |
| `POST /:id/cita` | `update` `Opportunity` | `assertCanScheduleAssignedCita` (línea 1309): `SoporteComercial`, o el comercial asignado si es `EjecutivoComercial` o `Gerente Comercial`. **Admin no pasa** por este método |
| `PATCH` y `DELETE /:id/cita`, cierre de resultado | `update` `Opportunity` | el mismo `assertCanScheduleAssignedCita` |
| Ver detalle (`GET /:id`), incluye la cita | `read` `Opportunity` | `assertCanViewSql` (línea 1476): `SoporteComercial`, `DirectorMercadeo`, `Admin`, `GestorMercadeo`, o el usuario asignado si el SQL ya no está en `PendienteAsignacion` |
| Bandeja de enrutamiento | `read` `Opportunity` | `assertCanAccessInbox`: Soporte, Director de Mercadeo o Admin |

Quien puede agendar o ver la cita hoy sigue pudiendo. La lista por defecto es el único permiso nuevo.

## f) Engranaje reutilizable

El de metas comerciales **no es un modal de configuración sobre el tablero**. Es un enlace:

- `OuvDashboardPage.tsx` líneas 385-394: botón `Settings` de lucide, visible si `hasCommercialGoalPermission(user, 'read')`, apunta a `/dashboard/metas-comerciales`.
- Esa pantalla (`CommercialGoalsPage.tsx`) administra la lista y abre `CommercialGoalFormModal` para alta y edición.
- El cliente de calificación ya usa `ModalShell` de `frontend/src/modules/demand-generation/components/ModalShell.tsx` (devolución de lead, detalle del dashboard).

`/qualification` no es una pantalla para Admin. `QualificationHomePage` solo pinta la bandeja de enrutamiento si el rol es `SoporteComercial`. Cualquier otro rol, incluido Admin, hace `<Navigate to="/qualification/assigned" />`. La pestaña «Enrutamiento» de `QualificationNav` también está limitada a Soporte.

Poner el engranaje solo en `RoutingInboxPage` lo ocultaría al Admin, que es el único que debe verlo, y se lo mostraría a Soporte si se condicionara mal el rol.

Propuesta para aprobar: ícono `Settings` en `QualificationNav` (visible en asignados y en el dashboard, que sí abre Admin), gate `user.permissions` con `manage_default_attendees` / `DefaultMeetingAttendee`, y un `ModalShell` con la lista. Se reutiliza el ícono y el chequeo de permiso de metas, y el modal que calificación ya usa. No se copia la pantalla de metas.

## Decisiones que necesitan aprobación antes del Paso 1

1. **R8.** ¿El Paso 2 deja Graph como está y solo persiste el snapshot, o también mete los correos en `citaAttendees` de `createTeamsMeetingForCita` y de `updateTeamsMeetingForCita`? Sin un sí explícito, Graph no se toca.
2. **Alcance del snapshot.** El prompt nombra «Asignar SQL» (`POST /assign` con `cita`). ¿El mismo snapshot entra en `POST /:id/cita` (agendar después y «Agendar nueva reunión»)? Si sí: al reutilizar el mismo `cita_id`, ¿se reemplaza el snapshot anterior?
3. **Engranaje** en `QualificationNav` + modal, no en la bandeja de enrutamiento y no como página hermana de metas.
4. **Nombres:** `default_meeting_attendees` y `sql_cita_attendees.cita_id`. Unicidad de activos con `active_marker`, como las metas.
5. **Auditoría.** `AuditHooksService` engancha `afterCreate` / `afterUpdate` / `afterDestroy` de todo modelo Sequelize salvo `audit_log` y `notifications`. Un modelo nuevo registrado en el módulo queda auditado sin escribir filas a mano. `AuditWriterService` no se exporta. El skill `registrar-auditoria` describe un `AuditService.log` que el código vivo no usa para el CRUD. Seguir los hooks, que es lo que hacen las metas (`commercial-goal.audit.spec.ts`). El alta de la cita no debe duplicar auditoría de los invitados si el hook ya corre.

## Riesgos

- Una cita vigente es una sola fila por SQL. Cambiar la lista por defecto no la toca; volver a agendar sobre la misma fila sí puede pisar el snapshot si el Paso 1 lo define así.
- Admin asigna con cita en el enrutamiento, pero no puede llamar `POST /:id/cita`. Eso ya es así y no se cambia.
- El seed de los tres correos y el permiso de Admin no aparecen en roles ya desplegados hasta correr las migraciones. Después, Admin tiene que cerrar sesión para ver el permiso en el cliente.
- `otros@grupoverytel.com` es un placeholder. El seed lo carga activo, como piden los tres correos.

## Pruebas

No aplica. No hay código de producto en este paso.
