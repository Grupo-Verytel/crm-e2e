# RESUMEN-PASO-10 — Sincronización con Outlook

Fecha: 2026-10-17. Sin push. Este paso queda sin commit.

## G4

`6bed18ec74d247e606e687d46e19942d595b138d` — `feat(recordatorios-ouv): paso 9 — recordatorios en la campana`

## AJ11

`GET` de interacciones de lead no devolvía `completed_at`. Se agregó al DTO de salida y a los dos mapeos, sin quitar campos y sin cambiar la ruta ni las reglas de lead o SQL:

- `ReminderResponseDto.completed_at`
- `InteractionsService.toResponseDto`
- `RemindersService.toResponse`

En `InteractionTimeline.tsx`, si el recordatorio trae `completed_at`, se muestra «Realizado» con `border-semaphore-verde text-ink`, el mismo tono que `ReminderTrayList`. No hay acciones de completar ni cancelar en esa línea.

No hay navegador en esta sesión. No se pudo pulsar el detalle de un lead. El cambio es la etiqueta sobre el campo que ahora viaja en el `GET`.

## Deuda

En `specs/decisions/2026-10-17-recordatorios-ouv.md`: `reminder-errors.ts` asume que `VALIDATION_ERROR` siempre se refiere a la fecha. Si se reutiliza ese código, hay que distinguir por campo. El mapa no se cambió.

## Variables

Se reutilizan `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` y `GraphClientService`. No hay otro cliente ni variables `MS_GRAPH_*`. `GraphIntegrationModule` ahora exporta `GraphClientService`. Demand-generation lo importa. El arranque local llegó a `Nest application successfully started` y registró `outlook sync disabled`. No hubo ciclo.

| Variable | Default | Validación al arrancar |
|---|---|---|
| `OUTLOOK_SYNC_ENABLED` | `false` | `true` o `false`. Vacío equivale a `false`. Otro valor impide el arranque. Con `false` el job no arranca. |
| `OUTLOOK_SYNC_MAX_ATTEMPTS` | `5` | Entero `>= 1`. Vacío usa 5. |
| `OUTLOOK_SYNC_INTERVAL_MS` | `60000` | Entero `>= 1000`. Vacío usa 60000. |
| `CRM_PUBLIC_URL` | ninguna | Obligatoria solo con el flag encendido. Tiene que ser una URL `http` o `https`. Si está escrita y es inválida, el arranque falla aunque el flag esté apagado. |

Quedaron en `.env.example` y `backend/.env.sample`. No se tocó `backend/.env`.

## Flujo

Solo entran recordatorios con `ouv_interaction_id` no nulo. Lead y SQL siguen en `NOT_REQUIRED` y el `SELECT` no los toma.

Con el flag apagado no hay `setInterval`. Con el flag encendido el intervalo es `OUTLOOK_SYNC_INTERVAL_MS`, el timer hace `unref` y `onModuleDestroy` lo limpia, igual que `dispatchDue`.

Cada ciclo lista hasta 20 ids, sin bloquearlos. Después, una transacción por id: `SELECT … WHERE reminder_id = ? … FOR UPDATE SKIP LOCKED`, llamada a Graph, `UPDATE` y commit. Si otro worker ya tiene la fila, `SKIP LOCKED` la deja fuera.

La lista también exige `completed_at IS NULL`, `outlook_sync_status IN ('PENDING','FAILED')` y `outlook_sync_attempts < OUTLOOK_SYNC_MAX_ATTEMPTS`. Un realizado no ocupa un cupo de los 20. Si aun así la fila bloqueada ya tiene `completed_at`, se suelta sin llamar a Graph y sin escribir el CRM.

| Estado | Acción |
|---|---|
| `Pendiente` o `Enviado`, sin `outlook_event_id` | `POST /users/{email}/events`. `subject`: `Recordatorio CRM: {consecutivo} — {título}`. Cuerpo HTML con la nota escapada y el enlace `{CRM_PUBLIC_URL}/opportunities/{ouvId}?tab=recordatorios`. `start` = `event_at` en UTC, `end` = inicio + 30 min, `timeZone: "UTC"`. `isReminderOn: true`, `reminderMinutesBeforeStart` = `remind_days_before × 1440`, `showAs: "free"`, `transactionId` = `reminder_id`. Si responde con id: `outlook_event_id`, `SYNCED`, `outlook_synced_at`. |
| `Pendiente` o `Enviado` y ya hay `outlook_event_id` | No se crea otro evento. Se deja `SYNCED` y se conserva el id. |
| `Cancelado` con `outlook_event_id` | `DELETE /users/{email}/events/{id}`. Un 404 cuenta como éxito. Después `outlook_event_id = NULL` y `NOT_REQUIRED`. |
| `Cancelado` sin `outlook_event_id` | `NOT_REQUIRED`, sin Graph. |
| `completed_at` con valor | No se hace nada en Outlook (D7). |

El correo se acepta solo si el dominio es exactamente `grupoverytel.com`. `frisson.net.co` no entra en este job, aunque sí esté en `GRAPH_ORG_DOMAINS` para Kickoff.

El job no escribe `status`, `completed_at` ni ningún otro campo de negocio del recordatorio (D5). Los logs llevan el id, la acción y el código HTTP. No llevan el token, el secreto ni el cuerpo del evento.

## Errores

| Caso | Graph | `outlook_sync_status` | Intentos | `outlook_last_error` |
|---|---|---|---|---|
| Correo fuera de `grupoverytel.com` | No se llama | `FAILED` | `MAX` | `Usuario fuera del tenant autorizado` |
| 403 al crear o al borrar, o 404 del buzón al crear | Sí | `FAILED` | `MAX` | `El buzón no está en el grupo autorizado de la política de aplicación (403\|404)` |
| 404 al borrar el evento | Sí, y cuenta como éxito | `NOT_REQUIRED` | No cambian | se limpia; `outlook_event_id` queda `NULL` |
| 429 | Sí | No cambia | No cambian | el mensaje de Graph. Se corta el ciclo. Con `Retry-After` se pausa hasta ese plazo, con tope de 1 hora. Sin cabecera, el ciclo siguiente puede seguir. |
| 5xx o error de red | Sí | `FAILED` | `+ 1` | mensaje truncado a 500 caracteres |
| Otro 4xx | Sí | `FAILED` | `+ 1` | mensaje truncado a 500 caracteres |

Un `remind_days_before` mayor de 28 produce más de 40320 minutos. Graph puede responder 400. Eso entra en la fila «otro 4xx» y se agota el tope de intentos. La alarma pedida es `días × 1440`.

## Alta, cancelación y borrado de la interacción

Siguen como quedaron antes de este paso. Los tests existentes vuelven a pasar:

- Alta de OUV: `OUTLOOK_SYNC_ENABLED=true` guarda `PENDING`; si no, `NOT_REQUIRED` (`ouv-interacciones.service.spec.ts`).
- Cancelar un `SYNCED` deja `PENDING` y conserva `outlook_event_id` (`reminders.service.spec.ts`).
- Borrar la interacción (AJ3) cancela el recordatorio abierto y, si estaba `SYNCED`, lo deja `PENDING` con el id (`ouv-interacciones.service.spec.ts`).

Lead y SQL no pasan por este job.

## Tests

`npx jest` de los specs nuevos más Kickoff, citas, interacciones de OUV y recordatorios:

```
Test Suites: 7 passed, 7 total
Tests:       67 passed, 67 total
```

Specs: `outlook-reminder-sync.service.spec.ts`, `graph-client.service.spec.ts`, `kickoff-invitation.template.spec.ts`, `sqls.service.spec.ts`, `sql-interactions.spec.ts`, `ouv-interacciones.service.spec.ts`, `reminders.service.spec.ts`.

El spec del job cubre crear con éxito, reintento tras un 5xx, fallo de red, 403 permanente, correo fuera del dominio sin Graph, 429 sin consumir intentos y cortando el ciclo, 429 sin `Retry-After`, borrar con éxito, borrar con 404, cancelado antes de sincronizar, realizado sin Graph, tope de intentos, no crear un segundo evento, `transactionId` = `reminder_id`, flag apagado sin `setInterval`, flag encendido con el intervalo, y el `SELECT` solo de OUV. `GraphClientService` sigue devolviendo el JSON en 200, `undefined` en 204, y en 429 adjunta `Retry-After` sin loguear el token ni el cuerpo.

`eslint` de los archivos nuevos queda en verde. En `interactions.service.ts` sigue un `no-base-to-string` de antes, en el conteo de interacciones, en una línea que este paso no tocó.

## Prueba manual para Evilio

El `backend/.env` de esta máquina no se modificó: el job sigue apagado. Para probarlo con tu buzón:

1. En `backend/.env` pon `OUTLOOK_SYNC_ENABLED=true`, `OUTLOOK_SYNC_MAX_ATTEMPTS=5`, `OUTLOOK_SYNC_INTERVAL_MS=60000` y `CRM_PUBLIC_URL` con el origen donde abres el frontend (en local, `http://localhost:5173`). Reinicia el backend. El log debe decir `outlook sync every 60000ms`. Si la URL falta o el flag no es `true`/`false`, el proceso no arranca.
2. Entra con un usuario cuyo correo sea `@grupoverytel.com` y esté en el grupo de la application access policy. Abre una OUV y crea una interacción con «Recordarme», pocos días de aviso y una fecha futura. En menos de un minuto debe aparecer en el calendario de ese usuario un evento «Recordatorio CRM: {consecutivo} — {título}», de 30 minutos, libre, con la nota y el enlace a `/opportunities/{id}?tab=recordatorios`. La alarma de Outlook es `días × 1440` minutos antes del inicio. En el CRM el recordatorio sigue `Pendiente` o, cuando toque, `Enviado`; `outlook_sync_status` pasa a `SYNCED`.
3. Cancela ese recordatorio en el CRM. El estado pasa a `Cancelado` y el id del evento se conserva. En el siguiente ciclo el evento desaparece de Outlook y `outlook_sync_status` queda `NOT_REQUIRED`.
4. Crea otro con un responsable cuyo correo no sea `@grupoverytel.com`, o con uno del dominio que no esté en el grupo de la política. El recordatorio permanece en el CRM. El primero queda `FAILED` sin llamada a Graph y con `outlook_last_error` = `Usuario fuera del tenant autorizado`. El segundo, tras el 403 o el 404 del buzón, queda `FAILED` permanente con el mensaje del grupo. Ninguno de los dos debe verse en Outlook.
5. Marca uno como realizado. Outlook no cambia.

## Fuera de este paso

No se sincronizan recordatorios de lead ni de SQL. No se editan recordatorios. Completar no toca el evento.
