# DR — Integración CRM ↔ PMO (Control Project)

**Fecha:** 2026-08-29
**Estado:** Aprobado
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Origen:** Especificaciones técnicas de las Actividades 1, 2 y 3 de la integración con el PMO
**Repos involucrados:** `crm-e2e` (este) y `controlproject` (PMO), ambos en la rama `ET-Feature-CRM-PMO`
**Relacionado:** `docs/specs/spec-implementacion-pmo.md`, `2026-08-DR-convencion-nombres-ingles.md`

## Contexto

El proyecto de implementación de una OUV ganada se ejecuta en el PMO (Control Project: Laravel +
una API Node.js de indicadores), no en el CRM. Se necesitan tres cosas: abrirlo desde el CRM, leer
su avance, y enterarse cuando cambia de estado.

La llave de correlación es el `ouv_id`, que el PMO guarda en la columna `pro_project.OUV_ID`
(`VARCHAR(36)`, único). No hay consecutivo `SER-####` de por medio: se evaluó y se descartó con el
equipo del PMO por no aportar nada sobre el id que ambos sistemas ya comparten.

## Decisiones

### 1. Módulo dueño: `implementation`

Todo el código de integración vive en `backend/src/modules/implementation`. El servicio público es
`ProjectExecutionService`; las lecturas de OUV pasan por `OuvsService` y las notificaciones por
`WorkflowEngineService`, sin imports profundos entre módulos (Artículo IV).

### 2. Los indicadores no se copian al CRM

Las dos consultas (`execution` y `state-history`) son *read-through* al PMO: no se cachean ni se
persisten en el CRM. Así los números de la tarjeta no pueden divergir de los del PMO, que es el
sistema dueño del cálculo.

**Descartado:** replicar los indicadores en una tabla del CRM con un job de sincronización — agrega
una fuente de verdad y un modo de falla (datos viejos que parecen frescos) a cambio de latencia.

### 3. El alta del proyecto es una acción explícita, no un efecto de `ganar()`

`POST /api/v1/implementation/projects/:ouvId` la dispara el comercial. **No** se cuelga de
`OuvsService.ganar()`: esa operación corre dentro de una transacción de base de datos, y meterle una
llamada HTTP saliente haría que una caída del PMO bloqueara el cierre de una oportunidad ganada.

El servicio exige que la OUV esté en `resultado = Ganada` antes de llamar al PMO.

### 4. Idempotencia en las dos direcciones

- **CRM → PMO:** el PMO tiene índice único sobre `OUV_ID`; un reenvío responde `409`, que el cliente
  traduce a `ConflictException`. No se crea un segundo proyecto.
- **PMO → CRM:** el PMO manda `externalEventId` **determinista** (UUID v5 derivado de su
  `PSH_NCODE`), no aleatorio. El CRM lo guarda con índice único en
  `project_status_events.external_event_id` y responde `200` en vez de `202` cuando reconoce un
  reintento. El mismo id es el discriminador de deduplicación de la notificación, así que un
  reintento nunca produce una segunda campana, mientras que una segunda transición real sí.

> **Consecuencia no obvia:** `externalEventId` es UUID **v5**, no v4. El DTO debe validarlo con
> `@IsUUID()` sin fijar versión; fijar `'4'` rechaza con `400` todo push real del PMO. Cubierto por
> `status-change.dto.spec.ts` con un payload real del job del PMO.

### 5. El webhook es de sola ingesta

El CRM no valida ni el valor del estado ni la transición: el state machine de 8 etapas es del PMO.
`newStatus` se guarda literal en `project_status_events.new_status`; sólo se trunca a 40 caracteres
al escribirlo en `notifications.estado_nuevo`, que es `VARCHAR(40)`.

### 6. Autenticación: API Key, no JWT

Los dos sentidos son tráfico máquina a máquina y usan `x-api-key`, no el JWT de usuario:

- Entrante (PMO → CRM): `PmoApiKeyGuard` sobre la ruta `@Public()`, comparación de tiempo constante.
- Saliente (CRM → PMO): `PMO_API_KEY` en el header; del lado del PMO se guarda sólo su **hash
  bcrypt** en `INTEGRATION_API_KEYS`, en formato `nombre:hash` y separados por comas para poder rotar
  sin cortar el servicio.

**Descartado:** guardar la clave en texto plano del lado del PMO (era el estado inicial de la rama).
Se migró a bcrypt conforme a la especificación de la Actividad 1.

### 7. Vocabulario

Nombres de tabla y columna nuevos en inglés (`project_status_events`), conforme a
`2026-08-DR-convencion-nombres-ingles.md`. Los **valores** siguen en español porque son el dato real
del PMO (`STA_CNAME`: "Recepción", "1A", "Cierre"), no claves del contrato.

Del lado del PMO se respetan sus propias convenciones (`PRO_CNAME`, `OUV_ID`): el mapeo entre ambos
vocabularios ocurre en un único lugar, `ProjectExecutionService.toPmoPayload`.

## Alternativas descartadas

- **Disparo automático del alta al marcar la OUV como ganada** — acopla el cierre comercial a la
  disponibilidad del PMO (ver decisión 3).
- **Cola de mensajes para el push** — ni el CRM ni el PMO tienen infraestructura de colas; el PMO
  resuelve el reintento con `notified_at IS NULL` + `node-cron`, que es suficiente para el volumen.
- **Mapear los estados del PMO a un vocabulario del CRM** — el equipo del PMO confirmó que el estado
  viaja como texto libre y el CRM no lo valida (ver decisión 5).
