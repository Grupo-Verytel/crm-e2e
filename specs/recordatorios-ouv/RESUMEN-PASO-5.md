# RESUMEN-PASO-5 — Campana de recordatorios

Fecha: 2026-10-17. Backend solamente. No se empezó el paso 6 ni el frontend. No hay `NOTAS-BLOQUEO-5.md`: inyectar el puerto de push no cierra un ciclo. `WorkflowEngineModule` no importa demand-generation.

## AJ5 — `OmitType`

`@nestjs/swagger` no está en `backend/package.json`. `ResponderOuvInteraccionDto` sigue con `OmitType` de `@nestjs/mapped-types@2.1.1`. Queda como excepción aprobada en el registro (`A13`): la regla 3 de `CONSTITUTION.md`, que este paso llama R6. La 2.1.0 no acepta `class-validator` 0.15. No hay OpenAPI que revisar: sin swagger, el hilo no publica un esquema. El test de AJ4 sigue rechazando `recordatorio` con 400.

## AJ6 — `search` incluye `titulo`

`GET /qualification/assigned-ouvs` compara `consecutivo`, `empresa_nombre` y `titulo` con el mismo `LIKE` y el mismo escape de `\`, `%` y `_`. El test de Soporte comprueba las tres columnas.

## AJ7 — Deuda, sin cambio de SQL

En el registro: la subconsulta del semáforo hace `type ALL` sobre `ouv_interactions`. No se tocó. Si el p95 pasa de 1 s, la derivada debería limitarse a las OUVs del alcance.

## Contrato

`GET /api/v1/reminders`

JWT. Siempre `user_id` del actor. Sin `CheckAbility`: no hay subject `Reminder`, y `read Opportunity` dejaría fuera al dueño de un recordatorio de lead. La validación de query es el `ValidationPipe` (400). Este GET no tiene un error de negocio propio.

Universo: `completed_at IS NULL`, `status IN ('Pendiente','Enviado')`, `deleted_at IS NULL`, y la interacción origen viva.

LEAD o SQL se distinguen por `interactions.sql_id`: nulo → `LEAD` (`source_id` = `lead_id`); con valor → `SQL` (`source_id` = `sql_id`). OUV cuando la fuente es `ouv_interaction_id` (`source_id` = `ouv_id`). Las tres se arman con asociaciones de Sequelize dentro de demand-generation (`interaction.lead`, `interaction.sql`, `ouvInteraction.ouv`). No se llama a `OuvsService` ni se importa qualification.

`sqls` no tiene columna `consecutivo`. `source_label` de un SQL es el acento que ya muestra el detalle: `SQL-` + los primeros 6 hex de `sql_id`. El de un lead es `leads.name` (o `Lead` si viene vacío). El de una OUV es `consecutivo — titulo`. `interaction_title` es `ouv_interactions.titulo` o `interactions.tipo`.

Grupo por `event_at` (nunca `remind_at`), con el fin de día de `bogota-day.ts`:

| Grupo | Regla |
|---|---|
| `OVERDUE` | `event_at < now` |
| `TODAY` | `now ≤ event_at ≤` fin del día Bogotá de hoy |
| `UPCOMING` | posterior a ese fin de día |

Orden: OVERDUE, TODAY, UPCOMING; dentro de cada grupo, `event_at` ascendente (el vencido más antiguo primero).

Query: `page` (default 1), `limit` (1–100, default 20), `group` opcional (uno o varios). `group` filtra `items` y `total`. `counts` no usa `group` ni la página: es el universo completo del usuario.

```json
{
  "items": [
    {
      "reminder_id": "uuid",
      "event_at": "2026-10-16T14:00:00.000Z",
      "remind_at": "2026-10-15T14:00:00.000Z",
      "note": "llamar",
      "status": "Pendiente",
      "group": "OVERDUE",
      "source_type": "LEAD",
      "source_id": "uuid-del-lead",
      "source_label": "Acme",
      "interaction_title": "Llamada"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20,
  "counts": { "OVERDUE": 4, "TODAY": 2, "UPCOMING": 9 }
}
```

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/reminders?page=1&limit=20&group=OVERDUE,TODAY"
```

El cálculo de día (inicio, fin, fin de hoy + N) está en `backend/src/common/time/bogota-day.ts`. `followUpYellowLimit` delega en `bogotaDayEndPlus`. Los bordes del Paso 4 siguen verdes.

## Aviso en vivo

`dispatchDue`, después de crear la fila y pasar el recordatorio a `Enviado`, llama a `emitToUser` del `NotificationsGateway` (el puerto `NOTIFICATION_PUSH_PORT`, `useExisting` del gateway). El evento del socket sigue siendo `notification`, el que ya escucha `NotificationsProvider`. No hay canal nuevo. Si el socket falla, la fila queda guardada y el despacho sigue.

## EXPLAIN

Sobre la base local, listado, conteo de página y conteos del ícono. `possible_keys` incluye `idx_reminders_user_due`. El plan elige `idx_reminders_user_id` (`type ref`, `rows` 1): con este volumen el índice más corto por `user_id` le basta, y `remind_at` (tercera columna de `idx_reminders_user_due`) no ordena esta consulta. El listado hace filesort por el `CASE` y por `event_at`. Las subconsultas de interacción viva usan la PK (`unique_subquery`).

```json
[
  {"id":1,"select_type":"PRIMARY","table":"r","type":"ref","possible_keys":"idx_reminders_user_id,idx_reminders_interaction_id,idx_reminders_status_remind_at,idx_reminders_ouv_followup,idx_reminders_user_due","key":"idx_reminders_user_id","rows":1,"Extra":"Using index condition; Using where; Using filesort"},
  {"id":3,"select_type":"DEPENDENT SUBQUERY","table":"ouv_interactions","type":"unique_subquery","key":"PRIMARY","rows":1,"Extra":"Using where"},
  {"id":2,"select_type":"DEPENDENT SUBQUERY","table":"interactions","type":"unique_subquery","key":"PRIMARY","rows":1,"Extra":"Using where"}
]
```

El conteo de página y el de `counts` repiten ese plan sin filesort.

## Tests

```
npx jest src/common/time/bogota-day.spec.ts src/modules/demand-generation/lib/reminder-group.spec.ts src/modules/demand-generation/services/reminders.service.spec.ts src/modules/qualification/lib/follow-up-status.spec.ts src/modules/qualification/services/assigned-ouvs.service.spec.ts src/modules/discovery/services/ouv-interacciones.service.spec.ts src/modules/discovery/dtos/ouv-interaccion.dto.spec.ts --no-coverage --runInBand
```

Test Suites: 7 passed, 7 total. Tests: 58 passed, 58 total. Time: 6.73 s.

Cubren el alcance por actor, la exclusión en SQL de realizados, cancelados, eliminados e interacciones eliminadas (lead y OUV), las tres etiquetas, los bordes de grupo en Node y en MySQL (vencido por 1 minuto, ahora, 23:59 Bogotá, 00:00 del día siguiente, 20:00 Bogotá = 01:00 UTC), conteos ajenos a la página y al filtro `group`, el `emitToUser`, y la regresión del semáforo del Paso 4 (incluido `titulo` en la búsqueda).
