# RESUMEN-PASO-2 — Migración y modelo de `reminders`

Fecha: 2026-10-17. La base local quedó con la migración aplicada.

## Precisiones P1–P4 (antes del código)

Quedaron escritas en `specs/recordatorios-ouv/spec.md` (v1.1) y en `specs/decisions/2026-10-17-recordatorios-ouv.md`:

- P1: `remind_at` en el pasado con `event_at` futuro se acepta. `dispatchDue` lo toma en el ciclo siguiente. El modal dirá «El aviso se enviará de inmediato» (paso 8).
- P2: campana y semáforo clasifican con `event_at`, nunca con `remind_at`.
- P3: `GET /api/v1/reminders` resuelve la fuente con asociaciones dentro de demand-generation. No importa `DiscoveryModule` ni `OuvsService`.
- P4: errores `{ code, message }` solo en endpoints nuevos. Los que ya existían no cambian.

## Hallazgo al migrar

MySQL 8.0.45 rechazó el `CHECK` mientras `interaction_id` tenía `ON UPDATE CASCADE` (`reminders_ibfk_2`):

`Column 'interaction_id' cannot be used in a check constraint ... referential action.`

`RESTRICT` sí convive con el `CHECK`. La migración quita ese `CASCADE` y lo vuelve a poner en el `down`. La FK nueva `fk_reminders_ouv_interaction` nace `ON DELETE RESTRICT ON UPDATE RESTRICT`. Los UUID no se actualizan y el borrado es lógico, así que no se pierde una cascada real. La spec y el registro de decisión quedaron alineados con esto.

Reusar el mismo nombre de FK en un solo `ALTER` también falló (`Duplicate foreign key constraint name`). El `up` hace el `DROP` y el `ADD` en dos sentencias.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/database/migrations/20261017100000-extend-reminders-ouv-source.js` | `up` / `down`, precondiciones (a) y (b) |
| `backend/src/modules/demand-generation/models/reminder.model.ts` | Columnas, `belongsTo(OuvInteraction)`, `assertSingleReminderSource` |
| `backend/src/modules/demand-generation/models/enums/outlook-sync-status.enum.ts` | `NOT_REQUIRED`, `PENDING`, `SYNCED`, `FAILED` |
| `backend/src/modules/demand-generation/models/reminder.model.spec.ts` | Ambas fuentes, ninguna, una sola |
| `backend/src/modules/discovery/models/ouv-interaction.model.ts` | `hasMany` con `require` diferido, para no ciclar el import |
| `specs/recordatorios-ouv/spec.md` | P1–P4 y la FK en `RESTRICT` |
| `specs/decisions/2026-10-17-recordatorios-ouv.md` | P1–P4 y el cambio de `reminders_ibfk_2` |

## Tests

`npx jest src/modules/demand-generation/models/reminder.model.spec.ts --no-coverage`

8 passed. El validador del modelo rechaza dos fuentes y ninguna, y acepta solo `interaction_id` o solo `ouv_interaction_id`. No abre conexión a MySQL.

## Fila local

Antes y después del ciclo run → undo → run, la única fila sigue igual:

| Campo | Valor |
|---|---|
| `reminder_id` | `8f79ee36-d808-4c46-bf4a-caf156950b25` |
| `interaction_id` | informado |
| `ouv_interaction_id` | `NULL` |
| `status` | `Enviado` |
| `event_at` | `2026-10-17T13:18:00.000Z` |
| `remind_days_before` | `1` |
| `remind_at` | `2026-10-16T13:18:00.000Z` |
| `completed_at` | `NULL` |
| `outlook_sync_status` | `NOT_REQUIRED` |
| `outlook_sync_attempts` | `0` |
| `deleted_at` | `NULL` |

`SELECT COUNT(*)` sigue en 1 después del `INSERT` inválido.

## migration:run

```
== 20261017100000-extend-reminders-ouv-source: migrating =======
== 20261017100000-extend-reminders-ouv-source: migrated (0.936s)
```

## migration:undo

```
== 20261017100000-extend-reminders-ouv-source: reverting =======
== 20261017100000-extend-reminders-ouv-source: reverted (0.765s)
```

Tras el undo no quedan `ouv_interaction_id` ni el `CHECK`, y `reminders_ibfk_2` vuelve a `ON UPDATE CASCADE`. La fila sigue en `Enviado`.

## migration:run (segunda vez)

```
== 20261017100000-extend-reminders-ouv-source: migrating =======
== 20261017100000-extend-reminders-ouv-source: migrated (0.847s)
```

## SHOW CREATE TABLE reminders

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

## INSERT inválido

Ambas fuentes en `NULL`, con un `user_id` existente:

```
ER_CHECK_CONSTRAINT_VIOLATED
Check constraint 'chk_reminders_single_source' is violated.
```

No se insertó la fila.

## Cómo probar

Desde `backend/`:

1. `npm run migration:status` — `20261017100000-extend-reminders-ouv-source` en up.
2. `SHOW CREATE TABLE reminders;`
3. Repetir el `INSERT` con `interaction_id` y `ouv_interaction_id` en `NULL`.
4. `npx jest src/modules/demand-generation/models/reminder.model.spec.ts --no-coverage`

## Riesgos

- El `up` no es una sola sentencia: si el segundo `ALTER` fallara después de soltar `reminders_ibfk_2`, `interaction_id` quedaría sin FK hasta corregirlo. En esta corrida no pasó.
- `OuvInteraction.hasMany(Reminder)` usa `require` diferido. Un import estático en los dos sentidos deja el modelo en `undefined` al cargar.
