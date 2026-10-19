# RESUMEN-PASO-0 — Inventario (solo lectura)

Fecha: 2026-10-17. Rama destino: `crm-e2e`. Referencia visual: carpeta real `crm-e2e-DesignJD` (el prompt la nombra `crm-e2e-desing`). No se modificó esa carpeta ni ningún archivo de código.

Cuando el prompt contradice el repo, gana el repo (R3). Esos choques están marcados **REPO**.

---

## A. Recordatorios actuales

### A1. Modelo, servicio, controller, DTOs, endpoints

No hay módulo ni subject CASL `Reminder`. Los recordatorios viven en demand-generation y se autorizan con el subject de la entidad padre.

| Pieza | Ubicación |
|---|---|
| Modelo | `backend/src/modules/demand-generation/models/reminder.model.ts:18-81` — tabla `reminders`, `paranoid: true`, PK `reminder_id` |
| Enum | `backend/src/modules/demand-generation/models/enums/reminder-status.enum.ts:1-5` — `Pendiente`, `Enviado`, `Cancelado` |
| Servicio | `backend/src/modules/demand-generation/services/reminders.service.ts:31-148` — `createForInteraction`, `dispatchDue` |
| DTO entrada | `backend/src/modules/demand-generation/dtos/create-reminder.dto.ts:12-26` |
| DTO salida | `backend/src/modules/demand-generation/dtos/reminder-response.dto.ts:1-9` |
| Fachada | `backend/src/modules/demand-generation/services/demand-generation.service.ts:231-242` |
| SQL | `backend/src/modules/qualification/services/sqls.service.ts:158-172` |

Guards globales: `JwtAuthGuard` y `CaslGuard` (`backend/src/modules/auth/auth.module.ts:51-58`). Prefijo `api/v1` (`backend/src/main.ts:91`). Si un handler no tiene `@CheckAbility`, el `CaslGuard` deja pasar (`backend/src/modules/auth/guards/casl.guard.ts:25-27`).

| Método | Ruta | Guard / CASL | Qué hace |
|---|---|---|---|
| `POST` | `/api/v1/leads/:id/interactions/:interactionId/reminders` | `read` / `Lead` | `leads.controller.ts:222-235` |
| `POST` | `/api/v1/qualification/sqls/:id/interactions/:interactionId/reminders` | `read` / `Opportunity` | `sqls.controller.ts:85-100` |

**NO ENCONTRADO:** controller propio de reminders; endpoints de listar, editar, cancelar o marcar realizado; subject CASL `Reminder`.

`status = 'Cancelado'` solo se usa como filtro al listar interacciones (`interactions.service.ts:130`). Nada lo escribe.

El responsable es el usuario autenticado (`reminders.service.ts:78-79`). No hay campo de responsable en el DTO.

Errores del servicio: `{ code, message }` con `DEMAND_GENERATION_ERROR_CODES` (`reminders.service.ts:64-75`).

### A2. Cálculo de `remind_at`

`remindAtFromEvent` resta `remind_days_before × 24 h` al instante de `event_at` (`reminders.service.ts:19-28`, uso en `:83`). El comentario del código dice que America/Bogota no tiene horario de verano, así que N días calendario = N × 24 h. El DTO acepta `remind_days_before` entero 0–365 (`create-reminder.dto.ts:16-20`). **NO ENCONTRADO:** rechazo de `event_at` en el pasado. Solo se rechaza una fecha inválida (`reminders.service.ts:70-76`).

### A3. Paso a `Enviado` y punto para excluir `completed_at`

No hay cron ni `@nestjs/schedule`. `RemindersService` arranca un `setInterval` de 60 s (`reminders.service.ts:43-47`). `dispatchDue` (`:91-129`) selecciona:

```
status = 'Pendiente' AND remind_at <= now
```

(`:97-101`), crea una fila en `notifications` (`eventType: 'interaction.reminder'`, `:112-128`) y hace `reminder.update({ status: 'Enviado' })` (`:129`).

Ese `where` (`reminders.service.ts:97-101`) es el punto exacto para omitir `completed_at IS NOT NULL` (REQ-23). Hoy la columna no existe.

Cómo llega al usuario: la fila queda en `notifications` y el cliente la pide con `GET /api/v1/notifications` (`notifications.controller.ts:21-32`, sin `@CheckAbility`; el servicio filtra por el usuario autenticado). La campana llama `refresh()` al abrirse (`NotificationBell.tsx:54-57`). El WebSocket `namespace /notifications` (`notifications.gateway.ts:25-28`) solo lo empuja el motor de workflow (`emitToUser` en `:79-82`). **`RemindersService` no llama a ese push.** El aviso del recordatorio aparece en el siguiente `GET`, no en el instante del intervalo.

### A4. Zona horaria de `event_at` / `remind_at`

Sequelize escribe y lee con `timezone: '+00:00'` (`backend/src/config/database.config.ts:19` y `backend/database/config.js:11`). En MySQL las columnas son `datetime` sin zona (`SHOW CREATE TABLE reminders`). El cliente de leads manda `new Date(datetime-local).toISOString()` (`InteractionReminderModal.tsx:31-33`), o sea un instante UTC. La comparación por día calendario en America/Bogota tiene que convertir ese instante UTC; no está guardado como hora de pared de Bogotá.

### A5. Migraciones y MySQL

Mecanismo: **sequelize-cli**. `.sequelizerc` apunta a `backend/database/config.js`, `database/migrations` y `database/seeders`. Scripts `migration:run|undo|status` en `backend/package.json:24-26`. `synchronize: false` (`database.config.ts:17`). **NO ENCONTRADO:** umzug propio ni `sync({ force })` como camino de esquema.

MySQL local: **8.0.45** (≥ 8.0.16, el `CHECK` aplica). `SHOW CREATE TABLE` (2026-10-17):

- `ouv_interactions.ouv_interaction_id`: `char(36) NOT NULL`, PK, `utf8mb4` / `utf8mb4_0900_ai_ci`, InnoDB.
- `reminders.interaction_id`: `char(36) NULL`, misma charset y collation, FK a `interactions(interaction_id)` ON DELETE RESTRICT.
- **REPO:** no existe `ouv_interactions.id`. La PK es `ouv_interaction_id`. La FK nueva debe apuntar a `ouv_interactions(ouv_interaction_id)`.

Conteo local: `reminders` tiene **1 fila**, no está vacía (el prompt decía vacía). `interaction_id IS NULL` = **0**, así que la precondición (a) del prompt se cumple hoy en este ambiente. Hay que revalidarla en el ambiente destino al migrar.

### A6. Schedule y Microsoft Graph

`@nestjs/schedule`: **NO ENCONTRADO** en `backend/package.json` de `crm-e2e` ni en el de `crm-e2e-DesignJD`.

Graph ya existe, app-only, `fetch` nativo, token cacheado (`graph-client.service.ts:31-36` y `:165-190`). Variables reales (nombres, sin valores):

- `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` (`graph-client.service.ts:24-28`)
- `GRAPH_ORG_DOMAINS`, `GRAPH_ORGANIZER_UPN`, `GRAPH_TIMEZONE` (`graph-integration/README.md:42-48`)

Constantes: `GRAPH_SCOPE = https://graph.microsoft.com/.default`, dominios `frisson.net.co` y `grupoverytel.com`, timezone default `America/Bogota` (`graph.constants.ts:9-18`). El README ya documenta el permiso de aplicación `Calendars.ReadWrite` (`README.md:51-58`). El cliente crea eventos de reunión (Kickoff / citas), no recordatorios personales.

**NO ENCONTRADO:** `OUTLOOK_SYNC_ENABLED`, `OUTLOOK_SYNC_MAX_ATTEMPTS`, `MS_GRAPH_TENANT_ID`, `MS_GRAPH_CLIENT_ID`, `MS_GRAPH_CLIENT_SECRET`.

El correo del responsable está en `users.email` (`user.model.ts:27`).

Auditoría: `AuditHooksService` engancha `afterCreate` / `afterUpdate` / `afterDestroy` en todo modelo salvo `audit_log` y `notifications` (`audit-hooks.service.ts:29-46`). Un `Reminder.create` o un `update` de `status` ya deja fila en `audit_log`. No hay llamadas manuales de auditoría en `RemindersService`.

---

## B. Interacciones

### B1. `interactions` (lead / SQL)

Modelo `interaction.model.ts:26-116`. Columnas: `interaction_id` PK `char(36)`, `lead_id` NOT NULL, `sql_id` NULL, `tipo`, `subtipo`, `canal`, `descripcion`, `resultado`, `campana_id`, `responsable_id`, `fecha`, `puntos_scoring`, timestamps, `deleted_at`. `hasMany` reminders (`:53-54`).

Endpoints (además del reminder de A1):

| Método | Ruta | CASL |
|---|---|---|
| `POST` | `/api/v1/leads/:id/interactions` | `update` / `Lead` — `leads.controller.ts:199-210` |
| `GET` | `/api/v1/leads/:id/interactions` | `read` / `Lead` — `:213-219` |
| `POST` | `/api/v1/qualification/sqls/:id/interactions` | `update` / `Opportunity` — `sqls.controller.ts:70-82` |

UI: `InteractionTimeline.tsx` pinta los recordatorios ya creados (`:139-147`) y un botón «Recordatorio» que abre `InteractionReminderModal` (`:148-182`). El modal pide `event_at`, `remind_days_before` y `note` (`InteractionReminderModal.tsx:15-33`).

**Dos requests, no una transacción.** Primero se crea la interacción; el recordatorio es un `POST` posterior (`leads-api.ts:72-94` y `sql-interactions-api.ts`). `InteractionsService.create` (lead) está documentado como no transaccional (`interactions.service.ts:34-64`). `createForSql` sí usa transacción, pero solo para la interacción y `fecha_ultima_interaccion` (`:67-82`), no para el recordatorio. **REPO vs REQ-04:** el flujo de leads no crea interacción + recordatorio en la misma transacción. El de OUV tendrá que ser un patrón nuevo, sin cambiar el de leads (R5).

### B2. `ouv_interactions`

**REPO:** PK `ouv_interaction_id`, no `id`.

`SHOW CREATE TABLE ouv_interactions`: `ouv_interaction_id char(36) NOT NULL`, charset `utf8mb4`, collation `utf8mb4_0900_ai_ci`. FK `ouv_id` → `ouvs(ouv_id)` ON DELETE CASCADE. Columnas: `titulo` varchar(200), `observaciones` text, `etiquetas` json, `registrado_por_id`, `registrado_por_nombre`, `fecha_registrada` datetime(3), timestamps, `deleted_at`. Modelo: `ouv-interaction.model.ts:27-106`. **NO ENCONTRADO:** `hasMany` hacia `Reminder`.

Controller `discovery/ouvs/:ouvId/interacciones` (`ouv-interacciones.controller.ts:25-99`):

| Método | Ruta | CASL |
|---|---|---|
| `GET` | `/api/v1/discovery/ouvs/:ouvId/interacciones` | `read` / `Opportunity` |
| `POST` | `…/interacciones` | `update` / `Opportunity` |
| `POST` | `…/interacciones/:ouvInteractionId/hilos` | `update` / `Opportunity` |
| `DELETE` | interacción o hilo | `update` / `Opportunity` |

`OuvInteraccionesService.crear` ya abre una transacción (`ouv-interacciones.service.ts:85-112`). El DTO actual es título + observaciones. No hay recordatorio.

UI en `crm-e2e`: `InteraccionesPreventaPanel.tsx` llama `crearOuvInteraccion` (`frontend/src/modules/discovery/api/ouv-interacciones-api.ts:48-56`). El tab del detalle es `detalle | preventa | interacciones` (`OuvDetailNav.tsx:1`). **NO ENCONTRADO** en `crm-e2e`: opción de recordatorio en ese formulario.

---

## C. OUVs y roles

### C1. Comercial asignado y estados

`ouvs.comercial_id` `char(36)` NOT NULL → `comercialId` (`ouv.model.ts:74-80`). Estados:

- Zona (`zona_actual`): `UNIVERSO`, `ENCIMA_FUNNEL`, `EN_FUNNEL`, `MAYOR_PROBABILIDAD` (`ouv.enums.ts:2-7`).
- Resultado: `EnCurso`, `Ganada`, `Perdida`, `Descartada` (`ouv.enums.ts:9-14`).

### C2. Listados y filtro por usuario

`GET /api/v1/discovery/ouvs` — `read` / `Opportunity` (`ouvs.controller.ts:67-84`).

Alcance (`ouv-access.ts:19-23` + `ouvs.service.ts:823-827`):

- `EjecutivoComercial` (único rol en `OWN_PIPELINE_ROLES`): `where.comercialId = actor`. Si manda `all` o `comercial_id` de otro, el controller no pone `all` (`ouvs.controller.ts:73-76`).
- Cualquier otro rol que ya pasó CASL `read Opportunity` y manda `all=true` ve todas. Con `all=true` y `comercial_id`, filtra por ese comercial (`ouvs.service.ts:825-826`).
- `GET /api/v1/discovery/ouvs/ejecutivos-comerciales` lista activos con rol `EjecutivoComercial` (`ouvs.controller.ts:86-91`).

El dashboard de calificación aplica la misma idea: solo `EjecutivoComercial` queda acotado a `comercial_id` (`qualification-dashboard.service.ts:45-52`). Eso es agregados, no una bandeja de OUVs asignadas.

**NO ENCONTRADO:** listado de calificación con `follow_up_status` o `next_reminder_at`.

### C3. Roles y CASL

Nombres en código y seed (`database/seeders/lib/role-permissions.js:64-99` y `:143-154`):

| Rol | Código | Opportunity |
|---|---|---|
| Ejecutivo Comercial | `EjecutivoComercial` | `CRUX` |
| Soporte Comercial | `SoporteComercial` | `CRU` |

**NO ENCONTRADO:** subject `Reminder`; tabla `user_roles`. El usuario tiene un solo `users.role_id` (`user.model.ts:39-44`) y el JWT carga un solo `roleName` (`jwt-auth.guard.ts:72`). REQ-12 (varios roles, gana el más amplio) no tiene modelo donde apoyarse.

### C4. Módulo Calificación en `crm-e2e`

Rutas (`frontend/src/routing/AppRoutes.tsx:250-274`):

- `/qualification` — Enrutamiento
- `/qualification/assigned` — SQL asignados / Mis SQL
- `/qualification/dashboard`
- `/qualification/sqls/:id`

Tabs en `QualificationNav.tsx:13-40`: Enrutamiento (solo `SoporteComercial`), SQL asignados o Mis SQL, Dashboard. **NO ENCONTRADO:** tab «OUVs asignadas» ni ruta `/qualification/assigned-ouvs`.

---

## D. Notificaciones

Campana: `frontend/src/modules/auth/components/NotificationBell.tsx:21-108`. Un solo bloque «Notificaciones». Sin tabs.

Datos: `GET /api/v1/notifications` y `PATCH /api/v1/notifications/:id/read` (`notifications-api.ts:27-44`). WebSocket: `io(\`${VITE_WS_BASE_URL ?? 'http://localhost:3000'}/notifications\`)` (`NotificationsProvider.tsx:21-22` y `:111`). `VITE_WS_BASE_URL` está en `frontend/.env.example:5-7`. El evento de socket refresca la lista de notificaciones; no hay canal de recordatorios.

---

## E. Rama de diseño `crm-e2e-DesignJD`

Todo lo de recordatorios de esa rama persiste en `localStorage` (`store.ts:7`, clave `crm-ouv-recordatorios-v1`). No llama al API de `reminders`. **No copiar** `store.ts`, `RemindersProvider.tsx`, `sync-ouv-reminders.ts`, `ouv-seguimiento.ts` ni `sql-seguimiento.ts`.

### E1. Componentes

| Pantalla | Archivo de diseño | Props | Qué hay que separar |
|---|---|---|---|
| Tab «OUV asignadas» | `frontend/src/modules/qualification/pages/SupportAssignedOuvsPage.tsx` | ninguno (página) | `fetchOuvs`, `fetchCommercials`, orden en memoria (`:52-74`, `:188-190`), semáforo cliente |
| Filtro comercial | `…/components/AssignedCommercialFiltersPanel.tsx:12-17` | `panelId`, `commercials`, `applied`, `onApply` | El panel es presentacional. La página que lo usa hace fetch |
| Nav | `…/components/QualificationNav.tsx:35-58` | ninguno | Cambia tabs ya existentes («Me llegaron», `/qualification/assigned-sqls`) y usa `hasPermission`. No reemplazar el nav de `crm-e2e` entero |
| Ruta | `frontend/src/routing/AppRoutes.tsx:253` | — | `/qualification/assigned-ouvs`. Solo la ve quien `canAssign` (`QualificationNav.tsx:22-24`). El Ejecutivo de diseño **no** ve el tab |
| Tab Recordatorios en campana | `frontend/src/modules/auth/components/NotificationBell.tsx:12-238` | ninguno | `useReminders()` lee localStorage (`:38-39`). Incluye Descartar (`X`) además de realizado |
| Tab Recordatorios en detalle OUV | `OuvDetailNav.tsx:1-57` + `OuvRecordatoriosPanel.tsx:10-44` | nav: `active`, `onChange`. Panel: `{ ouv }` | El panel llama `listRemindersForOuv` y `syncOuvRemindersFromInteracciones` |
| Lista | `frontend/src/modules/shared/reminders/ReminderTrayList.tsx:30-35` | `items`, `emptyLabel` | Sigue llamando `resolveOuvReminder` del store (`:6`) y calcula vencido en el cliente (`:36-40`) |
| Formulario interacción OUV | `InteraccionesPreventaPanel.tsx:62-238` | modal interno | Checkbox «Recordarme» + fecha/hora (`:171-220`). Guarda en localStorage (`:273-278`). No pide `remind_days_before` ni `note` |
| Formulario SQL (referencia) | `SqlQuickInteractionModal.tsx` | `sqlId`, `sqlLabel`, `sqlConsecutivo`, `onRegistered`, `onClose` | Mezcla `registerSqlInteraction` (API) con `upsertOuvReminder` (localStorage) |
| Tab Recordatorios de SQL | `SqlDetailNav.tsx`, `SqlRecordatoriosPanel.tsx` | `{ sqlId }` | Misma bandeja localStorage. Fuera del alcance OUV, no portar la lógica |

Semáforo de diseño (`sql-seguimiento.ts:23-35` y `:69-73`, reutilizado por `ouv-seguimiento.ts:46-48`): punto de color, sin texto visible. Regla **distinta** de D8–D10: días de retraso sobre `remind_at` (≤7 verde, >7 naranja, >14 rojo, sin recordatorio = vacío). Se calcula en el cliente y se ordena en memoria (`SupportAssignedOuvsPage.tsx:52-57`, `:188-221`). Esa lógica no se porta.

### E2. Tokens y `ui.ts`

`ui.ts` de qualification y discovery **no** agregan constantes nuevas respecto de lo que ya usa `crm-e2e`.

Sí falta en `crm-e2e`:

- `--semaphore-amarillo` (`crm-e2e-DesignJD/frontend/src/styles/tokens.css:33`). El modo oscuro de diseño **no** lo redefine (`:57-67`).
- Clase Tailwind `semaphore-amarillo` (`crm-e2e-DesignJD/frontend/tailwind.config.js:13`).
- Animación `.bell-reminder-active` (`crm-e2e-DesignJD/frontend/src/styles/global.css:204-232`).

`crm-e2e` ya tiene `--semaphore-verde`, `--warning`, `--danger` y los pares `--estado-*-fill/fg` con variante oscura (`frontend/src/styles/tokens.css:31-45` y `:78-83`). El `tokens.css` de diseño está más corto: no se copia encima del de `crm-e2e`.

### E3. Íconos lucide-react

En estas pantallas: `Bell`, `Check`, `X`, `Filter`, `Trash2`. El paquete ya está. `crm-e2e` ya importa `Bell`, `Check`, `X`, `Filter` y `Trash2` en otras pantallas. No hay ícono nuevo que exija dependencia.

### E4. Dependencias

`frontend/package.json` y el backend de diseño: **sin dependencias nuevas** frente a `crm-e2e` para esta funcionalidad. Siguen ausentes TanStack, SWR, Zustand, Radix, shadcn, CVA, clsx, tailwind-merge y `@nestjs/schedule`.

---

## Mapa componente de diseño → destino en `crm-e2e`

| Diseño | Destino propuesto | Se elimina al portar |
|---|---|---|
| `SupportAssignedOuvsPage` (tabla y columna Seguimiento) | Página/tab nuevo en `frontend/src/modules/qualification/` | `fetchOuvs`, sort en memoria, `ouvSeguimientoTone` |
| `AssignedCommercialFiltersPanel` | `qualification/components/` | Nada de fetch; el padre pasa props |
| `QualificationNav` enlace «OUV asignadas» | Añadir un `NavLink` al nav actual | No sustituir el nav ni la ruta «Mis SQL» |
| `OuvDetailNav` botón Recordatorios | Extender el nav de `crm-e2e` | — |
| `OuvRecordatoriosPanel` + `ReminderTrayList` | Componentes presentacionales en discovery | store, localStorage, cálculo de vencido |
| Bloque «Recordarme» de `InteraccionesPreventaPanel` | Sección del modal de interacción OUV ya existente | localStorage; los campos definitivos quedan en la pregunta 1 |
| Tabs de `NotificationBell` | Extender la campana de `crm-e2e` | `useReminders`, localStorage, botón Descartar salvo que se apruebe |
| `FollowUpBadge` | No existe en diseño. Crearlo en qualification con el patrón `StatusBadge` | La regla de 7/14 días |

---

## Riesgos

1. **REPO — PK.** El DDL del prompt referencia `ouv_interactions(id)`. La columna real es `ouv_interaction_id`, `char(36) utf8mb4_0900_ai_ci`. La precondición (b) se cumple solo si `reminders.ouv_interaction_id` copia ese tipo.
2. **Tabla no vacía.** Hay 1 recordatorio local con `interaction_id` informado. El `CHECK` de fuente única no choca hoy. Hay que volver a contar en el ambiente donde se migre.
3. **REQ-04 no tiene precedente en leads.** Leads usan dos HTTP calls. Cambiar eso rompería R5. La transacción única es solo para OUV, apoyada en la que ya abre `OuvInteraccionesService.crear`.
4. **El semáforo de diseño no es D8–D10.** Portar `ouv-seguimiento.ts` calcularía otro color en el cliente. El color sale del backend.
5. **`@nestjs/schedule` no está.** El despacho actual es `setInterval`. Instalar el paquete en el Paso 10 exige aprobación (R6) o un bloqueo.
6. **Graph ya está cableado con `AZURE_*` y `GraphClientService`.** Duplicar `MS_GRAPH_*` o un segundo cliente rompe el cliente de Kickoff/citas si no se reutiliza.
7. **Un fallo de `dispatchDue` no empuja WebSocket.** Excluir `completed_at` evita el `INSERT` en `notifications` y el paso a `Enviado`; no hay un segundo emisor que actualizar.
8. **Un solo rol por usuario.** REQ-12 no se puede cumplir con `users.role_id`.
9. **`tokens.css` de diseño está atrasado** respecto de `crm-e2e` (le faltan `--estado-*` y `--mep-partial`). Copiar el archivo entero sería una regresión visual.
10. **El nav de diseño reescribe Calificación** (rutas y visibilidad del Ejecutivo). Copiarlo cambia pantallas que este trabajo no debe tocar.

---

## Preguntas abiertas

1. **Campos del recordatorio en la interacción de OUV.** El diseño pide un checkbox «Recordarme» con una sola fecha y hora. Leads piden `event_at`, `remind_days_before` y `note` en un modal posterior. REQ-06 dice los mismos campos que leads.
   - A) Checkbox dentro del modal de interacción (layout del diseño) con `event_at`, `remind_days_before` y `note`.
   - B) Checkbox con una sola fecha/hora, guardada como `event_at` y `remind_days_before = 0`.
   - C) Dejar el modal posterior de leads y solo copiar estilos.

2. **Pieza visual del semáforo.** D8–D10 fijan la regla de negocio. El diseño muestra un círculo sin texto y con umbrales de 7 y 14 días.
   - A) Badge con texto (Vencido / Próximo / Al día / Sin seguimiento) y tokens, como el Paso 6.
   - B) Círculo del diseño, con `title` que traiga la fecha, sin recalcular el color en el cliente.

3. **Botón Descartar (X) de la campana de diseño.** El prompt solo define «Marcar como realizado» y cancelar si está `Pendiente`.
   - A) Solo realizado y cancelar.
   - B) También Descartar, como en el diseño.

4. **Dónde vive el listado «OUVs asignadas».** Ya existe `GET /api/v1/discovery/ouvs` con alcance por rol y filtro `comercial_id`.
   - A) Endpoint nuevo de qualification que agrega `next_reminder_at` y `follow_up_status`.
   - B) Extender `GET /discovery/ouvs` (toca la bandeja OUV que ya está en producción).

5. **Credenciales de Graph.**
   - A) Reutilizar `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` y `GraphClientService`.
   - B) Crear `MS_GRAPH_*` aparte.

6. **Job del Paso 10.** `@nestjs/schedule` no está instalado.
   - A) Mismo `setInterval` que `RemindersService`, sin paquete nuevo.
   - B) Aprobar instalar `@nestjs/schedule`.

7. **REQ-12 y varios roles.** El usuario tiene un solo `role_id`.
   - A) Un rol por usuario; REQ-12 no aplica.
   - B) Hay que modelar varios roles (fuera del esquema actual).

8. **Fecha de evento en el pasado.** Leads hoy la aceptan. REQ-05 la rechaza en OUV y aborta la interacción.
   - A) Validarla solo en el alta de OUV.
   - B) Aplicar la misma validación a leads (cambia el comportamiento actual).
