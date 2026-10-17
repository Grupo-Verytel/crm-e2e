# RESUMEN-PASO-4 — OUVs asignadas y semáforo

Fecha: 2026-10-17. Backend solamente. No se empezó el paso 5 (campana), ni Outlook, ni el frontend.

No hay `NOTAS-BLOQUEO-4.md`. El único borrado de OUVs o de interacciones que existe es el soft delete de `ouv_interactions` (`paranoid`, `deleted_at`). `ouvs` no tiene `deleted_at` ni `destroy`. `force: true` aparece en kickoff y en venta ganada, sobre validaciones, miembros y alertas, no sobre OUVs ni interacciones. No hay `DELETE FROM ouvs` ni `DELETE FROM ouv_interactions`.

## AJ3 — Borrar una interacción cancela sus recordatorios abiertos

`OuvInteraccionesService.eliminar` cancela, en la misma transacción y antes del `destroy` de la interacción y de sus respuestas, los recordatorios de esa interacción con `status = Pendiente` y `completed_at` nulo. El `status` pasa a `Cancelado`. Si `outlook_sync_status` era `SYNCED`, pasa a `PENDING` y `outlook_event_id` se conserva. Un recordatorio ya realizado no entra en ese `WHERE` y no se actualiza.

Quedan fuera de `dispatchDue`, del listado por OUV y del semáforo los recordatorios cuya `ouv_interaction` tiene `deleted_at`. `dispatchDue` lo hace en el `WHERE` (un `IN` sobre interacciones vivas, sin citar el alias de Sequelize) y otra vez en el ciclo, por si una fila igual se colara en el lote de 50. Los recordatorios de lead (`ouv_interaction_id` nulo) siguen notificándose. La campana del paso 5 tiene que repetir el mismo predicado (`oi.deleted_at IS NULL`).

## AJ4 — El hilo no acepta `recordatorio`

`POST .../hilos` usa `ResponderOuvInteraccionDto`, `OmitType(CrearOuvInteraccionDto, ['recordatorio'])`. El `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) responde 400 si el cuerpo trae `recordatorio`. El alta de la interacción sigue aceptando el campo.

Se instaló `@nestjs/mapped-types@2.1.1`. La 2.1.0 declara peer opcional de `class-validator` `^0.13 || ^0.14` y este repo tiene `0.15.1`; la 2.1.1 acepta `^0.15` y Nest 11.

## Contrato

`GET /api/v1/qualification/assigned-ouvs`

CASL: `read` / `Opportunity`. El alcance usa `canReadAllOuvs` de `discovery/lib/ouv-access.ts`, sin copiar la lista de roles.

- `EjecutivoComercial` (`canReadAllOuvs` falso): `comercial_id =` el actor. El `comercial_id` de la query se ignora.
- Cualquier otro rol que ya pasó el `CheckAbility` (Soporte, Admin, …): todas las OUVs `EnCurso`, con `comercial_id` opcional.

Universo: `resultado = 'EnCurso'`. No hay filtro `deleted_at` sobre `ouvs` porque esa columna no existe.

Query:

| Param | Regla |
|---|---|
| `page` | entero ≥ 1, default 1 |
| `limit` | entero 1–100, default 20 (el diseño pagina de a 20) |
| `comercial_id` | UUID v4, opcional; ver alcance |
| `follow_up_status` | uno o varios de `RED`, `YELLOW`, `GREEN`, `NONE` (coma o array). Se aplica en SQL y el `total` usa el mismo filtro |
| `search` | consecutivo o `empresa_nombre`, máx. 200. `LIKE` con escape de `\`, `%` y `_` |

`SupportAssignedOuvsPage` no tiene un input propio: usa el buscador del módulo. El `q` del diseño busca también título, ciudad, vertical y segmento. Este endpoint busca solo consecutivo o cliente (`empresa_nombre`), como pidió el paso.

200:

```json
{
  "items": [
    {
      "ouv_id": "uuid",
      "consecutivo": "OUV-0001",
      "titulo": "…",
      "empresa_nombre": "…",
      "zona_actual": "UNIVERSO",
      "comercial_id": "uuid",
      "comercial_nombre": "…",
      "next_reminder_at": "2026-10-20T15:00:00.000Z",
      "follow_up_status": "YELLOW"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

Columnas tomadas de la tabla del diseño: `consecutivo` (OUV), `titulo` (Título), `empresa_nombre` (Empresa), `zona_actual` (Etapa), `comercial_nombre` (Comercial). El círculo de Seguimiento no es texto: lo pinta `follow_up_status`. Se añadieron `ouv_id` (la fila navega con ese id), `comercial_id` (el filtro) y `next_reminder_at` (pedido de este paso). `next_reminder_at` es nulo cuando el estado es `NONE`.

Errores de este GET: 400 del `ValidationPipe` si un query no cumple el DTO; 401 sin JWT; 403 si CASL niega `read Opportunity`. No hay `{ code, message }` propio: no hay un caso de negocio aparte de la validación.

El selector de comerciales no se creó. Sigue siendo `GET /api/v1/discovery/ouvs/ejecutivos-comerciales` (`read` / `Opportunity`).

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/qualification/assigned-ouvs?page=1&limit=20&follow_up_status=RED,YELLOW&search=Acme"
```

## Semáforo

`FOLLOW_UP_YELLOW_DAYS` está en `.env.example` y en `backend/.env.sample`, default 2. Si falta o viene en blanco, el servidor usa 2. Si no es un entero ≥ 0, `AssignedOuvsService.onModuleInit` lanza y Nest no arranca.

`now` y `yellow_limit` se calculan una vez en Node y entran como parámetros. `yellow_limit` es el último instante (23:59:59.999) del día calendario Bogotá de hoy + N, pasado a UTC. Bogotá es UTC−5, sin horario de verano.

La subconsulta es la pedida (`MIN(event_at)`, abiertos, interacción no eliminada) y se une con `LEFT JOIN`. El estado es el `CASE` pedido: nulo → `NONE`, `< :now` → `RED`, `<= :yellowLimit` → `YELLOW`, si no → `GREEN`.

`resolveFollowUpStatus(nextReminderAt, now, yellowDays)` usa la misma regla. La zona no es parámetro: está fija en `followUpYellowLimit`. Los tests de borde corren la función y el mismo `CASE` en MySQL (`timezone: Z`) y coinciden: vencido por 1 minuto (`RED`), el instante actual (`YELLOW`), hoy 23:59 Bogotá (`YELLOW`), el límite exacto de N días (`YELLOW`), N días + 1 minuto (`GREEN`), sin recordatorio (`NONE`), y 20:00 Bogotá = 01:00 UTC del día siguiente (con N = 0, las 00:00 Bogotá del día siguiente quedan en `GREEN`).

Orden: RED, YELLOW, GREEN, NONE; dentro del grupo, `next_reminder_at` ascendente y luego `consecutivo`.

## Rendimiento

No hay volumen de pre-producción. Se cargaron 2.000 OUVs `EnCurso` (prefijo `ZP`) y 10.000 recordatorios, se midió la misma SQL del listado y del conteo, y el `finally` borró esas filas. `leftover` quedó en 0. El script no era un seeder y se borró al terminar (`backend/scripts/` vuelve a tener solo `sync-openapi.js`).

Cinco corridas de listado + conteo, página de 20, sin filtro de comercial ni de estado: 294, 282, 312, 329 y 292 ms. Máximo 329 ms, por debajo de 2 s. Es el tiempo de las dos consultas, no del stack HTTP.

`EXPLAIN` del listado (MySQL 8). La derivada de recordatorios usa `idx_reminders_ouv_followup`. El filtro `EnCurso` usa `idx_ouvs_resultado`. El `ORDER BY` del `CASE` obliga a temporary + filesort; a este volumen no pasa de los 329 ms.

```json
[
  {"id":1,"select_type":"PRIMARY","table":"o","type":"ref","key":"idx_ouvs_resultado","rows":2143,"Extra":"Using index condition; Using temporary; Using filesort"},
  {"id":1,"select_type":"PRIMARY","table":"u","type":"eq_ref","key":"PRIMARY","rows":1,"Extra":null},
  {"id":1,"select_type":"PRIMARY","table":"<derived3>","type":"ref","key":"<auto_key0>","rows":2,"Extra":null},
  {"id":3,"select_type":"DERIVED","table":"oi","type":"ALL","key":null,"rows":2025,"Extra":"Using where; Using temporary"},
  {"id":3,"select_type":"DERIVED","table":"r","type":"ref","key":"idx_reminders_ouv_followup","rows":1,"Extra":"Using index condition; Using where"}
]
```

El conteo repite el plan y no hace filesort (`o` queda en `Using index condition`).

## Tests

```
npx jest src/modules/discovery/services/ouv-interacciones.service.spec.ts src/modules/discovery/dtos/ouv-interaccion.dto.spec.ts src/modules/demand-generation/services/reminders.service.spec.ts src/modules/qualification/lib/follow-up-status.spec.ts src/modules/qualification/services/assigned-ouvs.service.spec.ts --no-coverage --runInBand
```

Test Suites: 5 passed, 5 total. Tests: 42 passed, 42 total. Time: 6.241 s.

Cubren: borrar la interacción cancela el pendiente `SYNCED` (queda `PENDING` y conserva `outlook_event_id`) y no toca el realizado; `dispatchDue` no notifica un recordatorio cuya interacción ya no está; el hilo rechaza `recordatorio`; el ejecutivo ignora `comercial_id` ajeno; Soporte ve todas y puede filtrar; filtro de semáforo en la página y en el conteo; orden y paginación (`LIMIT`/`OFFSET`); la subconsulta excluye interacciones eliminadas; `FOLLOW_UP_YELLOW_DAYS` inválido aborta el arranque; bordes del semáforo en Node y en MySQL.
