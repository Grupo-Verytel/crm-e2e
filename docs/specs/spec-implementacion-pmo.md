# Spec — Módulo 7 (Implementación): integración con el PMO (Control Project)

**Versión:** 1.0
**Fecha:** 2026-08-29
**Estado:** Implementado en la rama `ET-Feature-CRM-PMO` (ambos repos)
**Módulo:** `implementation` (backend y frontend)
**Depende de:** `docs/specs/decisions/2026-08-DR-integracion-pmo-control-project.md`, `spec-workflow-engine.md`, `spec-ouv-funnel.md`
**Sistema externo:** PMO Control Project — repo `controlproject`, API Node.js en `/api`

---

## 1. Propósito

Cubrir el tramo del proceso comercial que ocurre después de ganar una OUV: el proyecto de
implementación se ejecuta en el PMO, y el CRM necesita abrirlo, ver su avance y enterarse de sus
cambios de estado.

La llave de correlación entre ambos sistemas es el `ouv_id`, guardado en el PMO como
`pro_project.OUV_ID`.

**Fuera de alcance:** el cálculo de los indicadores (es del PMO), el state machine de 8 etapas del
proyecto (es del PMO), y los hitos RFS/RFB y el consecutivo SER del Módulo 7 comercial, que no
forman parte de esta integración.

---

## 2. Actividades cubiertas

| # | Dirección | Mecanismo | Endpoint |
|---|-----------|-----------|----------|
| 1 | CRM → PMO | Alta del proyecto | `POST /api/projects` (PMO) |
| 2 | CRM → PMO | Avance de ejecución | `GET /api/projects/execution?ouvId=…` (PMO) |
| 3 | CRM → PMO | Historial de estados | `GET /api/projects/state-history?ouvId=…` (PMO) |
| 3 | PMO → CRM | Notificación de cambio de estado | `POST /api/v1/integrations/execution/status-changes` (CRM) |

Endpoints que el CRM expone a su propio frontend:

| Método | Ruta | Autorización |
|--------|------|--------------|
| POST | `/api/v1/implementation/projects/:ouvId` | JWT + CASL `create Service` |
| GET | `/api/v1/implementation/projects/:ouvId/execution` | JWT + CASL `read Service` |
| GET | `/api/v1/implementation/projects/:ouvId/state-history` | JWT + CASL `read Service` |
| POST | `/api/v1/integrations/execution/status-changes` | `x-api-key` (`PmoApiKeyGuard`), sin JWT |

---

## 3. Modelo de datos

### 3.1 `project_status_events` (nueva, en el CRM)

Bitácora de sola ingesta de lo que el PMO empuja. No guarda indicadores: esos nunca se copian.

| Campo | Tipo | Null | Uso |
|---|---|---|---|
| `project_status_event_id` | CHAR(36) | NO (PK) | UUID |
| `ouv_id` | CHAR(36) | NO (FK `ouvs`) | `referenceId` del payload |
| `external_event_id` | CHAR(36) | NO (UNIQUE) | Llave de idempotencia emitida por el PMO |
| `new_status` | VARCHAR(120) | NO | `STA_CNAME` del PMO, literal |
| `occurred_at` | DATETIME | NO | Fecha del cambio en el PMO |
| `comment` | VARCHAR(400) | SÍ | Opcional, hoy el `PRO_CNAME` del proyecto |
| `received_at` | DATETIME | NO | Cuándo lo recibió el CRM |
| `created_at` / `updated_at` / `deleted_at` | DATETIME | — | Soft-delete estándar (`paranoid`) |

Índices: `uq_project_status_events_external_event` (único) e
`idx_project_status_events_ouv_occurred`.

### 3.2 Columnas del lado del PMO (repo `controlproject`)

Aplicadas por `agregar_integracion_crm_pmo.sql`: `pro_project.OUV_ID` (único),
`pro_project.PRO_CPROJECT_TYPE`, `pro_project_state_history.notified_at` (+ índice) y el `DEFAULT`
de columna de `COM_NCODE`, `STF_NCODE_SUPERVISOR`, `STF_NCODE_INCHARGE` y `STA_NCODE`.

---

## 4. Criterios de aceptación (EARS)

### Alta del proyecto (Actividad 1)

- **EARS-PMO-01** — CUANDO un usuario solicita abrir el proyecto de una OUV cuyo `resultado` es
  `Ganada`, el sistema DEBE enviar al PMO el nombre, las fechas de asignación/inicio/fin, el
  `ouv_id` y el monto final de la OUV, y DEBE devolver el `PRO_NCODE` asignado por el PMO.
- **EARS-PMO-02** — SI la OUV no está en `resultado = Ganada`, ENTONCES el sistema DEBE rechazar la
  solicitud con `400 OUV_NOT_WON` y NO DEBE llamar al PMO.
- **EARS-PMO-03** — SI la fecha de fin es anterior a la de inicio, ENTONCES el sistema DEBE rechazar
  la solicitud con `400 INVALID_PROJECT_DATES` y NO DEBE llamar al PMO.
- **EARS-PMO-04** — SI el `ouvId` no corresponde a ninguna OUV, ENTONCES el sistema DEBE responder
  `404 OUV_NOT_FOUND` y NO DEBE llamar al PMO.
- **EARS-PMO-05** — SI el PMO ya tiene un proyecto para ese `OUV_ID`, ENTONCES el sistema DEBE
  responder `409 PMO_PROJECT_ALREADY_EXISTS` y NO se DEBE crear un segundo proyecto.
- **EARS-PMO-06** — Los campos opcionales que el usuario no diligencia NO DEBEN incluirse en el
  payload al PMO, para que apliquen los `DEFAULT` de columna del PMO (compañía, supervisor,
  responsable y estado inicial del proyecto).

### Consulta de avance (Actividad 2)

- **EARS-PMO-07** — CUANDO se consulta la ejecución de una OUV existente, el sistema DEBE devolver
  los cuatro indicadores (`billing`, `costs`, `schedule`, `scope`) tal como los entrega el PMO, sin
  recalcularlos ni almacenarlos.
- **EARS-PMO-08** — SI el proyecto existe pero el PMO aún no tiene datos cargados, ENTONCES el
  bloque correspondiente DEBE llegar con `available: false`, y la interfaz DEBE basarse en ese flag
  y no en el valor de `percentage`, que en ese caso viene en `0`.
- **EARS-PMO-09** — SI el PMO no tiene proyecto para ese `ouv_id`, ENTONCES el sistema DEBE
  responder `404 PMO_PROJECT_NOT_FOUND`; la interfaz DEBE interpretarlo como "proyecto aún no
  abierto" y ofrecer el alta, no como un error.
- **EARS-PMO-10** — SI el PMO está inalcanzable o mal configurado, ENTONCES el sistema DEBE
  responder `503` (`PMO_UNREACHABLE` / `PMO_NOT_CONFIGURED`) y NO DEBE degradar en datos vacíos que
  parezcan reales.

### Historial de estados (Actividad 3, pull)

- **EARS-PMO-11** — CUANDO se consulta el historial de una OUV existente, el sistema DEBE devolver
  todas las transiciones en orden cronológico ascendente, con `previousState` en `null` en la
  primera.

### Notificación de cambio de estado (Actividad 3, push)

- **EARS-PMO-12** — CUANDO el PMO notifica un cambio de estado, el sistema DEBE registrarlo en
  `project_status_events` y notificar al comercial de la OUV, en una sola transacción, y DEBE
  responder `202`.
- **EARS-PMO-13** — SI el `externalEventId` ya fue ingerido, ENTONCES el sistema DEBE responder
  `200` sin registrar de nuevo ni volver a notificar.
- **EARS-PMO-14** — El sistema NO DEBE validar el valor de `newStatus` ni la legalidad de la
  transición: el state machine es del PMO. El estado se DEBE guardar literal y sólo se DEBE truncar
  a 40 caracteres al escribirlo en `notifications.estado_nuevo`.
- **EARS-PMO-15** — SI el `referenceId` no corresponde a ninguna OUV, ENTONCES el sistema DEBE
  responder `404` y NO DEBE registrar el evento.
- **EARS-PMO-16** — SI la petición no trae una `x-api-key` válida, ENTONCES el sistema DEBE
  responder `401` sin tocar la base de datos.
- **EARS-PMO-17** — El `externalEventId` DEBE aceptarse en cualquier versión de UUID: el PMO lo
  deriva de forma determinista desde su `PSH_NCODE` (UUID v5) para que un reintento repita el mismo
  id.

---

## 5. Interfaz

`/services` lista las OUV ganadas. `/services/:ouvId` muestra la tarjeta del proyecto:

- Los cuatro indicadores en tarjetas. El signo de la desviación se interpreta por bloque: en Costos
  una desviación positiva es sobrecosto (tono `danger`), en los demás es adelanto.
- Un bloque con `available: false` DEBE mostrar "Sin dato", nunca un `0%` que parezca real.
- La línea de tiempo de estados.
- Si el PMO responde `PMO_PROJECT_NOT_FOUND` y la OUV está ganada, se ofrece "Crear proyecto en el
  PMO".

La ejecución y el historial se piden en paralelo y fallan de forma independiente: que el historial
no cargue no debe ocultar los indicadores.

Referencia visual: rama `origin/Design_JD` (`IndicadoresDashboard`, `ProjectDashboard`), que es una
maqueta sobre `mock-store`. Acá se conservó su estructura y se cableó contra los endpoints reales.

---

## 6. Configuración

| Variable | Uso |
|----------|-----|
| `PMO_API_BASE_URL` | Base de la API del PMO |
| `PMO_API_KEY` | Clave que el CRM envía al PMO (saliente) |
| `PMO_INBOUND_API_KEY` | Clave que el PMO debe enviar al webhook (entrante) |

Del lado del PMO: `INTEGRATION_API_KEYS` (hashes bcrypt), `CRM_WEBHOOK_URL`,
`CRM_WEBHOOK_API_KEY` y `CRM_NOTIFICATION_POLL_INTERVAL`. Contrato completo del PMO:
`controlproject/api/docs/integracion-crm.md`.
