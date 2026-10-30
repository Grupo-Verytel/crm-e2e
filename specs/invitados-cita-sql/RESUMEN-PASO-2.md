# RESUMEN-PASO-2 — Backend de invitados por defecto de la cita SQL

Fecha: 2026-10-29. Rama: `EP-Feature-InvitadosCita`. Sin frontend.

La spec `specs/decisions/2026-10-29-invitados-cita-sql.md` queda marcada como aprobada el 2026-10-29. Este paso implementa D1–D5 en el backend.

## Migraciones

`npm run migration:run` en `backend/` terminó en verde contra la base de development:

- `20261029220000-create-default-meeting-attendees` — paranoid, `deleted_at`, `active_marker` generado y único con `email`.
- `20261029220100-create-sql-cita-attendees` — sin `deleted_at`. `cita_id` → `sql_citas.cita_id` con `ON DELETE CASCADE`. `user_id` con `ON DELETE SET NULL`. Único `(cita_id, email)`.
- `20261029220200-default-meeting-attendee-permission` — `up` agrega `{ action: 'manage_default_attendees', subject: 'DefaultMeetingAttendee' }` solo al rol `Admin`. `down` quita esa regla.

Seed verificado en la base: tres filas vivas, `name` nulo, `is_active` verdadero, `sort_order` 1..3:

- `erobles@grupoverytel.com`
- `jherrera@grupoverytel.com`
- `otros@grupoverytel.com`

La misma consulta de permisos devolvió solo el rol `Admin`.

## Comportamiento

`UsersService.findByEmail` es público. Normaliza el correo a minúsculas, ignora usuarios con `deleted_at` y no filtra `is_active`: un usuario inactivo sigue enlazándose.

En cada alta la lista activa se resuelve una sola vez. Ese arreglo alimenta Graph y el snapshot.

- `POST /qualification/sqls/:id/assign` con cita: inserta la cita, inserta el snapshot y llama a Graph al final.
- `POST /qualification/sqls/:id/cita`: Graph sigue antes del insert, como estaba. Cita nueva guarda el snapshot. Si reutiliza un `cita_id` no vigente, borra el snapshot anterior e inserta el nuevo en la misma transacción.
- `PATCH /qualification/sqls/:id/cita`: Graph sale del snapshot. No vuelve a leer la lista viva y no modifica el snapshot.
- `DELETE /qualification/sqls/:id/cita`: el servicio sigue haciendo `destroy` de `sql_citas`. Las filas de `sql_cita_attendees` caen por la FK. Esa cascada de MySQL no dispara hooks por fila; no se escriben esas filas de auditoría a mano.

El organizador (UPN en minúsculas) se omite en Graph. El snapshot sí lo guarda si su correo estaba en la lista activa. Contactos del lead y el invitado de Soporte se mantienen. Un nombre vacío de invitado por defecto no se envía a Graph. Duplicados se descartan por correo en minúsculas.

`SqlCitaResponseDto.attendees` y `toCitaResponse` devuelven el snapshot. Las listas cargan los invitados con un `WHERE cita_id IN (...)` por página.

CRUD en `/api/v1/qualification/default-meeting-attendees`, todos con `@CheckAbility({ action: 'manage_default_attendees', subject: 'DefaultMeetingAttendee' })`. `POST` asigna `sort_order = max + 1`. El correo no se edita. `PATCH` acepta `name` y/o `is_active`. `DELETE` es soft-delete. Un correo de una fila viva, aunque `is_active` sea falso, responde 409. Tras el soft-delete el mismo correo se puede crear de nuevo.

Auditoría solo por `AuditHooksService`. El snapshot usa `individualHooks: true` en `bulkCreate` y `destroy`. El servicio no importa `AuditService` ni escribe `audit_log`.

`buildPermissions` en `role-permissions.js` agrega la regla solo para `Admin`. Soporte Comercial no la recibe. Admin sigue sin poder llamar `POST /:id/cita`.

## Excepción a R2

`sql_cita_attendees` no es paranoid. Sigue el borrado físico de `sql_citas`. Queda escrito en la migración y en la decisión, sección D4.

## Riesgo conocido

Graph sigue fuera de la transacción de Sequelize. No se corrige en esta rama. En `assign`, si Graph falla después del commit, la cita y el snapshot ya quedaron guardados. En `POST /:id/cita`, si la base falla después de Graph, el evento de Outlook puede existir sin fila local. Es el mismo riesgo de antes; el orden de `assign` ahora es cita → snapshot → Graph.

## Envelope de errores

El `ValidationPipe` global no se tocó. Un correo inválido o un nombre de más de 120 caracteres responde 400 con `{ statusCode, message: string[], error }`. El texto «El correo no es válido.» o «El nombre no puede pasar de 120 caracteres.» va dentro de `message`.

Estas respuestas las arma el servicio, con `statusCode` añadido por Nest:

- 400 `{ code: "VALIDATION_ERROR", message: "No hay cambios para guardar." }`
- 409 `{ code: "CONFLICT", message: "Ese correo ya está en la lista." }`
- 404 `{ code: "NOT_FOUND", message: "No se encontró el invitado." }`
- 403 del `CaslGuard` para quien no tiene la regla.

## Archivos

Nuevos:

- `backend/database/migrations/20261029220000-create-default-meeting-attendees.js`
- `backend/database/migrations/20261029220100-create-sql-cita-attendees.js`
- `backend/database/migrations/20261029220200-default-meeting-attendee-permission.js`
- `backend/src/modules/qualification/models/default-meeting-attendee.model.ts`
- `backend/src/modules/qualification/models/sql-cita-attendee.model.ts`
- `backend/src/modules/qualification/dtos/default-meeting-attendee.dto.ts`
- `backend/src/modules/qualification/services/default-meeting-attendees.service.ts`
- `backend/src/modules/qualification/controllers/default-meeting-attendees.controller.ts`
- `backend/src/modules/qualification/services/default-meeting-attendees.service.spec.ts`
- `backend/src/modules/qualification/services/default-meeting-attendees.permissions.spec.ts`
- `backend/src/modules/qualification/services/sql-cita-default-attendees.spec.ts`
- `backend/src/modules/qualification/models/default-meeting-attendee.audit.spec.ts`
- `backend/src/modules/auth/services/users-find-by-email.spec.ts`

Modificados:

- `backend/database/seeders/lib/role-permissions.js`
- `backend/src/modules/auth/services/users.service.ts`
- `backend/src/modules/qualification/qualification.module.ts`
- `backend/src/modules/qualification/dtos/sql-response.dto.ts`
- `backend/src/modules/qualification/services/sqls.service.ts`
- `backend/src/modules/qualification/services/sqls.service.spec.ts` — mocks de los dos modelos nuevos en el constructor
- `backend/src/modules/qualification/services/sql-interactions.spec.ts` — igual

`GraphService.createMeeting` y `buildEventDraft` no se modificaron. No hay cambios de frontend.

## Tests

`npx jest` sin cobertura, 9 suites, 69 tests, todos en verde:

- specs nuevos de la feature (lista poblada y vacía, duplicados, usuario existente, organizador omitido en Graph, rollback del alta, reemplazo de snapshot, `PATCH` que conserva invitados, cascada declarada al cancelar, la lista viva no reescribe citas ya guardadas, 403 de Soporte Comercial, Gerente Comercial y Ejecutivo Comercial, recrear un correo eliminado, auditoría por hooks, `findByEmail`);
- `sqls.service.spec.ts` y `sql-interactions.spec.ts`, que construyen `SqlsService`;
- `commercial-goals.permissions.spec.ts` y `account-high-value.spec.ts`, que leen `buildPermissions`.

Ningún test preexistente falló. No hubo código ajeno que corregir.

El rollback del test de `assign` no abre MySQL: el callback de la transacción lanza antes de Graph y la transacción no queda confirmada. Sequelize revierte cuando ese callback lanza. La cascada real quedó declarada en la migración aplicada; el test comprueba esa declaración y que el cancel del servicio no borra hijos a mano. No se ejecutó un `DELETE` de cita contra la base en este paso.

## Cómo probar

El backend no monta Swagger. Los ejemplos usan curl contra `http://localhost:3000/api/v1` (puerto por `PORT`, default 3000). Hay que reiniciar el backend para cargar el código. Admin debe cerrar sesión y volver a entrar: el JWT anterior no trae la regla nueva.

Login:

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@ejemplo.com\",\"password\":\"********\"}"
```

Usar `access_token` como `Authorization: Bearer <token>`.

Lista y alta de invitados por defecto (solo Admin):

```bash
curl -s http://localhost:3000/api/v1/qualification/default-meeting-attendees \
  -H "Authorization: Bearer $TOKEN"

curl -s -X POST http://localhost:3000/api/v1/qualification/default-meeting-attendees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"nuevo@grupoverytel.com\",\"name\":\"Nuevo\"}"
```

`PATCH /qualification/default-meeting-attendees/:id` con `{ "name": "Elena", "is_active": false }`. `DELETE` del mismo path responde `{ "deleted": true }`. Un rol distinto de Admin recibe 403. `GET /auth/me` de Admin incluye `{ "action": "manage_default_attendees", "subject": "DefaultMeetingAttendee" }`.

Agendar en la asignación (Soporte Comercial o Admin):

```bash
curl -s -X POST http://localhost:3000/api/v1/qualification/sqls/$SQL_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"comercial_asignado_id\":\"$USER_ID\",\"cita\":{\"lugar\":\"Teams\",\"fecha\":\"2026-11-20\",\"hora\":\"10:00\",\"contacto_nombre\":\"Ana\",\"contacto_email\":\"ana@cliente.com\",\"contactos\":[{\"nombre\":\"Ana\",\"email\":\"ana@cliente.com\",\"telefono\":\"3000000000\"}]}}"
```

Cita sobre un SQL ya asignado (`POST` y `PATCH /qualification/sqls/:id/cita`). Admin no pasa el `POST`. El detalle `GET /qualification/sqls/:id` trae `cita.attendees` con los tres correos, `source: "default"` y `sort_order` 1..3. También trae `graph_event_id`, `graph_organizer_upn` y `teams_join_url`.

Desactivar o borrar un invitado de la lista después de agendar no cambia `cita.attendees` ni los invitados del evento ya creado. Un `PATCH` de fecha u hora reenvía a Graph los correos del snapshot, no la lista viva.

### Attendees en Outlook

1. En la respuesta del CRM, anotar `cita.graph_organizer_upn` y `cita.graph_event_id`.
2. Abrir el calendario de ese organizador en Outlook y el evento de la cita (o el enlace `teams_join_url`).
3. Los asistentes requeridos del evento son: contactos de la cita, el correo de Soporte que agenda (si tiene buzón de la organización y no es el organizador) y los tres correos del seed.
4. El snapshot del CRM (`cita.attendees`) lista solo los invitados por defecto, incluido el organizador si su correo estuviera en la lista. Graph no pone al organizador como attendee. Con el seed actual ninguno de los tres es el organizador, así que los tres deben verse en Outlook y en `cita.attendees`.
5. Comprobación por Graph, con un token de aplicación distinto del JWT del CRM: `GET https://graph.microsoft.com/v1.0/users/{graph_organizer_upn}/events/{graph_event_id}?$select=attendees`. Cada `emailAddress.address` corresponde a lo del punto 3.

## Pendiente

No se actualiza `.cursor/skills/registrar-auditoria/SKILL.md` en esta rama. El skill todavía describe un `AuditService.log` escrito a mano. El código vivo audita con `AuditHooksService`.

Paso 3 (frontend) no está iniciado.
