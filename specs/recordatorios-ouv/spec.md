# Spec — Recordatorios en interacciones de OUV

**Versión:** 1.2
**Fecha:** 2026-10-17
**Estado:** Aprobado para implementación (Paso 3: sin edición; Outlook solo crea y elimina)
**Decisión:** `specs/decisions/2026-10-17-recordatorios-ouv.md`
**Inventario:** `specs/recordatorios-ouv/RESUMEN-PASO-0.md`

Los identificadores REQ de abajo ya no incluyen el antiguo REQ-12 (varios roles). Un usuario tiene un solo `users.role_id`.

---

## 1. Objetivo

Poder crear un recordatorio al registrar una interacción de OUV, verlo en el detalle de la OUV y en la campana, marcarlo realizado o cancelarlo, y mostrar en Calificación un tab «OUVs asignadas» con un semáforo de seguimiento calculado en el servidor. Outlook queda detrás de un flag y no puede deshacer el recordatorio.

## 2. Alcance

Dentro:

- Ampliar `reminders` (sin tabla nueva) y el modelo Sequelize.
- Alta de interacción de OUV con recordatorio opcional, en la transacción que ya abre `OuvInteraccionesService.crear`.
- Listar y cancelar recordatorios de OUV. Marcar realizado sirve para OUV y para lead/SQL. No hay edición de un recordatorio ya creado.
- Excluir realizados del despacho que pasa un recordatorio a `Enviado`.
- `GET /api/v1/qualification/assigned-ouvs` con alcance de `ouv-access.ts`.
- Listado de recordatorios del usuario actual, de las dos fuentes.
- UI según `crm-e2e-DesignJD`, solo presentación.
- Job de Outlook con `setInterval` y `GraphClientService`.

Fuera:

- Cambiar el flujo de leads (dos requests, sin validar `event_at` futuro, permiso `read` en el POST existente).
- Modificar `GET /api/v1/discovery/ouvs`.
- Subject CASL `Reminder`, variables `MS_GRAPH_*`, segundo cliente Graph, `@nestjs/schedule`.
- Portar `store.ts`, `RemindersProvider.tsx`, `sync-ouv-reminders.ts`, `ouv-seguimiento.ts`, `sql-seguimiento.ts` o cualquier `localStorage` del diseño.
- Reemplazar `QualificationNav` o `tokens.css` completos.
- Varios roles por usuario.
- La X del diseño como acción distinta de Cancelar.
- Editar un recordatorio (`event_at`, `remind_days_before`, `note`) después de crearlo. Outlook no actualiza eventos: solo los crea y, al cancelar uno `SYNCED`, los elimina.
- Cerrar recordatorios al registrar otra interacción.
- Corregir que los POST de recordatorio de lead y de SQL pidan `read` en lugar de `update`. Deuda técnica, otro cambio.

## 3. Modelo

### 3.1 Precondiciones de la migración

La migración aborta con un mensaje explícito si falla alguna:

- (a) `SELECT COUNT(*) FROM reminders WHERE interaction_id IS NULL` = 0. En local, el 2026-10-17, la tabla tiene 1 fila y ese conteo es 0. Se vuelve a evaluar en cada ambiente.
- (b) `ouv_interactions.ouv_interaction_id` es `CHAR(36) utf8mb4 utf8mb4_0900_ai_ci`, igual que la columna nueva. Confirmado con `SHOW CREATE TABLE ouv_interactions`.

`down` revierte columnas, FK, `CHECK` e índices agregados.

### 3.2 DDL

MySQL 8.0.45 admite el `CHECK`.

```sql
ALTER TABLE reminders
  ADD COLUMN ouv_interaction_id CHAR(36)
      CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL
      AFTER interaction_id,
  ADD COLUMN completed_at DATETIME NULL AFTER status,
  ADD COLUMN outlook_event_id VARCHAR(255) NULL,
  ADD COLUMN outlook_sync_status
      ENUM('NOT_REQUIRED','PENDING','SYNCED','FAILED')
      NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN outlook_sync_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN outlook_synced_at DATETIME NULL,
  ADD COLUMN outlook_last_error VARCHAR(500) NULL,
  ADD CONSTRAINT fk_reminders_ouv_interaction
      FOREIGN KEY (ouv_interaction_id)
        REFERENCES ouv_interactions (ouv_interaction_id)
        ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT chk_reminders_single_source
      CHECK ((interaction_id IS NOT NULL) + (ouv_interaction_id IS NOT NULL) = 1),
  ADD INDEX idx_reminders_ouv_followup (ouv_interaction_id, completed_at, status, event_at),
  ADD INDEX idx_reminders_user_due (user_id, completed_at, status, event_at),
  ADD INDEX idx_reminders_outlook_sync (outlook_sync_status);
```

La FK previa `reminders_ibfk_2` (`interaction_id`) pasa de `ON UPDATE CASCADE` a `ON UPDATE RESTRICT` en la misma migración. Sin eso MySQL rechaza el `CHECK`. El `down` restaura el `CASCADE`.

`Reminder` gana `belongsTo` `OuvInteraction`. `OuvInteraction` gana `hasMany` `Reminder`. El validador del modelo rechaza cero fuentes y dos fuentes.

`event_at` y `remind_at` siguen siendo instantes UTC (`timezone: '+00:00'` en Sequelize). `remind_at = event_at − remind_days_before × 24 h` (`remindAtFromEvent`).

### 3.3 Recordatorio no realizado

`completed_at IS NULL AND status <> 'Cancelado' AND deleted_at IS NULL` y, si la fuente es una interacción de OUV, `ouv_interactions.deleted_at IS NULL`.

### 3.4 Semáforo

Fecha evaluada = `MIN(event_at)` de los recordatorios no realizados de todas las `ouv_interactions` de la OUV. El semáforo usa `event_at`, nunca `remind_at`. Una subconsulta agrupada por OUV, unida con `LEFT JOIN`. No se persiste. No hay una consulta por fila.

`now`, «hoy» y el fin del día se calculan en America/Bogota (UTC−5 fijo). Con `FOLLOW_UP_YELLOW_DAYS = N`, el límite es el último instante del día calendario Bogotá de (hoy + N).

| `follow_up_status` | Etiqueta | Regla |
|---|---|---|
| `RED` | Vencido | fecha evaluada < ahora |
| `YELLOW` | Próximo | ahora ≤ fecha evaluada ≤ fin del día (hoy + N) |
| `GREEN` | Al día | fecha evaluada > ese fin de día |
| `NONE` | Sin seguimiento | no hay recordatorios no realizados (`next_reminder_at` nulo) |

Orden por defecto: RED, YELLOW, GREEN, NONE. Dentro de cada grupo, `next_reminder_at` ascendente y luego `consecutivo` (los `NONE` no tienen fecha). Filtro y orden se resuelven en SQL (`CASE` sobre la misma fecha) para que la página sea correcta. Función pura `resolveFollowUpStatus(nextReminderAt, now, yellowDays)` (la zona es America/Bogota, fija dentro de la función), con tests de borde: vencido por 1 minuto, igual a ahora, hoy 23:59 Bogotá, límite exacto de N días, N días + 1 minuto, sin recordatorios, y cambio de día UTC vs Bogotá.

## 4. Contratos HTTP

Prefijo `api/v1`. JWT global. Los endpoints nuevos de esta spec responden errores de negocio con `{ code, message }` (`VALIDATION_ERROR`, `NOT_FOUND`), igual que `RemindersService`. Los endpoints que ya existían no cambian su forma de error: un 400, 403 o 404 que hoy es texto sigue siendo texto. El `ValidationPipe` global sigue respondiendo 400 con la forma de class-validator.

CASL: no hay subject `Reminder`.

Alcance de OUV: `canReadAllOuvs` / `canReadOuv` de `discovery/lib/ouv-access.ts`. No se copia esa lógica. `EjecutivoComercial` solo ve `ouvs.comercial_id =` su `user_id`. Cualquier otro rol que ya pasó el `CheckAbility` ve todas. Un `comercial_id` de query solo se aplica cuando `canReadAllOuvs` es verdadero; si lo manda un ejecutivo, se ignora.

El `user_id` del recordatorio nuevo es el usuario autenticado. El cliente no lo envía.

### 4.1 Crear interacción de OUV, con recordatorio opcional

`POST /api/v1/discovery/ouvs/:ouvId/interacciones`

CASL: `update` / `Opportunity`.

Misma autorización que hoy tiene `crear`: `Admin`, `SoporteComercial`, o el ejecutivo dueño. OUV cerrada (`resultado <> EnCurso`): 400, sin fila nueva.

Cuerpo (se extiende `CrearOuvInteraccionDto`; sin `recordatorio` el comportamiento actual no cambia):

```json
{
  "titulo": "Seguimiento sede Norte",
  "observaciones": "opcional",
  "recordatorio": {
    "event_at": "2026-10-20T15:00:00.000Z",
    "remind_days_before": 1,
    "note": "opcional, máx. 500"
  }
}
```

`remind_days_before`: entero 0–365. Si el cliente lo omite dentro de `recordatorio`, el servidor usa 1. `event_at` obligatorio cuando `recordatorio` viene, y tiene que ser estrictamente posterior a ahora. Esto no se aplica a leads. Un `event_at` que no es futuro responde 400 `{ "code": "VALIDATION_ERROR", "message" }` y no crea la interacción. Los 400/403/404 que este POST ya devolvía (OUV cerrada, sin permiso, no encontrada) siguen siendo texto.

Si `remind_at` (`event_at − remind_days_before × 24 h`) queda en el pasado y `event_at` es futuro, el alta se acepta. No es un error de validación. `dispatchDue` lo notifica en el ciclo siguiente, porque su criterio sigue siendo `remind_at <= now`. El modal (paso 8) muestra la nota «El aviso se enviará de inmediato».

201. La respuesta actual de la interacción más `recordatorio` nulo o el recordatorio creado (`reminder_id`, `ouv_interaction_id`, `user_id`, `event_at`, `remind_days_before`, `remind_at`, `note`, `status`, `completed_at`, `outlook_sync_status`). Interacción y recordatorio en la misma transacción. Si el recordatorio es inválido, no queda la interacción.

`POST .../hilos` usa `ResponderOuvInteraccionDto` (`OmitType` sin `recordatorio`). El `ValidationPipe` rechaza el campo con 400.

Al borrar la interacción (soft delete), en la misma transacción, sus recordatorios `Pendiente` y no realizados pasan a `Cancelado`. Si alguno estaba `SYNCED`, `outlook_sync_status` pasa a `PENDING` y se conserva `outlook_event_id`. Un recordatorio ya realizado no se toca. `dispatchDue`, el listado por OUV y el semáforo excluyen recordatorios cuya interacción tiene `deleted_at`.

Alta con flag apagado: `outlook_sync_status = NOT_REQUIRED`. Con flag encendido: `PENDING`. El job no corre en esta petición.

### 4.2 Listar recordatorios de una OUV

`GET /api/v1/discovery/ouvs/:ouvId/recordatorios`

CASL: `read` / `Opportunity`, y la misma regla de lectura que `OuvsService.getDetalle` (`canReadAllOuvs`: el ejecutivo solo ve la OUV cuyo `comercial_id` es él). 404 `{ code: "NOT_FOUND" }` si la OUV no existe. 403 `{ code: "FORBIDDEN" }` si está fuera de alcance.

200, orden `event_at` ascendente. Cada ítem: `reminder_id`, `ouv_interaction_id`, `event_at`, `remind_days_before`, `remind_at`, `note`, `status`, `completed_at`, `user_id`, `responsable_nombre`, `interaccion_titulo`, `outlook_sync_status`. Sin paginación obligatoria en este listado (es el de un detalle).

### 4.3 Editar recordatorio

Fuera de alcance. No hay `PATCH /api/v1/reminders/:reminderId`. Outlook no actualiza eventos.

### 4.4 Cancelar

`PATCH /api/v1/reminders/:reminderId/cancel`

Sirve para las dos fuentes. Autorización: solo el responsable (`user_id` = actor). No hay subject CASL `Reminder` y no se exige `update Opportunity`, porque eso dejaría fuera al dueño de un recordatorio de lead. Si el actor no es el responsable: 403 `{ code: "FORBIDDEN", message }`. Si el id no existe: 404 `{ code: "NOT_FOUND", message }`.

Solo si `status = Pendiente` y `completed_at` es nulo y la fila no está eliminada. Escribe `status = Cancelado`. No borra la fila. No escribe `completed_at`. Si `outlook_sync_status = SYNCED`, lo pasa a `PENDING` para que el job del paso 10 elimine el evento. Esta petición no llama a Graph.

409 `{ code: "CONFLICT", message }` si ya está `Enviado`, `Cancelado`, realizado o eliminado.

### 4.5 Marcar como realizado

`PATCH /api/v1/reminders/:reminderId/complete`

Misma autorización que cancelar: solo el responsable. 403 y 404 con la misma forma.

Escribe `completed_at = ahora`. No modifica `status`. No crea, edita ni borra el evento de Outlook. No cambia `outlook_sync_status` ni `outlook_event_id`.

409 `{ code: "CONFLICT", message }` si está `Cancelado`, eliminado o `completed_at` ya no es nulo. Un recordatorio `Enviado` y no realizado sí se puede completar.

### 4.6 OUVs asignadas

`GET /api/v1/qualification/assigned-ouvs`

CASL: `read` / `Opportunity`. Alcance según §4. `GET /discovery/ouvs` no se toca.

Query: `page` (default 1), `limit` (default 20, máximo 100), `comercial_id` (UUID, solo si `canReadAllOuvs`), `follow_up_status` (uno o varios: `RED|YELLOW|GREEN|NONE`) y `search` (consecutivo, `empresa_nombre` o `titulo`, con escape de `LIKE`). Universo: `resultado = EnCurso`. `ouvs` no tiene `deleted_at`.

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

`next_reminder_at` es nulo cuando `follow_up_status` es `NONE`.

El selector de comerciales reutiliza `GET /api/v1/discovery/ouvs/ejecutivos-comerciales`. No se crea otro.

El tab en la UI lo muestran `SoporteComercial` y `EjecutivoComercial`. El filtro de comercial solo se muestra si `canReadAllOuvs` (en la práctica, Soporte; el ejecutivo no lo ve y, si lo enviara, el servidor lo ignora). El patrón de filtros es draft/applied. El círculo de seguimiento no recalcula el color.

### 4.7 Mis recordatorios

`GET /api/v1/reminders`

JWT. Siempre `user_id` = usuario actual. No hay `CheckAbility`: no existe subject `Reminder`, y exigir `read Opportunity` dejaría fuera al dueño de un recordatorio de lead. Incluye lead, SQL y OUV. La fuente se resuelve con asociaciones de Sequelize dentro de demand-generation: `Reminder → Interaction → Lead` y `Reminder → Interaction → Sql`, y `Reminder → OuvInteraction → Ouv`. Ese listado no llama a `OuvsService`. Demand-generation no importa qualification para el cálculo de día: inicio, fin y fin de hoy + N viven en `backend/src/common/time/bogota-day.ts`.

Universo: `completed_at IS NULL`, `status IN ('Pendiente','Enviado')`, `deleted_at IS NULL`, y la interacción origen viva (`interactions.deleted_at IS NULL` u `ouv_interactions.deleted_at IS NULL`).

LEAD si `interactions.sql_id` es nulo. SQL si `interactions.sql_id` tiene valor. OUV si la fuente es `ouv_interaction_id`.

`sqls` no tiene columna `consecutivo`. `source_label` de un SQL es el mismo acento que el detalle (`SQL-` + los primeros 6 hex de `sql_id`). El de un lead es `leads.name` (o `Lead` si viene vacío). El de una OUV es `consecutivo — titulo`. `interaction_title` es `ouv_interactions.titulo` o `interactions.tipo`.

El grupo se calcula en el servidor con `event_at`, nunca con `remind_at`: `OVERDUE` si `event_at < now`; `TODAY` si `event_at >= now` y no pasa del fin del día de hoy en Bogotá; `UPCOMING` si es posterior.

Query: `page` (default 1), `limit` (1–100, default 20) y `group` opcional (uno o varios de `OVERDUE|TODAY|UPCOMING`). Orden: OVERDUE, TODAY, UPCOMING; dentro de cada grupo, `event_at` ascendente. `counts` (`OVERDUE`, `TODAY`, `UPCOMING`) sale del universo completo del usuario: no aplica `group` ni la página. `total` sí respeta `group`.

200: `{ items, total, page, limit, counts }`. Cada ítem: `reminder_id`, `event_at`, `remind_at`, `note`, `status`, `group`, `source_type`, `source_id`, `source_label`, `interaction_title`.

Cuando `dispatchDue` crea la fila en `notifications`, llama a `emitToUser` del gateway que ya existe. El evento del socket sigue siendo `notification`. No hay canal nuevo.

La validación de query es el `ValidationPipe` (400). No hay un error de negocio propio de este GET.

### 4.8 Despacho a `Enviado`

Sin ruta nueva. `RemindersService.dispatchDue` agrega `completed_at IS NULL` al `where` de `status = Pendiente` y `remind_at <= now`. Un realizado no genera fila en `notifications` ni pasa a `Enviado`. Un lead con `completed_at` nulo sigue despachándose igual.

## 5. Outlook (paso 10)

Variables nuevas en `backend/.env.example`, sin valores: `OUTLOOK_SYNC_ENABLED` (default `false`), `OUTLOOK_SYNC_MAX_ATTEMPTS`. Las credenciales siguen siendo `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`.

El job es un `setInterval` en el mismo estilo que `RemindersService`. Toma filas `PENDING`, o `FAILED` con `outlook_sync_attempts` menor que el máximo, con `SELECT … FOR UPDATE SKIP LOCKED` dentro de una transacción. Si `outlook_event_id` ya existe, no crea otro evento: actualiza.

- Crear: `POST /users/{email}/events`. Asunto con la fuente y el consecutivo de la OUV. Cuerpo con la nota y el enlace al CRM. Inicio = `event_at` en UTC, enviado a Graph con la zona que el cliente actual ya usa para Bogotá. `isReminderOn = true`. `reminderMinutesBeforeStart = remind_days_before × 1440`. Luego `outlook_event_id`, `SYNCED`, `outlook_synced_at`.
- Editar un `SYNCED`: `PATCH /users/{email}/events/{outlook_event_id}`.
- Cancelar un `SYNCED`: `DELETE` de ese evento.

403 de Graph: `FAILED`, `outlook_last_error` claro, sin más reintentos. Otro fallo: `FAILED`, incrementa intentos, conserva el recordatorio. El máximo de intentos lo corta.

Marcar realizado no llama a Graph.

## 6. UI

- Modal de interacción de OUV: checkbox «Recordarme». Si está activo, `event_at`, `remind_days_before` (default 1) y `note`. Validación de fecha futura de `event_at` también en el cliente. Si ese `event_at` es futuro y el aviso (`remind_at`) ya pasó, el modal muestra «El aviso se enviará de inmediato» y deja guardar. Al guardar, se refresca el tab de recordatorios sin recargar la página.
- Tab «Recordatorios» en el detalle de la OUV: lista, cancelar si `Pendiente` y no realizado, marcar realizado si `completed_at` es nulo. Los realizados se ven con su `completed_at`.
- Tab «OUVs asignadas» junto a los tabs actuales de Calificación, sin sustituir el nav. Columna Seguimiento: círculo. Gris si `NONE`. `title` y `aria-label` con estado y fecha, por ejemplo `Vencido — 15/10/2026 10:00` o `Sin seguimiento`. Filtro de seguimiento dentro de draft/applied.
- Campana: tab «Recordatorios» al lado de «Notificaciones». Grupos vencidos / hoy / próximos. Etiqueta de fuente y enlace. «Marcar como realizado» lo saca de los pendientes. Cancelar solo en `Pendiente` no realizado. Se reutiliza el WebSocket de notificaciones si el panel ya escucha; no se abre un canal nuevo.
- Tokens nuevos, no un reemplazo del archivo: `--semaphore-amarillo` y su variante oscura; animación `.bell-reminder-active`. Clase Tailwind `semaphore-amarillo`.

## 7. Requisitos EARS

### Datos

**REQ-01 (Ubicuo).** El sistema debe asociar cada recordatorio a exactamente una fuente: `interaction_id` o `ouv_interaction_id`.

Aceptación: una fila con solo `interaction_id` y una con solo `ouv_interaction_id` se guardan. La FK de OUV apunta a `ouv_interactions.ouv_interaction_id`.

**REQ-02 (No deseado).** Si se intenta guardar un recordatorio con las dos fuentes o con ninguna, el sistema debe rechazarlo con 400 `VALIDATION_ERROR` antes de escribir en la base.

Aceptación: el validador del modelo falla en los dos casos; un `INSERT` que se salte el modelo también falla por el `CHECK`.

**REQ-03 (Ubicuo).** Los recordatorios de lead/SQL deben seguir el comportamiento actual: dos requests, sin rechazo por fecha pasada, mismo cálculo de `remind_at`, mismo despacho cuando `completed_at` es nulo.

Aceptación: un test de regresión crea un recordatorio de lead y `dispatchDue` lo pasa a `Enviado`.

### Alta desde la interacción de OUV

**REQ-04 (Evento).** Cuando el usuario registra una interacción de OUV con «Recordarme», el sistema debe crear la interacción y el recordatorio en la transacción que ya abre `OuvInteraccionesService.crear`.

Aceptación: si el insert del recordatorio falla, no queda la interacción. Sin `recordatorio`, el POST actual sigue igual.

**REQ-05 (No deseado).** Si el recordatorio de OUV trae `event_at` que no es futuro, o le faltan campos obligatorios, el sistema debe rechazar la operación completa y no crear la interacción. Un `remind_at` en el pasado, con `event_at` futuro, no es este caso: se acepta y `dispatchDue` lo notifica en el ciclo siguiente.

Aceptación: 400 y conteo de `ouv_interactions` y `reminders` sin cambio cuando `event_at` no es futuro. El mismo `event_at` pasado, enviado al POST de leads, sigue aceptándose. Un alta con `event_at` dentro de 12 horas y `remind_days_before = 1` persiste y queda elegible para el próximo `dispatchDue`.

**REQ-06 (Ubicuo).** Los campos son `event_at`, `remind_days_before` (default 1, 0–365) y `note` opcional. `remind_at` se calcula con `remindAtFromEvent`. El responsable es el usuario autenticado. `status` inicial es `Pendiente`.

Aceptación: el cuerpo sin `remind_days_before` persiste 1. El cliente no puede fijar `user_id` ni `status`.

**REQ-07 (Ubicuo).** Crear, cancelar, marcar realizado y pasar a `Enviado` deben quedar en `audit_log` por los hooks ya registrados en `AuditHooksService`. No se agregan escrituras manuales. No hay edición de campos del recordatorio.

Aceptación: un test de cada acción encuentra la fila de `audit_log` con `tabla = reminders`.

### Tab «OUVs asignadas»

**REQ-08 (Estado).** Mientras el rol sea `EjecutivoComercial`, el listado debe incluir solo OUVs con `comercial_id` igual a su usuario. El filtro se aplica en el servidor.

Aceptación: el JSON no contiene OUVs de otro comercial.

**REQ-09 (Estado).** Mientras el rol sea `SoporteComercial`, el listado debe incluir todas las OUVs asignadas y debe aceptar `comercial_id`.

Aceptación: sin filtro vuelve todas las que pasan CASL; con `comercial_id` solo las de ese comercial.

**REQ-10 (No deseado).** Si un `EjecutivoComercial` envía `comercial_id` de otra persona, el sistema debe ignorarlo y aplicar su propio alcance.

Aceptación: la respuesta coincide con la del REQ-08.

**REQ-11 (Ubicuo).** El listado debe paginar con `page`, `limit` y `total`. La UI usa draft/applied.

Aceptación: `limit=1` devuelve una fila y `total` igual al universo del rol. Cambiar el draft no dispara el fetch hasta Aplicar.

### Tab «Recordatorios» del detalle de OUV

**REQ-12 (Evento).** Cuando el usuario abre el tab, el sistema debe listar los recordatorios de todas las interacciones de esa OUV, por `event_at` ascendente, con `status` y `completed_at`. Cancelar solo si `status = Pendiente` y no está realizado.

Aceptación: el orden es el de `event_at`. Cancelar uno `Pendiente` lo deja `Cancelado`. Cancelar uno `Enviado` o realizado responde 400 y no cambia la fila.

### Tab «Recordatorios» de la campana

**REQ-13 (Evento).** Cuando el usuario abre el tab, el sistema debe listar sus recordatorios (`user_id` = él) de lead, SQL y OUV, con etiqueta de fuente y datos para abrir la entidad.

Aceptación: no aparecen recordatorios de otro `user_id`. Una fila de cada fuente trae `source_type`, `source_id` y `source_label`. `counts` cuenta el universo del usuario, no la página.

**REQ-14 (Ubicuo).** El sistema debe distinguir vencidos, de hoy y próximos usando `event_at` y el día calendario de America/Bogota. No usa `remind_at`. Los realizados, cancelados, eliminados y los de una interacción eliminada no entran. El semáforo (REQ-24 a REQ-27) también usa solo `event_at`.

Aceptación: tres filas con `event_at` ayer, hoy y mañana en Bogotá caen en `OVERDUE`, `TODAY` y `UPCOMING` aunque su `remind_at` caiga en otro grupo. Una con `completed_at` no vuelve en ninguno de los tres grupos.

### Outlook

**REQ-15 (Estado).** Mientras `OUTLOOK_SYNC_ENABLED=false`, el sistema debe guardar `outlook_sync_status = NOT_REQUIRED`.

Aceptación: el alta de un recordatorio de OUV con el flag en falso persiste `NOT_REQUIRED` y el job no llama a Graph.

**REQ-16 (Evento).** Cuando se crea un recordatorio con el flag activo, el sistema debe marcarlo `PENDING`. Un job programado con `setInterval` debe crear el evento en el calendario del responsable (inicio = `event_at`, `isReminderOn = true`, `reminderMinutesBeforeStart = min(remind_days_before × 1440, 40320)`), guardar `outlook_event_id` y marcarlo `SYNCED`. El tope es el máximo que acepta Graph (28 días). `remind_days_before` y `remind_at` del CRM no cambian: la notificación de `dispatchDue` sigue la fecha real. El job reclama filas con `FOR UPDATE SKIP LOCKED` y no crea un segundo evento si `outlook_event_id` ya existe.

Aceptación: con el cliente Graph mockeado, una fila `PENDING` termina `SYNCED` con id. Una segunda pasada no hace otro `POST`. Con `remind_days_before = 30` el evento sale con `reminderMinutesBeforeStart = 40320`.

**REQ-17 (Evento).** Cuando un recordatorio `SYNCED` se cancela, el sistema debe pasar `outlook_sync_status` a `PENDING` para que el job elimine el evento en Outlook. Outlook solo crea y elimina eventos. No hay edición del recordatorio ni `PATCH` del evento.

Aceptación: cancelar un `SYNCED` deja `status = Cancelado` y `outlook_sync_status = PENDING`, sin llamar a Graph en esta petición. El `outlook_event_id` se conserva para el `DELETE` del paso 10. No existe endpoint de edición.

**REQ-18 (No deseado).** Si Graph falla, o el responsable no está habilitado (403: fuera de `grupoverytel.com` o del grupo autorizado), el sistema debe marcar `FAILED`, guardar `outlook_last_error` e incrementar `outlook_sync_attempts` hasta `OUTLOOK_SYNC_MAX_ATTEMPTS`. Un 403 no se reintenta. El recordatorio no se revierte.

Aceptación: la fila de `reminders` sigue existiendo con su `event_at`. El 403 queda `FAILED` con intentos congelados. Un fallo transitorio reintenta hasta el máximo.

### Tiempo de respuesta

**REQ-19 (Ubicuo).** Los listados de REQ-08, REQ-09, REQ-12 y REQ-13, incluido el semáforo, deben responder en menos de 2 s con el volumen de pre-producción.

Aceptación: medición en el paso 11. El `EXPLAIN` de la subconsulta del semáforo usa `idx_reminders_ouv_followup`.

### Realizado y semáforo

**REQ-20 (Evento).** Cuando el responsable (`user_id` = actor) marca realizado un recordatorio no realizado, el sistema debe guardar `completed_at = ahora` sin modificar `status` ni el evento de Outlook, y la auditoría de REQ-07 debe registrarlo. Si el actor no es el responsable, responde 403 `{ code: "FORBIDDEN" }`.

Aceptación: `status` queda igual, `outlook_event_id` queda igual, `completed_at` no es nulo, hay fila en `audit_log`.

**REQ-21 (No deseado).** Si el recordatorio está `Cancelado`, eliminado o ya realizado, el sistema debe rechazar «Marcar como realizado» con 409 `{ code: "CONFLICT", message }`.

Aceptación: los tres casos responden 409 y no mueven `completed_at` ni `status`.

**REQ-22 (No deseado).** Si `completed_at` no es nulo, `dispatchDue` no debe crear la notificación ni pasar el recordatorio a `Enviado`.

Aceptación: un `Pendiente` con `completed_at` y `remind_at` vencido sigue `Pendiente` después del despacho. Un `Pendiente` de lead con `completed_at` nulo sí pasa a `Enviado`.

**REQ-23 (Ubicuo).** Cada ítem de «OUVs asignadas» debe traer `next_reminder_at` y `follow_up_status` calculados en el servidor con la regla de §3.4.

Aceptación: el JSON trae ambos campos. El cliente no deriva el color de la fecha.

**REQ-24 (Estado).** Mientras la fecha evaluada sea anterior a ahora, `follow_up_status` debe ser `RED`.

**REQ-25 (Estado).** Mientras la fecha evaluada esté entre ahora (inclusive) y el fin del día Bogotá de (hoy + `FOLLOW_UP_YELLOW_DAYS`) (inclusive), `follow_up_status` debe ser `YELLOW`.

**REQ-26 (Estado).** Mientras la fecha evaluada sea posterior a ese fin de día, `follow_up_status` debe ser `GREEN`.

**REQ-27 (Estado).** Mientras la OUV no tenga recordatorios no realizados, `follow_up_status` debe ser `NONE`. La UI muestra un círculo gris y el texto «Sin seguimiento».

Aceptación de REQ-24 a REQ-27: tests de `resolveFollowUpStatus` más un listado con una OUV de cada caso (vencido, hoy, a N días en el límite, a N+1, realizado, cancelado, sin recordatorios). Realizado y cancelado no cuentan como fecha evaluada.

**REQ-28 (Ubicuo).** El listado debe poder filtrar por `follow_up_status` y ordenar en SQL. El orden por defecto es RED, YELLOW, GREEN, NONE y, dentro de cada uno, `next_reminder_at` ascendente.

Aceptación: con `limit` menor que el total, la primera página son los RED. Un filtro `GREEN` no devuelve otros colores. El orden no se aplica en memoria.

**REQ-29 (Ubicuo).** El cálculo del semáforo debe resolverse con una sola consulta agrupada por OUV.

Aceptación: el servicio no ejecuta un query de recordatorios por cada fila del listado. El `EXPLAIN` se adjunta en el resumen del paso 4.

## 8. Preguntas abiertas

Ninguna. Las ocho del Paso 0 quedaron cerradas en la aprobación y en el registro de decisión.
