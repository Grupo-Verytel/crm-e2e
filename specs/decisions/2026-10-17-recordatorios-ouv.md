# 2026-10-17 — Recordatorios de interacciones de OUV

Estado: aprobado con el Paso 0 (2026-10-17). Prevalece sobre el prompt maestro cuando chocan.

## D1 — Una fila en `reminders`, dos FK opcionales

Cada recordatorio apunta a exactamente una fuente: `interaction_id` (lead/SQL, ya existe) u `ouv_interaction_id` (nueva).

La FK real es `reminders.ouv_interaction_id CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci` → `ouv_interactions(ouv_interaction_id)` ON DELETE RESTRICT. No existe `ouv_interactions.id`. La PK de esa tabla es `ouv_interaction_id`.

Un `CHECK` exige `(interaction_id IS NOT NULL) + (ouv_interaction_id IS NOT NULL) = 1`. MySQL no permite `ON UPDATE` / `ON DELETE` distintos de `RESTRICT` en una columna usada por un `CHECK`. La FK nueva es `ON DELETE RESTRICT ON UPDATE RESTRICT`. La FK ya existente `reminders_ibfk_2` (`interaction_id`) tenía `ON UPDATE CASCADE`; la migración la pasa también a `RESTRICT` para que el `CHECK` sea válido. Los UUID no se reescriben y el borrado del proyecto es lógico (`deleted_at`), así que no hay cascada que preservar. El `down` devuelve `ON UPDATE CASCADE` a esa FK.

**Descartado:** tabla nueva; relación polimórfica `source_type` / `source_id`.

**Trade-off:** se amplía una tabla que ya sirve a leads. El `CHECK` y el validador impiden filas huérfanas o dobles. No se puede hacer `ON DELETE CASCADE` sobre esas FK.

## D2 — Outlook después, detrás de un flag

Los pasos 2 a 9 dejan el recordatorio usable dentro del CRM. La sincronización con Outlook es el paso 10 y solo corre si `OUTLOOK_SYNC_ENABLED=true` (default `false`). Con el flag apagado, `outlook_sync_status = NOT_REQUIRED`.

**Descartado:** bloquear el alta del recordatorio hasta que Graph responda.

## D3 — Permiso de aplicación, calendario del responsable

Graph usa el permiso de aplicación `Calendars.ReadWrite` del app registration que ya existe. El evento se crea solo en el calendario de `reminders.user_id` (`users.email`), nunca en un buzón de grupo.

Se reutilizan `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` y `GraphClientService`. No se crean variables `MS_GRAPH_*` ni un segundo cliente. Variables nuevas: `OUTLOOK_SYNC_ENABLED`, `OUTLOOK_SYNC_MAX_ATTEMPTS`, `OUTLOOK_SYNC_INTERVAL_MS` (default 60000) y `CRM_PUBLIC_URL` (obligatoria solo con el flag encendido; es el origen del enlace del evento).

**Descartado:** permiso delegado por usuario; SDK nuevo de Microsoft.

## D4 — Un solo tenant

`grupoverytel.com`. Un responsable fuera de ese dominio, o fuera del grupo que ya limita la application access policy de Exchange, no recibe evento. El recordatorio en el CRM se conserva.

## D5 — El CRM manda

Si Graph falla, el recordatorio no se revierte ni se bloquea. Queda `FAILED`, con `outlook_last_error` y `outlook_sync_attempts`. Un 403 de Graph no se reintenta.

## D6 — Del diseño solo la presentación

La carpeta de referencia es `crm-e2e-DesignJD`. Se portan piezas que reciben props y devuelven JSX.

No se portan `store.ts`, `RemindersProvider.tsx`, `sync-ouv-reminders.ts`, `ouv-seguimiento.ts`, `sql-seguimiento.ts` ni nada que lea `localStorage`. No se reemplazan `QualificationNav` ni `tokens.css` enteros: se agrega el NavLink, el tab y los tokens que faltan (`--semaphore-amarillo` con variante oscura, y `.bell-reminder-active`).

**Descartado:** copiar hooks, fetch, servicios o mocks del diseño. La regla de color del diseño (7 y 14 días sobre `remind_at`, calculada en el cliente) no se usa.

## D7 — Realizado no es un estado del enum

`status` sigue siendo `Pendiente` | `Enviado` | `Cancelado` (notificación). `completed_at DATETIME NULL` dice si el seguimiento se hizo. «Marcar como realizado» escribe `completed_at` y no toca `status` ni el evento de Outlook.

**Descartado:** agregar `Realizado` al enum.

## D8 — Amarillo a 2 días calendario

`FOLLOW_UP_YELLOW_DAYS` (default `2`, entero ≥ 0). La comparación es por instante, con el límite de «fin del día» calculado en America/Bogota (UTC−5, sin horario de verano), el mismo criterio que `remindAtFromEvent`. `event_at` y `remind_at` se guardan en UTC.

## D9 — Sin seguimiento es gris

OUV sin recordatorios no realizados → `follow_up_status = NONE`, círculo gris, texto «Sin seguimiento». No es lo mismo que vencido.

## D10 — Una interacción nueva no cierra recordatorios

Solo «Marcar como realizado» escribe `completed_at`.

## Decisiones de la aprobación del Paso 0

| ID | Decisión |
|---|---|
| A1 | En el modal de interacción de OUV, checkbox «Recordarme» con `event_at`, `remind_days_before` (default 1, rango 0–365) y `note` opcional. |
| A2 | El seguimiento se dibuja como el círculo del diseño. El color sale de `follow_up_status`. `title` y `aria-label` llevan estado y fecha. Cero cálculo en el cliente. |
| A3 | La X del diseño es «Cancelar»: `status = 'Cancelado'`, solo si está `Pendiente` y `completed_at` es nulo. No hay acción «Descartar» aparte. |
| A4 | Listado nuevo `GET /api/v1/qualification/assigned-ouvs`. El alcance sale de `ouv-access.ts`. `GET /discovery/ouvs` no se modifica. |
| A5 | El job de Outlook usa `setInterval`, como `RemindersService`. Sin `@nestjs/schedule`. Reclama filas con `SELECT … FOR UPDATE SKIP LOCKED`. |
| A6 | Un usuario tiene un solo `users.role_id`. El requisito de «varios roles, gana el más amplio» se elimina. |
| A7 | `event_at` en el futuro se valida solo al crear recordatorios de OUV. El alta de leads no cambia. |
| A8 | El tab lo ven `SoporteComercial` (todas, con filtro de comercial) y `EjecutivoComercial` (solo las suyas). En el diseño el ejecutivo no lo ve; manda este requisito. |
| A9 | La transacción única interacción + recordatorio es solo de OUV y extiende la que ya abre `OuvInteraccionesService.crear`. Leads siguen en dos requests. |
| A10 | La auditoría de `Reminder` la cubren los hooks de `AuditHooksService`. No se agregan escrituras manuales. Los tests comprueban las filas de `audit_log`. |
| A11 | No existe el subject CASL `Reminder`. Listar los de una OUV: `read Opportunity` y la misma regla que el detalle (`canReadAllOuvs`). Crear sigue en `update Opportunity` sobre el POST de la interacción. Completar y cancelar, para las dos fuentes, los autoriza solo `user_id = actor` (403 `{ code, message }` si no lo es). No se exige `update Opportunity` en esos PATCH: dejaría fuera al dueño de un recordatorio de lead. |
| A12 | `dispatchDue` excluye `completed_at IS NOT NULL` en el `where` actual (`status = Pendiente` y `remind_at <= now`). |

## Precisiones de la aprobación del Paso 1

| ID | Precisión |
|---|---|
| P1 | Si `remind_at` queda en el pasado y `event_at` es futuro, el recordatorio se acepta. `dispatchDue` lo notifica en el ciclo siguiente. No es error. El modal muestra «El aviso se enviará de inmediato». |
| P2 | La campana (vencidos / hoy / próximos) y el semáforo clasifican con `event_at`. Nunca con `remind_at`. |
| P3 | `GET /api/v1/reminders` filtra `user_id = actor` y resuelve la fuente con asociaciones Sequelize dentro de demand-generation (`Reminder → Interaction → Lead/SQL` y `Reminder → OuvInteraction → Ouv`). No importa `DiscoveryModule` ni `OuvsService`. |
| P4 | Los endpoints nuevos responden `{ code, message }`. Los endpoints que ya existían conservan la forma de error que tienen hoy. El `event_at` no futuro del POST de interacción OUV es la excepción pedida en el Paso 3: 400 `{ code: "VALIDATION_ERROR", message }`. |
| P5 | No hay edición de recordatorios. Outlook solo crea eventos y, al cancelar uno `SYNCED`, los elimina (el PATCH de cancelación deja `outlook_sync_status = PENDING`; el job es el paso 10). Completar no toca Outlook. |

## Precisiones de la aprobación del Paso 4

| ID | Precisión |
|---|---|
| A13 | `@nestjs/swagger` no está en `backend/package.json`. `ResponderOuvInteraccionDto` sigue usando `OmitType` de `@nestjs/mapped-types@2.1.1`. Excepción aprobada a la regla 3 de `CONSTITUTION.md` (el paso la llama R6: ninguna dependencia nueva sin decision record). La 2.1.0 no acepta `class-validator` 0.15; la 2.1.1 sí, y Nest 11. Si más adelante entra `@nestjs/swagger`, este DTO pasa a su `OmitType` y `@nestjs/mapped-types` se desinstala. |
| A14 | `search` de OUVs asignadas también compara `titulo`, con el mismo escape de `LIKE`. |

## Deuda anotada, fuera de este trabajo

`POST /leads/:id/interactions/:interactionId/reminders` y el equivalente de SQL exigen `read`, no `update`. Se deja así. No se corrige en esta entrega.

La subconsulta del semáforo (`MIN(event_at)` por OUV) recorre todas las `ouv_interactions`: el `EXPLAIN` del Paso 4 muestra `type ALL` sobre esa tabla. No se cambia ahora. Si el p95 del listado supera 1 s, la derivada debería filtrarse por las OUVs del alcance (el comercial, o el `comercial_id` pedido) en lugar de agrupar la bitácora completa.

`npm run lint` del frontend falla en archivos que esta funcionalidad no toca (`DatePickerField`, modales de cuentas y otros). No se corrige en esta entrega. El lint de los archivos nuevos sí queda en verde.

`reminder-errors.ts` asume que `VALIDATION_ERROR` siempre se refiere a la fecha. Si se reutiliza ese código, hay que distinguir por campo.
