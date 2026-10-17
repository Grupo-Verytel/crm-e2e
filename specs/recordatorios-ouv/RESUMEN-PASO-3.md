# RESUMEN-PASO-3 — Backend de recordatorios de OUV

Fecha: 2026-10-17. La migración quedó aplicada. No se empezó el paso 4.

## AJ1 — Migración re-ejecutable

`20261017100000-extend-reminders-ouv-source.js` consulta `information_schema` antes de cada paso y se salta lo que ya está:

- `COLUMNS` para cada columna nueva
- `TABLE_CONSTRAINTS` para el `CHECK` y las FK
- `REFERENTIAL_CONSTRAINTS` (`UPDATE_RULE` / `DELETE_RULE`) para no recrear una FK que ya es `RESTRICT` o, en el `down`, que ya volvió a `CASCADE`
- `STATISTICS` para cada índice

La precondición (a) solo corre si el `CHECK` todavía no existe. Si ya existe, un reintento no aborta por filas de OUV con `interaction_id` nulo.

El índice `idx_reminders_ouv_followup` se crea antes que `fk_reminders_ouv_interaction`, porque empieza por `ouv_interaction_id` y MySQL lo usa como índice de esa FK. El `down` suelta primero esa FK: si no, `DROP INDEX` falla con `needed in a foreign key constraint`.

Prueba, con la fila `8f79ee36-d808-4c46-bf4a-caf156950b25` (`Enviado`) intacta en los tres casos. `COUNT(*)` siguió en 1.

1. `migration:undo` dejó el esquema previo (`reminders_ibfk_2` en `ON UPDATE CASCADE`). Se hizo solo `ALTER TABLE reminders DROP FOREIGN KEY reminders_ibfk_2` y `migration:run`. Terminó en 3.818s. El `SHOW CREATE TABLE` de abajo es el de esa corrida.
2. `migration:run` → `No migrations were executed`. `migration:undo` (3.274s) → `migration:run` (4.469s). El `SHOW CREATE` volvió a ser el mismo.
3. Con el esquema ya migrado se borró la fila de `SequelizeMeta`, se volvió a soltar solo `reminders_ibfk_2` y se corrió `migration:run` (1.944s). Saltó columnas, `CHECK` e índices, recreó la FK en `RESTRICT` y el `SHOW CREATE` no cambió.

```sql
CREATE TABLE `reminders` (
  `reminder_id` char(36) NOT NULL,
  `user_id` char(36) NOT NULL,
  `interaction_id` char(36) DEFAULT NULL,
  `ouv_interaction_id` char(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `event_at` datetime NOT NULL,
  `remind_days_before` int NOT NULL,
  `remind_at` datetime NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `status` enum('Pendiente','Enviado','Cancelado') NOT NULL DEFAULT 'Pendiente',
  `completed_at` datetime DEFAULT NULL,
  `outlook_event_id` varchar(255) DEFAULT NULL,
  `outlook_sync_status` enum('NOT_REQUIRED','PENDING','SYNCED','FAILED') NOT NULL DEFAULT 'NOT_REQUIRED',
  `outlook_sync_attempts` int NOT NULL DEFAULT '0',
  `outlook_synced_at` datetime DEFAULT NULL,
  `outlook_last_error` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`reminder_id`),
  KEY `idx_reminders_user_id` (`user_id`),
  KEY `idx_reminders_interaction_id` (`interaction_id`),
  KEY `idx_reminders_status_remind_at` (`status`,`remind_at`),
  KEY `idx_reminders_ouv_followup` (`ouv_interaction_id`,`completed_at`,`status`,`event_at`),
  KEY `idx_reminders_user_due` (`user_id`,`status`,`remind_at`),
  KEY `idx_reminders_outlook_sync` (`outlook_sync_status`),
  CONSTRAINT `fk_reminders_ouv_interaction` FOREIGN KEY (`ouv_interaction_id`) REFERENCES `ouv_interactions` (`ouv_interaction_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `reminders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `reminders_ibfk_2` FOREIGN KEY (`interaction_id`) REFERENCES `interactions` (`interaction_id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_reminders_single_source` CHECK ((((`interaction_id` is not null) + (`ouv_interaction_id` is not null)) = 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
```

## AJ2 — Asociación

`@HasMany(() => Reminder)` con import de valor deja el target en `undefined`. Con `module: nodenext` el import se copia mientras `reminder.model.ts` todavía se está evaluando (ese archivo hace `belongsTo` de `OuvInteraction`). Se dejó el `require` dentro de la factory, que lee el export cuando Sequelize asocia. El test `AJ2` llama `getAssociatedClass()` y espera la clase `Reminder`.

## Spec

`specs/recordatorios-ouv/spec.md` pasó a v1.2. `REQ-17`: Outlook solo crea y elimina. Cancelar un `SYNCED` deja `outlook_sync_status = PENDING`; no hay `PATCH` del evento ni edición del recordatorio. Completar y cancelar los autoriza solo el responsable (`403 FORBIDDEN`). Estado inválido: `409 CONFLICT`. El registro de decisión anota P5 y ajusta A11.

## Contratos

Prefijo `api/v1`. JWT en todos. Los errores nuevos son el objeto `{ code, message }` (sin envolver). Los 400/403/404 que `POST .../interacciones` ya devolvía (OUV cerrada, sin permiso, no encontrada) siguen siendo texto.

### `POST /api/v1/discovery/ouvs/:ouvId/interacciones`

CASL: `update` / `Opportunity`. Misma autorización de siempre para anotar.

```json
{
  "titulo": "Seguimiento sede Norte",
  "observaciones": "opcional",
  "recordatorio": {
    "event_at": "2026-12-01T15:00:00.000Z",
    "remind_days_before": 1,
    "note": "opcional, máx. 500"
  }
}
```

`recordatorio` es opcional. Si no viene, la respuesta trae `"recordatorio": null` y no se inserta fila en `reminders`. Si viene, `event_at` es obligatorio y tiene que ser posterior a ahora. `remind_days_before` es entero 0–365; si se omite, el servidor usa 1. `remind_at = event_at − N × 24 h` con `remindAtFromEvent`. Un `remind_at` en el pasado con `event_at` futuro se acepta. `user_id` es el actor. `status` nace `Pendiente`. `interaction_id` queda null. `outlook_sync_status` es `NOT_REQUIRED` si `OUTLOOK_SYNC_ENABLED` no es `true`, y `PENDING` si lo es. Esta petición no llama a Graph.

201, la interacción de siempre más:

```json
"recordatorio": {
  "reminder_id": "uuid",
  "ouv_interaction_id": "uuid",
  "user_id": "uuid",
  "event_at": "2026-12-01T15:00:00.000Z",
  "remind_days_before": 1,
  "remind_at": "2026-11-30T15:00:00.000Z",
  "note": "opcional",
  "status": "Pendiente",
  "completed_at": null,
  "outlook_sync_status": "NOT_REQUIRED"
}
```

`event_at` que no es futuro, dentro de la misma transacción y antes de insertar:

`400 { "code": "VALIDATION_ERROR", "message": "event_at must be in the future" }`

Si el insert del recordatorio falla, la transacción hace rollback: no queda la interacción ni el recordatorio.

Un hilo (`POST .../hilos`) acepta el campo por compartir el DTO, lo valida y no crea recordatorio.

### `GET /api/v1/discovery/ouvs/:ouvId/recordatorios`

CASL: `read` / `Opportunity`. Alcance igual que `OuvsService.getDetalle`: `canReadAllOuvs`. Un `EjecutivoComercial` solo ve la OUV cuyo `comercial_id` es él. `SoporteComercial` ve cualquiera.

`404 { "code": "NOT_FOUND", "message": "OUV … not found" }`

`403 { "code": "FORBIDDEN", "message": "Not allowed to view this OUV" }`

200, array ordenado por `event_at` ascendente. Cada ítem es el recordatorio de arriba más `responsable_nombre` e `interaccion_titulo`.

### `PATCH /api/v1/reminders/:reminderId/complete`

Las dos fuentes. JWT, y solo `user_id = actor`. No hay subject `Reminder` y no se exige `update Opportunity`: eso dejaría fuera al dueño de un recordatorio de lead.

Escribe `completed_at = ahora`. No cambia `status`, `outlook_sync_status` ni `outlook_event_id`. Un `Enviado` no realizado sí se completa.

`403 { "code": "FORBIDDEN", "message": "Only the reminder owner can complete or cancel it" }`

`404 { "code": "NOT_FOUND", "message": "Reminder not found" }`

`409 { "code": "CONFLICT", "message" }` si está `Cancelado` (`Reminder is cancelled`), eliminado (`Reminder was deleted`) o ya realizado (`Reminder is already completed`).

200: `reminder_id`, `interaction_id`, `ouv_interaction_id`, `user_id`, `event_at`, `remind_days_before`, `remind_at`, `note`, `status`, `completed_at`, `outlook_sync_status`, `outlook_event_id`.

### `PATCH /api/v1/reminders/:reminderId/cancel`

Misma autorización y el mismo 403/404. Solo si `status = Pendiente`, `completed_at` es nulo y no está eliminado. Escribe `status = Cancelado`. No borra la fila y no escribe `completed_at`. Si `outlook_sync_status` era `SYNCED`, pasa a `PENDING` y conserva `outlook_event_id` para que el job del paso 10 borre el evento. Esta petición no llama a Graph.

`409 { "code": "CONFLICT", "message" }` si no está `Pendiente` (`Only a pending reminder can be cancelled`), si ya está realizado (`A completed reminder cannot be cancelled`) o si está eliminado (`Reminder was deleted`).

200: el mismo cuerpo que complete.

No hay endpoint de edición.

### `dispatchDue`

El `where` quedó `status = Pendiente`, `remind_at <= now` y `completed_at IS NULL`. Un lead `Pendiente` con `completed_at` nulo y `remind_at` vencido sigue pasando a `Enviado`. El cuerpo de la notificación no se tocó.

## Tests

```
npx jest src/modules/demand-generation/models/reminder.model.spec.ts src/modules/discovery/services/ouv-interacciones.service.spec.ts src/modules/demand-generation/services/reminders.service.spec.ts --no-coverage --runInBand

Test Suites: 3 passed, 3 total
Tests:       30 passed, 30 total
```

Cubren: alta con y sin recordatorio; `event_at` pasado no inserta y la transacción no hace commit; fallo del insert del recordatorio hace rollback de la misma transacción; flag `true` → `PENDING` y cualquier otro valor → `NOT_REQUIRED`; `remind_at` pasado con `event_at` futuro se acepta; listado de un ejecutivo sobre OUV ajena es 403 y no consulta; la propia ordena por `event_at`; Soporte ve una OUV ajena; complete del responsable no toca `status` ni Outlook; otro usuario 403; cancelado, eliminado y ya realizado son 409; cancel de un `Pendiente` y de un `SYNCED` (pasa a `PENDING` y conserva `outlook_event_id`); cancel de `Enviado`, `Cancelado`, realizado o eliminado es 409; `dispatchDue` filtra `completed_at IS NULL` y sigue enviando el de lead; `createForInteraction` acepta `event_at` pasado y no escribe `ouv_interaction_id`; el POST de SQL y el de leads siguen delegando sin esa validación; `afterCreate` / `afterUpdate` de `AuditHooksService` piden al writer una fila `tabla = reminders` (`INSERT`, y `UPDATE` de `completed_at` y `status`). No hay insert manual en `audit_log`.

## curl

Sustituir el host, el token y los ids.

```bash
curl -s -X POST "http://localhost:3000/api/v1/discovery/ouvs/OUV_ID/interacciones" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"titulo\":\"Seguimiento sede Norte\",\"observaciones\":\"Nota\",\"recordatorio\":{\"event_at\":\"2026-12-01T15:00:00.000Z\",\"remind_days_before\":1,\"note\":\"Llamar\"}}"

curl -s -X POST "http://localhost:3000/api/v1/discovery/ouvs/OUV_ID/interacciones" \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"titulo\":\"Solo la nota\"}"

curl -s "http://localhost:3000/api/v1/discovery/ouvs/OUV_ID/recordatorios" \
  -H "Authorization: Bearer TOKEN"

curl -s -X PATCH "http://localhost:3000/api/v1/reminders/REMINDER_ID/complete" \
  -H "Authorization: Bearer TOKEN"

curl -s -X PATCH "http://localhost:3000/api/v1/reminders/REMINDER_ID/cancel" \
  -H "Authorization: Bearer TOKEN"
```
