# SPEC — Integración CRM Frisson ↔ MEP-LEAN

> **Documento de Spec-Driven Development.**
> Fuente: *Brief Integración CRM ↔ MEP-LEAN, contrato técnico v0.2.0-draft (21-ago-2026)*.
> Este documento es la **única fuente de verdad** para la implementación. El código se deriva del spec; cuando código y spec discrepan, gana el spec o se abre un cambio de spec.

| Campo | Valor |
|---|---|
| Spec ID | `SPEC-CRM-MEPLEAN-001` |
| Versión del contrato | `v0.2.0-draft` |
| Estado | `DRAFT / FOR FACTORY REVIEW` |
| Stack objetivo | NestJS 11 · Sequelize · MySQL 8 · Redis (rate limit / idempotencia) |
| Rol implementado | **CRM Frisson = servidor.** Expone las 6 operaciones. MEP-LEAN es cliente (pull + write-back). |
| Go-Live objetivo | 9 de octubre de 2026 |
| Base path | `/v1` |
| Transporte | HTTPS obligatorio (TLS 1.2+). HTTP → 426 / redirect 308 a HTTPS. |

---

## 0. Cómo usar este spec

1. **Constitución (§1)** — principios no negociables. Ningún PR puede violarlos.
2. **Contrato (§4–§6)** — endpoints, payloads y responses **literales**. Se implementan sin variación de nombres, tipos ni códigos.
3. **Reglas de negocio (§7)** y **persistencia/concurrencia (§8–§9)** — invariantes verificables; cada una tiene ID `INV-xx` y al menos un test.
4. **No funcionales (§10–§13)** — seguridad, rate limit, auditoría, observabilidad.
5. **Tareas (§14)** — desglose ejecutable con IDs `T-xxx`.
6. **Pruebas (§15)** — cada `INV-xx`, `ERR-xx` y `AC-xx` mapea a un test con ID.
7. **Aceptación (§16)**, **pendientes (§17)** y **Definition of Done (§18)**.

**Trazabilidad obligatoria:** todo commit referencia al menos un ID (`T-xxx`, `INV-xx`, `AC-xx`).

---

## 1. Constitución del proyecto (principios no negociables)

| ID | Principio |
|---|---|
| `P-01` | **El CRM conserva la autoridad comercial en todo momento.** MEP-LEAN nunca escribe sobre el modelo de negocio del CRM; solo publica *hechos observados* (acuses técnicos y respuestas versionadas) que el CRM decide cómo proyectar. |
| `P-02` | **Pull, no push.** El CRM nunca invoca endpoints de MEP-LEAN. Toda la superficie física es del CRM. |
| `P-03` | **El intake no contiene `interaction_type`.** La clasificación (`delivered_interaction_type`) solo puede llegar en el hito de cierre, nunca antes. |
| `P-04` | **Frontera LEAN.** Power Automate, Excel, SharePoint List interno, Events, Snapshots, Cuts, reintentos y fingerprints de MEP son internos a su operación: **no se modelan, no se persisten como campos comerciales, no cruzan el contrato.** |
| `P-05` | **Escritura idempotente y versionada.** Todo write lleva `Idempotency-Key` y `X-Correlation-ID`; el mismo key con payload distinto es `409`. |
| `P-06` | **Toda escritura es auditable.** No existe mutación sin registro append-only en `audit_log`. |
| `P-07` | **`source_content` es intocable.** El CRM lo preserva sin alteración (sin trim, normalización, sanitización destructiva ni re-encoding). |
| `P-08` | **La narrativa es incremental, nunca acumulativa.** `narrative_note` contiene solo el texto de esa `response_version`. |
| `P-09` | **Tres relojes de versión no intercambiables** (`response_id`, `response_version`, `route_capacity.version`). Nunca se derivan uno del otro ni de IDs externos. |
| `P-10` | **Errores explícitos antes que tolerancia silenciosa.** Un payload semánticamente inválido es `422`, no una corrección automática. |
| `P-11` | **Una interacción CRM = una sola tarea Planner** durante MEP-LEAN. |
| `P-12` | **Contract-first.** El OpenAPI 3.1 (`openapi/crm-mep.yaml`) y los JSON Schema son artefactos versionados; el código se valida contra ellos en CI. |

---

## 2. Contexto y alcance

### 2.1 Flujo

```
┌──────────────┐   1. GET /v1/commercial-interactions (polling, cursor)
│              │ ─────────────────────────────────────────────────────▶ ┌──────────────┐
│  CRM Frisson │   2. GET /v1/commercial-opportunities/{ref} (contexto)  │   MEP-LEAN   │
│  (servidor,  │ ◀───────────────────────────────────────────────────── │  (fábrica de │
│   autoridad  │   3. POST .../processing-receipts (acuse técnico)       │   Preventa)  │
│   comercial) │ ◀───────────────────────────────────────────────────── │              │
│              │   4. PUT .../responses/{response_id} (hitos V1..Vn)     │              │
│              │ ◀───────────────────────────────────────────────────── │              │
│              │   5. GET .../responses/{response_id} (verificación)     │              │
└──────────────┘ ◀───────────────────────────────────────────────────── └──────────────┘
```

### 2.2 Dentro de alcance

- 6 operaciones HTTP del CRM.
- Persistencia de acuses técnicos y respuestas comerciales versionadas.
- Máquina de 4 hitos comerciales y su proyección a la UI del CRM.
- Seguridad `X-API-Key`, idempotencia, control de concurrencia optimista (ETag/If-Match).
- Auditoría, rate limiting, observabilidad.
- Suite de pruebas de contrato y fixtures `response-v1` … `response-v5`.

### 2.3 Fuera de alcance (explícito)

Power Automate · Excel de MEP · SharePoint List interno · Events · Snapshots · Cuts · política de reintentos de MEP · fingerprints internos de MEP · `PROCESS_EVIDENCE` · `evidence_url`.
El CRM **no los conoce ni los modela**. Aparecer en el modelo de datos del CRM es un defecto bloqueante.

---

## 3. Glosario y modelo de dominio

| Término | Definición |
|---|---|
| **Interacción comercial** | Unidad mínima que dispara trabajo en MEP-LEAN. Identificada por `crm_interaction_ref`. |
| **OUV / oportunidad** | Oportunidad comercial. Identificada por `crm_opportunity_ref`. Autoridad total del CRM. |
| **Acuse técnico** (`processing-receipt`) | Hecho de transporte: MEP confirma que recibió/procesó técnicamente. **No** es el hito comercial `INTERACTION_RECEIVED`. |
| **Respuesta agregada** (`response`) | Agregado versionado que MEP publica en cada hito comercial. Un solo `response_id` por interacción. |
| **Hito comercial** (`business_milestone`) | Uno de los 4 estados de negocio observables por el usuario comercial. |
| **`commercial_archetype`** | Arquetipo comercial de la OUV. Autoridad CRM. **No** se equipara con `Archetype_Lane` de MEP. |
| **`Archetype_Lane`** | Carril operativo interno de MEP. **No cruza el contrato.** |
| **Servicio** | `TECHNICAL_DESIGN` o `FINANCIAL_DESIGN`, cada uno con su `dependency`. |
| **Entregable** | URL de **SharePoint Documents** por servicio. El registro de SharePoint List **nunca** es entregable. |

### 3.1 Enumeraciones canónicas

```ts
enum ServiceHorizon      { IMMEDIATE, DEFERRED, UNSPECIFIED }
enum ServiceName         { TECHNICAL_DESIGN, FINANCIAL_DESIGN }
enum ServiceDependency   { NONE, TECHNICAL_DESIGN, FINANCIAL_DESIGN }
enum ProcessingStatus    { ACCEPTED, DUPLICATE, QUARANTINED, REJECTED }
enum BusinessMilestone   { INTERACTION_RECEIVED, ENGINEER_ASSIGNED, ROUTE_CAPACITY_REGISTERED, INTERACTION_COMPLETED }
enum ResponseStatus      { RECEIVED, IN_PROGRESS, COMPLETED }
enum ServiceResultStatus { RECEIVED, IN_PROGRESS, COMPLETED, CANCELLED }
enum ServiceOutcome      { VIABLE, NOT_VIABLE, PARTIAL }   // null mientras no haya resultado
enum RouteStatus         { VIABLE, NOT_VIABLE, CONDITIONED }
enum CapacityStatus      { PLANNED, NOT_PLANNED, CONDITIONED }
enum OpportunityStatus   { OPEN, WON, LOST, CANCELLED }
```

> ⚠️ Los valores de `ServiceResultStatus`, `ServiceOutcome`, `RouteStatus`, `CapacityStatus` y `OpportunityStatus` más allá de los observados en los ejemplos del brief están marcados como **`OPEN-01`** en §16 y deben confirmarse antes de producción. La implementación los define como enum cerrado y rechaza valores desconocidos con `422`.

---

## 4. Fuente de datos — interacción comercial

Objeto que el CRM expone en cada elemento de polling (`interaction.schema.json`).

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| `crm_interaction_ref` | string | Sí | Referencia opaca y estable; identidad de correlación del lado CRM |
| `crm_opportunity_ref` | string \| null | Sí | Referencia opaca a la OUV; nula cuando el negocio lo permita |
| `service_horizon` | enum | Sí | `IMMEDIATE`, `DEFERRED` o `UNSPECIFIED` |
| `requested_services[]` | array (1–2) | Sí | `TECHNICAL_DESIGN` y/o `FINANCIAL_DESIGN`, cada uno con su `dependency` |
| `subject` | string \| null | No | Asunto libre de la interacción |
| `source_content` | string | Sí | Contenido humano original; el CRM lo preserva sin alteración |
| `source_created_at` | date-time | Sí | Timestamp de creación en el CRM |
| `source_version` | string | Sí | Versión de origen de la interacción |
| `etag` | string | Sí | Versión opaca del recurso, usada en `If-Match` |

**Regla de dependencia entre servicios (`INV-01`):** `TECHNICAL_DESIGN` siempre tiene `dependency = NONE`; `FINANCIAL_DESIGN` puede depender de `TECHNICAL_DESIGN` pero **nunca al revés**. Un técnico dependiente de un financiero se rechaza con **`422`**.

### 4.1 Ejemplo real — página de intake (técnico seguido de financiero)

```json
{
  "items": [
    {
      "crm_interaction_ref": "int_20004",
      "crm_opportunity_ref": "ouv_9104",
      "service_horizon": "IMMEDIATE",
      "requested_services": [
        { "service": "TECHNICAL_DESIGN", "dependency": "NONE" },
        { "service": "FINANCIAL_DESIGN", "dependency": "TECHNICAL_DESIGN" }
      ],
      "subject": "Diseño técnico seguido de financiero",
      "source_content": "El modelo financiero inicia después del resultado técnico.",
      "source_created_at": "2026-08-21T14:36:00Z",
      "source_version": "1",
      "etag": "\"int-20004-v1\""
    }
  ],
  "has_more": false,
  "next_cursor": null,
  "page_observed_at": "2026-08-21T14:37:12Z",
  "high_watermark": "2026-08-21T14:36:00Z"
}
```

---

## 5. Contrato del CRM (servidor) — 6 operaciones

| # | Método/ruta | Tag OpenAPI | Propósito |
|---|---|---|---|
| 1 | `GET /v1/commercial-interactions` | Intake | Pull paginado de interacciones elegibles (`cursor`, `limit`, `service_horizon`). |
| 2 | `GET /v1/commercial-interactions/{interaction_ref}` | Intake | Relectura y reconciliación de una interacción, con ETag. |
| 3 | `GET /v1/commercial-opportunities/{opportunity_ref}` | Opportunity | Contexto puntual de oportunidad u OUV, con ETag. |
| 4 | `POST /v1/commercial-interactions/{interaction_ref}/processing-receipts` | Processing | Acuse técnico idempotente de recepción/procesamiento. **No crea ni reemplaza la interacción comercial.** |
| 5 | `PUT /v1/commercial-interactions/{interaction_ref}/responses/{response_id}` | Response | Publica una respuesta MEP agregada, versionada e idempotente. |
| 6 | `GET /v1/commercial-interactions/{interaction_ref}/responses/{response_id}` | Response | Verifica el resultado persistido después del write. |

### 5.1 Seguridad

Security scheme **`apiKeyAuth`**: tipo `apiKey`, header **`X-API-Key`**.

- Credencial **no humana**, suministrada **por ambiente**, almacenada **fuera de payloads, logs y Git**.
- Restringida por el CRM a las operaciones autorizadas para MEP.
- Debe admitir **rotación y revocación**.
- `401` = clave ausente o inválida · `403` = identidad válida sin permiso para la operación solicitada.

### 5.2 Headers de escritura

| Header | Oblig. | Uso |
|---|---|---|
| `Idempotency-Key` | Sí | 8–256 caracteres. Mismo key + payload distinto → **`409 Conflict`**. |
| `If-Match` | No | ETag leído previamente; si no coincide con la versión actual → **`412 Precondition Failed`**. |
| `X-Correlation-ID` | Sí | Correlación de la petición para trazabilidad conjunta. |

### 5.3 Catálogo de errores

| Código | Caso | ID |
|---|---|---|
| `400` | Solicitud mal formada | `ERR-400` |
| `401` | API key ausente o inválida | `ERR-401` |
| `403` | API key válida sin permiso para la operación | `ERR-403` |
| `404` | Recurso inexistente | `ERR-404` |
| `409` | `Idempotency-Key` reutilizado con contenido diferente | `ERR-409` |
| `412` | ETag o versión desactualizada | `ERR-412` |
| `422` | Payload válido sintácticamente pero inválido semánticamente (p. ej. dependencia invertida) | `ERR-422` |
| `429` | Cuota temporal; incluye header `Retry-After` | `ERR-429` |
| `503` | Error transitorio del CRM | `ERR-503` |

### 5.4 Formato de error (RFC 7807 `application/problem+json`)

```json
{
  "type": "https://api.frisson.crm/problems/inverted-dependency",
  "title": "Dependencia de servicio inválida",
  "status": 422,
  "detail": "TECHNICAL_DESIGN no admite dependency = FINANCIAL_DESIGN.",
  "instance": "/v1/commercial-interactions/int_20004/responses/mep:int_20004:response",
  "code": "INVERTED_SERVICE_DEPENDENCY",
  "correlation_id": "corr_01JCRM20004",
  "errors": [
    { "pointer": "/service_results/0/dependency", "code": "INVERTED_SERVICE_DEPENDENCY" }
  ]
}
```

**Regla `INV-02`:** el cuerpo de error **nunca** incluye `source_content`, valores de `X-API-Key`, ni identificadores internos de MEP.

---
## 6. Especificación operación por operación

Convención común a todas:

- Header de request obligatorio: `X-API-Key`. Recomendado: `X-Correlation-ID` (obligatorio en writes).
- Header de response siempre presente: `X-Correlation-ID` (eco o generado), `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.
- Todos los `date-time` en **UTC, RFC 3339, sufijo `Z`**, precisión de segundos o milisegundos.
- Todos los `etag` son **opacos y entrecomillados** (`"int-20004-v1"`), fuertes (no `W/`).

---

### 6.1 `GET /v1/commercial-interactions` — pull paginado (Intake)

**Propósito:** entregar la página de interacciones elegibles para MEP-LEAN, con orden total, repetible y estable.

#### Query params

| Param | Tipo | Oblig. | Default | Notas |
|---|---|---|---|---|
| `cursor` | string | No | — | Cursor **opaco**, estable y exclusivo (la página siguiente **no** repite el último elemento). Retención declarada: **7 días**; cursor expirado → `400` con `code = CURSOR_EXPIRED`. |
| `limit` | integer | No | `50` | Rango `1..200`. Fuera de rango → `400`. |
| `service_horizon` | enum | No | — | Filtro `IMMEDIATE` \| `DEFERRED` \| `UNSPECIFIED`. |

#### Orden total (`INV-03`)

Clave de orden estricta y determinista, resistente a inserciones concurrentes:

```
ORDER BY source_created_at ASC, id ASC
```

El cursor codifica `(source_created_at, id)` + firma HMAC. Se prohíbe `OFFSET`.

#### Response `200`

```json
{
  "items": [
    {
      "crm_interaction_ref": "int_20004",
      "crm_opportunity_ref": "ouv_9104",
      "service_horizon": "IMMEDIATE",
      "requested_services": [
        { "service": "TECHNICAL_DESIGN", "dependency": "NONE" },
        { "service": "FINANCIAL_DESIGN", "dependency": "TECHNICAL_DESIGN" }
      ],
      "subject": "Diseño técnico seguido de financiero",
      "source_content": "El modelo financiero inicia después del resultado técnico.",
      "source_created_at": "2026-08-21T14:36:00Z",
      "source_version": "1",
      "etag": "\"int-20004-v1\""
    }
  ],
  "has_more": false,
  "next_cursor": null,
  "page_observed_at": "2026-08-21T14:37:12Z",
  "high_watermark": "2026-08-21T14:36:00Z"
}
```

| Campo de página | Semántica |
|---|---|
| `has_more` | `true` si existen más elementos después de esta página. |
| `next_cursor` | Cursor para la siguiente página; `null` cuando `has_more = false`. |
| `page_observed_at` | Instante en que el CRM construyó la página. |
| `high_watermark` | Mayor `source_created_at` incluido; MEP lo usa para su avance lógico. `null` si `items` está vacío. |

**Invariantes**

- `INV-04`: si `has_more = false` entonces `next_cursor = null`, y viceversa.
- `INV-05`: la relectura con el mismo `cursor` devuelve **exactamente los mismos ítems** en el mismo orden (no se filtra por "ya entregado").
- `INV-06`: el endpoint **nunca** incluye `interaction_type` ni ningún campo derivado de la clasificación Planner.
- `INV-07`: `source_content` se devuelve byte-a-byte como fue creado.

**Errores:** `400` (cursor inválido/expirado, `limit` fuera de rango, enum desconocido), `401`, `403`, `429`, `503`.

---

### 6.2 `GET /v1/commercial-interactions/{interaction_ref}` — relectura (Intake)

**Propósito:** relectura y reconciliación por identidad, con ETag.

- Request opcional: `If-None-Match: "int-20004-v1"` → **`304 Not Modified`** sin cuerpo si no cambió.
- Response `200`: el mismo objeto del ítem de intake (§4.1), con header `ETag: "int-20004-v1"`.
- `404` si `interaction_ref` no existe o no es visible para la identidad.

**Invariante `INV-08`:** el `etag` del cuerpo y el header `ETag` son idénticos. Cambia si y solo si cambia algún campo del recurso; `source_version` avanza con él.

---

### 6.3 `GET /v1/commercial-opportunities/{opportunity_ref}` — contexto de OUV (Opportunity)

#### Response `200` (ejemplo real del paquete)

```json
{
  "crm_opportunity_ref": "ouv_9101",
  "title": "OUV de ejemplo para integración",
  "organization": {
    "ref": "org_4101",
    "name": "Cliente de ejemplo"
  },
  "commercial_value": {
    "amount": 125000000,
    "currency": "COP"
  },
  "stage": {
    "ref": "stage_design",
    "name": "Diseño de preventa"
  },
  "status": "OPEN",
  "expected_close_date": "2026-09-30",
  "commercial_owner": {
    "ref": "commercial_17",
    "display_name": "Ejecutivo Comercial"
  },
  "commercial_archetype": {
    "ref": "arch_b2g_structured",
    "name": "B2G-ESTRUCTURADO"
  },
  "context_observed_at": "2026-08-21T14:31:20Z",
  "source_version": "7",
  "etag": "\"ouv-9101-v7\""
}
```

**Reglas**

- `INV-09`: **los nulos se preservan.** Un campo sin valor se serializa como `null`; **nunca** se omite ni se sustituye por `""`, `0` o un placeholder. Aplica a `organization`, `commercial_value`, `stage`, `commercial_owner`, `commercial_archetype`, `expected_close_date`.
- `INV-10`: `commercial_archetype` expone **referencia y nombre estables o `null`**, bajo autoridad CRM.
- `INV-11`: `commercial_archetype` **es autoridad del CRM.** MEP puede usarlo para su proyección operativa interna pero **no lo devuelve ni lo sobrescribe** por este contrato, y **no se equipara automáticamente** con el carril operativo `Archetype_Lane` de su Excel interno.
- `commercial_value.amount` es entero en la unidad menor no fraccionada acordada (COP sin decimales); `currency` en ISO-4217.
- Soporta `If-None-Match` → `304`.

**Errores:** `401`, `403`, `404`, `429`, `503`.

---

### 6.4 `POST /v1/commercial-interactions/{interaction_ref}/processing-receipts` — acuse técnico (Processing)

**Propósito:** acuse técnico **idempotente** de recepción/procesamiento. **No crea ni reemplaza la interacción comercial.**

#### Headers

`X-API-Key` (Sí) · `Idempotency-Key` (Sí, 8–256) · `X-Correlation-ID` (Sí) · `If-Match` (No)

#### Request body (ejemplo real del paquete)

```json
{
  "receipt_id": "mep:receipt:int_20004:v1",
  "receipt_version": 1,
  "processing_status": "ACCEPTED",
  "correlation_id": "corr_01JCRM20004",
  "observed_at": "2026-08-21T14:37:12Z",
  "adapter_version": "0.2.0",
  "reason_code": null,
  "semantic_fingerprint": "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
}
```

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| `receipt_id` | string | Sí | Identidad estable del acuse generada por MEP. |
| `receipt_version` | integer ≥ 1 | Sí | Monotónico por `receipt_id`. |
| `processing_status` | enum | Sí | `ACCEPTED` \| `DUPLICATE` \| `QUARANTINED` \| `REJECTED`. |
| `correlation_id` | string | Sí | Correlación conjunta; coincide con `X-Correlation-ID`. |
| `observed_at` | date-time | Sí | Instante observado por MEP. |
| `adapter_version` | string | Sí | Versión del adaptador MEP (semver). |
| `reason_code` | string \| null | Sí (nullable) | Obligatorio no nulo cuando `processing_status ∈ {QUARANTINED, REJECTED}`; si no, `422`. |
| `semantic_fingerprint` | string (hex 64) | Sí | **Opaco para el CRM.** Se persiste solo como dato técnico del acuse; no se expone como campo comercial ni se usa en lógica de negocio. |

#### Responses

| Código | Caso |
|---|---|
| `201 Created` | Acuse nuevo persistido. Header `Location` con el recurso; body = representación persistida. |
| `200 OK` | Replay idempotente: mismo `Idempotency-Key` **y** mismo payload → devuelve la representación ya persistida, sin efectos secundarios. |
| `409` | Mismo `Idempotency-Key` con payload distinto; o mismo `(receipt_id, receipt_version)` con contenido distinto. |
| `412` | `If-Match` presente y desactualizado. |
| `422` | `reason_code` faltante en `QUARANTINED`/`REJECTED`; `receipt_version` no monotónico; enum desconocido. |
| `400`, `401`, `403`, `404`, `429`, `503` | Según §5.3. |

**Reglas de negocio**

- `INV-12`: el acuse es **transporte transparente** para el usuario. **No sustituye** el hito comercial `INTERACTION_RECEIVED`. El CRM **no debe tratarlos como el mismo estado ni duplicar notas por ambos hechos.**
- `INV-13`: el acuse **no muta** ninguna columna de la interacción comercial (`status`, `stage`, notas comerciales). Solo escribe en `processing_receipt` + `audit_log`.
- `INV-14`: la proyección a UI del acuse vive en una pista técnica separada de la narrativa comercial.

---

### 6.5 `PUT .../{interaction_ref}/responses/{response_id}` — respuesta comercial agregada (Response)

**Propósito:** publicar una respuesta MEP **agregada, versionada e idempotente**. Es el único canal por el que MEP publica hechos comerciales.

#### Headers

`X-API-Key` (Sí) · `Idempotency-Key` (Sí) · `X-Correlation-ID` (Sí) · `If-Match` (recomendado: ETag de la última respuesta leída)

#### Request body — ejemplo real en el hito `ROUTE_CAPACITY_REGISTERED`

*(V1 de ruta/capacidad, con técnico en curso y financiero recibido)*

```json
{
  "response_id": "mep:int_20004:response",
  "response_version": 3,
  "business_milestone": "ROUTE_CAPACITY_REGISTERED",
  "response_status": "IN_PROGRESS",
  "eta_date": "2026-08-28",
  "next_milestone": "Completar diseño técnico",
  "responded_at": "2026-08-21T16:00:00Z",
  "responded_by": { "ref": "engineer_15", "display_name": "Ingeniero Preventa" },
  "assignment": {
    "engineer": { "ref": "engineer_15", "display_name": "Ingeniero Preventa" },
    "assigned_at": "2026-08-21T14:59:30Z"
  },
  "route_capacity": {
    "version": "V1",
    "route_status": "VIABLE",
    "capacity_status": "PLANNED",
    "summary": "Ruta viable y capacidad planificada registradas.",
    "registered_at": "2026-08-21T15:59:30Z",
    "registered_by": { "ref": "engineer_15", "display_name": "Ingeniero Preventa" }
  },
  "service_results": [
    { "service": "TECHNICAL_DESIGN", "status": "IN_PROGRESS", "outcome": "VIABLE", "dependency": "NONE", "summary": "Ruta técnica viable; entregable en construcción.", "reason_code": null, "deliverables": [] },
    { "service": "FINANCIAL_DESIGN", "status": "RECEIVED", "outcome": null, "dependency": "TECHNICAL_DESIGN", "summary": "Pendiente del resultado técnico.", "reason_code": null, "deliverables": [] }
  ],
  "operational_links": {
    "planner_interaction_url": "https://tasks.office.com/verytel/Home/Task/task-20004",
    "route_capacity_register_url": "https://verytel.sharepoint.com/sites/preventa/Lists/Commitments/DispForm.aspx?ID=20004"
  },
  "narrative_note": "Ruta viable V1, ETA y capacidad planificada quedaron registradas.",
  "delivered_interaction_type": null,
  "semantic_fingerprint": "3333333333333333333333333333333333333333333333333333333333333333"
}
```

#### Diccionario de campos

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| `response_id` | string | Sí | Debe coincidir con el `{response_id}` de la ruta; si no, `422`. Identidad estable del agregado. |
| `response_version` | integer ≥ 1 | Sí | Monotónico estricto por `response_id`. |
| `business_milestone` | enum | Sí | Uno de los 4 hitos. |
| `response_status` | enum | Sí | Derivado y validado contra el hito (§7.1). |
| `eta_date` | date \| null | Condicional | **Un único ETA global** por interacción. Obligatorio desde `ROUTE_CAPACITY_REGISTERED`. |
| `next_milestone` | string \| null | No | Texto libre orientativo. |
| `responded_at` | date-time | Sí | Instante del hecho comercial. |
| `responded_by` | `{ref, display_name}` | Sí | Actor humano de MEP. |
| `assignment` | `{engineer:{ref,display_name}, assigned_at}` \| null | Condicional | Obligatorio desde `ENGINEER_ASSIGNED`. |
| `route_capacity` | objeto \| null | Condicional | Obligatorio desde `ROUTE_CAPACITY_REGISTERED`. `version` = `V1`, `V2`, … (patrón `^V[1-9]\d*$`). |
| `service_results[]` | array (1–2) | Sí | **Fuente de verdad**; el CRM deriva de aquí sus campos de presentación. |
| `operational_links` | objeto | Condicional | `planner_interaction_url` obligatorio desde `ENGINEER_ASSIGNED`; `route_capacity_register_url` obligatorio desde `ROUTE_CAPACITY_REGISTERED`. HTTPS obligatorio. |
| `narrative_note` | string \| null | Sí (nullable) | **Solo el texto de esa `response_version`**, nunca la historia acumulada. |
| `delivered_interaction_type` | string \| null | Sí (nullable) | `null` **obligatorio** antes del cierre. |
| `semantic_fingerprint` | string (hex 64) | Sí | Opaco. Dato técnico; no se expone como campo comercial. |

**`service_results[]` — elemento:**

| Campo | Tipo | Notas |
|---|---|---|
| `service` | enum | `TECHNICAL_DESIGN` \| `FINANCIAL_DESIGN`. Sin duplicados en el array. |
| `status` | enum | `RECEIVED` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED`. |
| `outcome` | enum \| null | `null` mientras `status ≠ COMPLETED`. |
| `dependency` | enum | Debe respetar `INV-01`. |
| `summary` | string \| null | Texto del estado del servicio. |
| `reason_code` | string \| null | Obligatorio cuando `outcome ∈ {NOT_VIABLE, PARTIAL}` o `status = CANCELLED`. |
| `deliverables[]` | array | Vacío mientras no haya entregable. Cada elemento: `{ "url": "https://…sharepoint.com/…/Documents/…", "label": "…", "published_at": "…" }`. **Debe ser SharePoint Documents.** |

#### Responses

| Código | Caso |
|---|---|
| `200 OK` | Versión persistida (creación de nueva `response_version` o replay idempotente). Body = representación persistida completa. Header `ETag`. |
| `409` | Mismo `Idempotency-Key` con payload distinto; **o** mismo `(response_id, response_version)` con contenido distinto. |
| `412` | `If-Match` desactualizado (edición humana concurrente en el CRM). |
| `422` | Violación de cualquier `INV-xx` semántico (dependencia invertida, hito incompleto, `delivered_interaction_type` prematuro, `response_version` no monotónico, `response_id` discrepante con la ruta…). |
| `400`, `401`, `403`, `404`, `429`, `503` | Según §5.3. |

---

### 6.6 `GET .../{interaction_ref}/responses/{response_id}` — verificación post-write (Response)

**`INV-15`:** devuelve **exactamente la misma representación persistida** que el `PUT` (§6.5) — es la verificación post-write. Mismo `ETag`, mismos campos, mismo orden semántico de `service_results[]`.

- Sin query params: devuelve la **última** `response_version`.
- Con `?version=3`: devuelve esa versión concreta (histórico inmutable). `404` si no existe.
- Soporta `If-None-Match` → `304`.

---
## 7. Reglas de negocio del contrato

### 7.1 Los 4 hitos comerciales (`business_milestone`)

| Hito | Exige |
|---|---|
| `INTERACTION_RECEIVED` | `response_status = RECEIVED` |
| `ENGINEER_ASSIGNED` | `assignment`, `response_status = IN_PROGRESS`, `planner_interaction_url` |
| `ROUTE_CAPACITY_REGISTERED` | `route_capacity`, `eta_date`, `assignment`, `route_capacity_register_url` |
| `INTERACTION_COMPLETED` | `service_results` completos con `deliverables`, `response_status = COMPLETED` |

**Máquina de estados (`INV-16`)** — orden no regresivo:

```
INTERACTION_RECEIVED ──▶ ENGINEER_ASSIGNED ──▶ ROUTE_CAPACITY_REGISTERED ──▶ INTERACTION_COMPLETED
        │                       │                          │
        └───────────────────────┴──────────────────────────┴──▶ (misma etapa repetible con nueva versión)
```

- Se admite **repetir el mismo hito** en una nueva `response_version` (p. ej. `ROUTE_CAPACITY_REGISTERED` V1 → V2 de `route_capacity`).
- **No** se admite retroceder a un hito anterior. Retroceso → `422` (`MILESTONE_REGRESSION`).
- Una vez alcanzado `INTERACTION_COMPLETED`, publicar un hito distinto → `422` (`INTERACTION_ALREADY_COMPLETED`).
- Lo exigido por un hito **permanece exigido** en los hitos posteriores (`assignment` no puede volver a `null`).

### 7.2 Tres relojes de versión — no intercambiables (`INV-17`)

- **`response_id`**: identidad estable del agregado de respuesta. MEP la genera **una sola vez** y la reutiliza en todos los hitos; **no es** un ID de SharePoint ni de un intento de entrega.
- **`response_version`**: entero monotónico; avanza **solo con un hecho comercial nuevo** — un retry **no** lo incrementa.
- **`route_capacity.version` (`V1`/`Vx`)**: reloj de negocio **independiente** del acuerdo de ETA/ruta/capacidad; puede permanecer en `V2` mientras una publicación posterior `V5` informa el cierre.

> `route_capacity.version` **no** tiene que moverse cuando `response_version` avanza, ni viceversa. Cualquier implementación que los acople es un defecto.

### 7.3 Narrativa incremental

- `source_content`: contenido humano original; el CRM lo **preserva sin alteración**.
- `narrative_note`: **solo el texto de esa `response_version`**, nunca la historia acumulada.
- **Clave lógica de cada entrada:** `(crm_interaction_ref, response_id, response_version)`.
- Un **retry idéntico no duplica** la entrada; una **nueva versión agrega, no reemplaza**.
- La UI muestra las entradas MEP de **más reciente a más antigua**, con el contenido original **siempre visible**.

### 7.4 Mappings prohibidos (`INV-18` … `INV-27`)

| ID | Prohibición |
|---|---|
| `INV-18` | No mapear `TIPO-POR-ESPECIFICAR` a horizonte o servicio. |
| `INV-19` | No enviar `interaction_type` en el intake ni tratar `requested_services[]` como clasificación Planner. |
| `INV-20` | No publicar `delivered_interaction_type` antes del cierre, con el valor provisional, o por inferencia desde el servicio solicitado. |
| `INV-21` | No confundir `commercial_archetype` de la OUV con `Archetype_Lane` de Excel, aunque una etiqueta coincida. |
| `INV-22` | No admitir `TECHNICAL_DESIGN` con `dependency = FINANCIAL_DESIGN`. |
| `INV-23` | No convertir el registro SharePoint List en entregable, ni Planner *completed* en entrega final sin URL de SharePoint Documents. |
| `INV-24` | No definir `PROCESS_EVIDENCE` ni `evidence_url` en el contrato externo. |
| `INV-25` | No exponer IDs de filas Excel, Events, Snapshots, Cuts, retries o fingerprints como campos comerciales. |
| `INV-26` | No derivar `response_id` de un intento de entrega ni cambiarlo entre hitos de la misma interacción. |
| `INV-27` | No mapear directamente a `response_version` la versión de acuerdo/ruta, secuencias de dispatch/respuesta, `delivery_attempt`, ID/ETag de SharePoint ni la versión nativa de otra herramienta. |

**Validación mecánica:** el `PUT` rechaza con `422` cualquier propiedad no declarada en el schema (`additionalProperties: false`) y una lista negra de nombres (`interaction_type`, `evidence_url`, `process_evidence`, `excel_row_id`, `event_id`, `snapshot_id`, `cut_id`, `delivery_attempt`, `archetype_lane`).

### 7.5 Matriz de autoridad y estados

| Dimensión | Autoridad | MEP publica | CRM realiza |
|---|---|---|---|
| Interacción comercial | CRM | lectura, acuse y respuesta | conserva ciclo comercial y UI |
| OUV/oportunidad | CRM | contexto observado | conserva valor, etapa, estado y propietario |
| Arquetipo comercial | CRM | lo observa desde el contexto OUV | conserva catálogo, referencia y nombre; MEP no lo sobrescribe |
| Carril operativo `Archetype_Lane` | MEP | nada al CRM por este contrato | sin autoridad ni mapping inverso |
| Recepción técnica | MEP (productor del hecho) | acuse `ACCEPTED`/`DUPLICATE`/`QUARANTINED`/`REJECTED` | lo registra sin tratarlo como resultado técnico |
| Hito comercial | MEP (productor del hecho) | `business_milestone` + versión | lo proyecta a la experiencia de usuario |
| Nota original | CRM/usuario comercial | MEP solo la observa como `source_content` | la conserva sin alteración |
| Narrativa MEP | MEP (productor de cada versión) | `narrative_note` de esa versión | la persiste incremental e idempotentemente |
| Servicio técnico/financiero | MEP/Preventa | elemento autoritativo en `service_results[]` | deriva campos y presentación |
| ETA | MEP/Preventa | un `eta_date` global | lo muestra como compromiso, no como finalización |
| Ruta/capacidad | MEP/Preventa | objeto versionado y URL SharePoint List | muestra `V1`/`Vx` sin confundirlo con entregable |
| Entregable | MEP/Preventa | URL SharePoint Documents por servicio | presenta/enlaza el resultado final |
| Clasificación entregada | MEP/Preventa, tras clasificación humana en Planner | `delivered_interaction_type` solo al cierre | la registra sin derivarla de servicios |
| Estado global | CRM | `response_status` derivado | conserva reglas internas y detalle por servicio |

### 7.6 Los 4 casos de forma válida de `requested_services[]`

| Caso | Forma | Válido |
|---|---|---|
| `C-1` | Sólo técnico | `[{TECHNICAL_DESIGN, NONE}]` | ✅ |
| `C-2` | Financiero directo sin fase técnica | `[{FINANCIAL_DESIGN, NONE}]` | ✅ |
| `C-3` | Técnico y financiero simultáneos e independientes | `[{TECHNICAL_DESIGN, NONE}, {FINANCIAL_DESIGN, NONE}]` | ✅ |
| `C-4` | Técnico seguido de financiero dependiente | `[{TECHNICAL_DESIGN, NONE}, {FINANCIAL_DESIGN, TECHNICAL_DESIGN}]` | ✅ |
| `C-NEG` | Técnico dependiente de financiero | `[{TECHNICAL_DESIGN, FINANCIAL_DESIGN}, …]` | ❌ **`422`** |

---

## 8. Modelo de datos (MySQL 8 / Sequelize)

> Sin claves foráneas hacia nada de MEP. Ninguna tabla modela Events, Snapshots, Cuts, Excel ni retries.

```sql
-- Interacción comercial (autoridad CRM)
CREATE TABLE commercial_interaction (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  crm_interaction_ref VARCHAR(64)  NOT NULL UNIQUE,
  crm_opportunity_ref VARCHAR(64)  NULL,
  service_horizon     ENUM('IMMEDIATE','DEFERRED','UNSPECIFIED') NOT NULL,
  subject             VARCHAR(512) NULL,
  source_content      MEDIUMTEXT   NOT NULL,          -- inmutable para la integración
  source_created_at   DATETIME(3)  NOT NULL,
  source_version      VARCHAR(32)  NOT NULL,
  etag                VARCHAR(96)  NOT NULL,
  eligible_for_mep    TINYINT(1)   NOT NULL DEFAULT 1,
  created_at          DATETIME(3)  NOT NULL,
  updated_at          DATETIME(3)  NOT NULL,
  KEY ix_intake_order (source_created_at, id),        -- orden total del cursor
  KEY ix_horizon (service_horizon, source_created_at, id)
);

CREATE TABLE interaction_requested_service (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  interaction_id      BIGINT UNSIGNED NOT NULL,
  service             ENUM('TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
  dependency          ENUM('NONE','TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
  position            TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_service (interaction_id, service),
  FOREIGN KEY (interaction_id) REFERENCES commercial_interaction(id)
);

-- Oportunidad / OUV (autoridad CRM)
CREATE TABLE commercial_opportunity (
  id                     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  crm_opportunity_ref    VARCHAR(64) NOT NULL UNIQUE,
  title                  VARCHAR(512) NULL,
  organization_ref       VARCHAR(64)  NULL,
  organization_name      VARCHAR(512) NULL,
  commercial_amount      BIGINT       NULL,
  commercial_currency    CHAR(3)      NULL,
  stage_ref              VARCHAR(64)  NULL,
  stage_name             VARCHAR(256) NULL,
  status                 ENUM('OPEN','WON','LOST','CANCELLED') NULL,
  expected_close_date    DATE         NULL,
  commercial_owner_ref   VARCHAR(64)  NULL,
  commercial_owner_name  VARCHAR(256) NULL,
  archetype_ref          VARCHAR(64)  NULL,
  archetype_name         VARCHAR(256) NULL,
  source_version         VARCHAR(32)  NOT NULL,
  etag                   VARCHAR(96)  NOT NULL,
  updated_at             DATETIME(3)  NOT NULL
);

-- Acuse técnico (hecho de MEP, pista técnica)
CREATE TABLE processing_receipt (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  interaction_id      BIGINT UNSIGNED NOT NULL,
  receipt_id          VARCHAR(128) NOT NULL,
  receipt_version     INT UNSIGNED NOT NULL,
  processing_status   ENUM('ACCEPTED','DUPLICATE','QUARANTINED','REJECTED') NOT NULL,
  correlation_id      VARCHAR(128) NOT NULL,
  observed_at         DATETIME(3)  NOT NULL,
  adapter_version     VARCHAR(32)  NOT NULL,
  reason_code         VARCHAR(64)  NULL,
  semantic_fingerprint CHAR(64)    NOT NULL,          -- opaco, técnico
  payload_hash        CHAR(64)     NOT NULL,
  etag                VARCHAR(96)  NOT NULL,
  created_at          DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_receipt_version (receipt_id, receipt_version),
  FOREIGN KEY (interaction_id) REFERENCES commercial_interaction(id)
);

-- Agregado de respuesta: identidad estable
CREATE TABLE mep_response (
  id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  interaction_id      BIGINT UNSIGNED NOT NULL,
  response_id         VARCHAR(128) NOT NULL,
  current_version     INT UNSIGNED NOT NULL,
  etag                VARCHAR(96)  NOT NULL,
  created_at          DATETIME(3)  NOT NULL,
  updated_at          DATETIME(3)  NOT NULL,
  UNIQUE KEY uq_response (interaction_id, response_id),
  UNIQUE KEY uq_response_id (response_id),
  FOREIGN KEY (interaction_id) REFERENCES commercial_interaction(id)
);

-- Cada versión es inmutable (append-only)
CREATE TABLE mep_response_version (
  id                        BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  mep_response_id           BIGINT UNSIGNED NOT NULL,
  response_version          INT UNSIGNED NOT NULL,
  business_milestone        ENUM('INTERACTION_RECEIVED','ENGINEER_ASSIGNED',
                                 'ROUTE_CAPACITY_REGISTERED','INTERACTION_COMPLETED') NOT NULL,
  response_status           ENUM('RECEIVED','IN_PROGRESS','COMPLETED') NOT NULL,
  eta_date                  DATE NULL,
  next_milestone            VARCHAR(512) NULL,
  responded_at              DATETIME(3) NOT NULL,
  responded_by_ref          VARCHAR(64)  NOT NULL,
  responded_by_name         VARCHAR(256) NOT NULL,
  assignment_engineer_ref   VARCHAR(64)  NULL,
  assignment_engineer_name  VARCHAR(256) NULL,
  assignment_assigned_at    DATETIME(3)  NULL,
  rc_version                VARCHAR(8)   NULL,        -- V1/Vx, reloj independiente
  rc_route_status           ENUM('VIABLE','NOT_VIABLE','CONDITIONED') NULL,
  rc_capacity_status        ENUM('PLANNED','NOT_PLANNED','CONDITIONED') NULL,
  rc_summary                TEXT NULL,
  rc_registered_at          DATETIME(3) NULL,
  rc_registered_by_ref      VARCHAR(64) NULL,
  rc_registered_by_name     VARCHAR(256) NULL,
  planner_interaction_url   VARCHAR(1024) NULL,
  route_capacity_register_url VARCHAR(1024) NULL,
  narrative_note            TEXT NULL,                -- SOLO el texto de esta versión
  delivered_interaction_type VARCHAR(128) NULL,       -- NULL antes del cierre
  semantic_fingerprint      CHAR(64) NOT NULL,        -- opaco, técnico
  payload_hash              CHAR(64) NOT NULL,
  etag                      VARCHAR(96) NOT NULL,
  created_at                DATETIME(3) NOT NULL,
  UNIQUE KEY uq_version (mep_response_id, response_version),
  FOREIGN KEY (mep_response_id) REFERENCES mep_response(id)
);

CREATE TABLE mep_service_result (
  id                     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  response_version_id    BIGINT UNSIGNED NOT NULL,
  service                ENUM('TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
  status                 ENUM('RECEIVED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL,
  outcome                ENUM('VIABLE','NOT_VIABLE','PARTIAL') NULL,
  dependency             ENUM('NONE','TECHNICAL_DESIGN','FINANCIAL_DESIGN') NOT NULL,
  summary                TEXT NULL,
  reason_code            VARCHAR(64) NULL,
  position               TINYINT UNSIGNED NOT NULL,
  UNIQUE KEY uq_srv (response_version_id, service),
  FOREIGN KEY (response_version_id) REFERENCES mep_response_version(id)
);

CREATE TABLE mep_deliverable (
  id                     BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  service_result_id      BIGINT UNSIGNED NOT NULL,
  url                    VARCHAR(1024) NOT NULL,      -- SharePoint Documents
  label                  VARCHAR(256) NULL,
  published_at           DATETIME(3) NULL,
  FOREIGN KEY (service_result_id) REFERENCES mep_service_result(id)
);
```

**Reglas de persistencia**

- `mep_response_version` y `processing_receipt` son **append-only**: sin `UPDATE`, sin `DELETE`. Se aplica por permisos de BD del usuario de la aplicación, no solo por código.
- `commercial_interaction.source_content` no se actualiza por ninguna ruta de esta integración (trigger `BEFORE UPDATE` que aborta si cambia).
- El `ETag` se calcula como `"{recurso}-{version}"` o `W/"sha256(payload_canónico)"` truncado; es estable y determinista.

---

## 9. Idempotencia y concurrencia

### 9.1 Idempotencia (`Idempotency-Key`)

```sql
CREATE TABLE idempotency_record (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  api_key_id      BIGINT UNSIGNED NOT NULL,
  method          VARCHAR(8)   NOT NULL,
  path            VARCHAR(512) NOT NULL,
  idempotency_key VARCHAR(256) NOT NULL,
  request_hash    CHAR(64)     NOT NULL,   -- sha256 del body canonicalizado (JCS RFC 8785)
  status          ENUM('IN_FLIGHT','COMPLETED') NOT NULL,
  response_status INT UNSIGNED NULL,
  response_body   MEDIUMTEXT   NULL,
  response_etag   VARCHAR(96)  NULL,
  created_at      DATETIME(3)  NOT NULL,
  expires_at      DATETIME(3)  NOT NULL,   -- retención 7 días
  UNIQUE KEY uq_idem (api_key_id, method, path, idempotency_key)
);
```

**Algoritmo (`INV-28`)**

1. Validar `Idempotency-Key` (8–256 chars, `^[A-Za-z0-9._:-]{8,256}$`); si falta o es inválido → `400`.
2. `request_hash = sha256(JCS(body))`.
3. `INSERT … ON DUPLICATE KEY` para reservar el key en estado `IN_FLIGHT`.
   - Si ya existe con `request_hash` **distinto** → **`409`** (`IDEMPOTENCY_KEY_REUSE`).
   - Si ya existe con `request_hash` **igual** y `status = COMPLETED` → **replay**: se devuelve el `response_status`, `response_body` y `ETag` guardados, **sin efectos secundarios y sin avanzar `response_version`**.
   - Si ya existe con `request_hash` igual y `status = IN_FLIGHT` → **`409`** (`REQUEST_IN_FLIGHT`) o `425`; el cliente reintenta.
4. Ejecutar la operación dentro de la **misma transacción** que persiste el `idempotency_record` en `COMPLETED`.
5. Retención: **7 días**; job de purga diario.

> `INV-29`: **un retry no incrementa `response_version`.** Es la consecuencia directa de que el replay no ejecute la lógica de negocio.

### 9.2 Concurrencia optimista (`If-Match` / ETag)

- Si `If-Match` está presente y no coincide con el `ETag` actual del recurso → **`412`**, sin mutación.
- Si el usuario comercial editó el recurso en el CRM entre el `GET` y el `PUT` de MEP, la **edición humana se conserva**: el `412` obliga a MEP a releer (`GET`) y reconciliar antes de reintentar.
- Nivel de aislamiento: `READ COMMITTED` + `SELECT … FOR UPDATE` sobre `mep_response` al publicar una versión.
- Colisión de versión: `UNIQUE (mep_response_id, response_version)` → si dos writes compiten por la misma versión, uno gana y el otro obtiene `409` si el contenido difiere, o `200` replay si es idéntico.

### 9.3 Tabla de decisión `PUT /responses/{response_id}`

| Idempotency-Key | Payload | `(response_id, version)` existente | Resultado |
|---|---|---|---|
| nuevo | válido | no existe | `200` + nueva versión persistida |
| repetido | **idéntico** | existe | `200` replay, sin efectos, versión **no** avanza |
| repetido | **distinto** | — | `409 IDEMPOTENCY_KEY_REUSE` |
| nuevo | distinto | existe misma versión | `409 VERSION_CONTENT_CONFLICT` |
| nuevo | válido | `version` ≤ `current_version` | `422 NON_MONOTONIC_VERSION` |
| nuevo | válido, `If-Match` viejo | — | `412 PRECONDITION_FAILED` |
| nuevo | dependencia invertida | — | `422 INVERTED_SERVICE_DEPENDENCY` |
| nuevo | `delivered_interaction_type` ≠ null y hito ≠ `INTERACTION_COMPLETED` | — | `422 PREMATURE_CLASSIFICATION` |

---
## 10. Seguridad

### 10.1 Autenticación — `X-API-Key`

| Aspecto | Regla |
|---|---|
| Transporte | Exclusivamente header `X-API-Key` sobre **HTTPS**. Nunca en query string, path, body ni cookie. |
| Naturaleza | **Service account no humano.** Sin usuario nominal, sin contraseña, sin sesión. |
| Aislamiento | **Clave distinta por ambiente** (sandbox / staging / producción). Una clave de sandbox nunca es válida en producción. |
| Almacenamiento | En BD solo el **hash** (`argon2id` o `sha256` con pepper). El valor claro existe una sola vez, en el momento de emisión. **Fuera de payloads, logs y Git.** |
| Formato | `mep_{env}_{random_32}`; prefijo visible de 12 chars (`key_prefix`) para identificar en logs sin exponer la clave. |
| Rotación | Soporte de **dos claves activas simultáneas** por identidad, con ventana de solapamiento configurable (default 30 días). |
| Revocación | Inmediata: `revoked_at` en BD + invalidación de cache (TTL ≤ 60 s). |
| Expiración | `expires_at` obligatorio; alerta a 30/15/7 días. |

```sql
CREATE TABLE api_key (
  id           BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  identity     VARCHAR(64)  NOT NULL,      -- 'mep-lean'
  environment  ENUM('sandbox','staging','production') NOT NULL,
  key_prefix   CHAR(12)     NOT NULL,
  key_hash     VARCHAR(255) NOT NULL,
  scopes       JSON         NOT NULL,
  rate_tier    VARCHAR(32)  NOT NULL DEFAULT 'default',
  created_at   DATETIME(3)  NOT NULL,
  expires_at   DATETIME(3)  NOT NULL,
  revoked_at   DATETIME(3)  NULL,
  last_used_at DATETIME(3)  NULL,
  UNIQUE KEY uq_prefix (key_prefix)
);
```

### 10.2 Autorización — scopes por operación (`401` vs `403`)

| Operación | Scope requerido |
|---|---|
| `GET /v1/commercial-interactions` | `interactions:read` |
| `GET /v1/commercial-interactions/{ref}` | `interactions:read` |
| `GET /v1/commercial-opportunities/{ref}` | `opportunities:read` |
| `POST .../processing-receipts` | `receipts:write` |
| `PUT .../responses/{id}` | `responses:write` |
| `GET .../responses/{id}` | `responses:read` |

- Clave **ausente, malformada, desconocida, revocada o expirada** → **`401`**, cuerpo genérico (sin distinguir cuál de los casos).
- Clave **válida** sin el scope requerido → **`403`**, `code = INSUFFICIENT_SCOPE`.
- Comparación de clave en **tiempo constante**; sin logs del valor.
- La identidad MEP **no** tiene ningún scope de escritura sobre el modelo comercial del CRM (`P-01`).

### 10.3 Endurecimiento

- HSTS `max-age=31536000; includeSubDomains`.
- `helmet` + `Content-Type: application/json` estricto (`415` si difiere).
- Body máximo **256 KB** por request (`413`).
- Timeout de request 30 s.
- Validación estricta con `class-validator` + `whitelist: true` + `forbidNonWhitelisted: true` (esto materializa `INV-25`).
- Sin CORS abierto: la API es servidor-a-servidor.
- Allowlist de IP/mTLS opcional por ambiente (`OPEN-04`).

---

## 11. Rate limiting

### 11.1 Cuotas

Token bucket en **Redis** (`INCR` + `EXPIRE` con script Lua atómico), dimensionado **por `api_key_id` × clase de operación**.

| Clase | Operaciones | Límite sostenido | Burst |
|---|---|---|---|
| `read-list` | `GET /commercial-interactions` | 60 req/min | 20 |
| `read-item` | `GET .../{ref}`, `GET /commercial-opportunities/{ref}`, `GET .../responses/{id}` | 300 req/min | 100 |
| `write` | `POST .../processing-receipts`, `PUT .../responses/{id}` | 120 req/min | 40 |
| Global por key | todas | 600 req/min | 200 |
| Concurrencia | todas | 20 in-flight simultáneas por key |

Los valores son **configurables por ambiente** y por `rate_tier` de la key. Sandbox usa 1/4 de los límites de producción.

### 11.2 Headers de respuesta

En **toda** respuesta (2xx y 4xx), draft IETF `ratelimit-headers`:

```
RateLimit-Limit: 120
RateLimit-Remaining: 87
RateLimit-Reset: 34
RateLimit-Policy: 120;w=60
```

Al agotarse la cuota → **`429 Too Many Requests`** con **`Retry-After: <segundos>`** obligatorio:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 34
RateLimit-Remaining: 0
Content-Type: application/problem+json

{
  "type": "https://api.frisson.crm/problems/rate-limit",
  "title": "Cuota temporal excedida",
  "status": 429,
  "detail": "Límite de 120 req/min para la clase 'write'. Reintente en 34 s.",
  "code": "RATE_LIMIT_EXCEEDED",
  "correlation_id": "corr_01JCRM20004"
}
```

### 11.3 Reglas

- `INV-30`: un `429` **nunca** consume idempotencia ni avanza `response_version`; el reintento con el mismo `Idempotency-Key` y payload debe producir el mismo resultado que si el `429` no hubiera ocurrido.
- El contador se decrementa **antes** de ejecutar la lógica de negocio; un `429` no toca la BD.
- **Degradación**: si Redis no está disponible, el limitador entra en modo *fail-open* con límite local en memoria por instancia y emite alerta `rate_limiter_degraded`.
- `503` transitorio del CRM también incluye `Retry-After`.
- Backoff recomendado para MEP (documentado, no impuesto): exponencial con jitter, base 1 s, máx 60 s, respetando siempre `Retry-After`.

---

## 12. Auditoría

### 12.1 Principio

`P-06`: **no existe mutación ni lectura sensible sin registro.** El `audit_log` es **append-only, inmutable y encadenado**.

```sql
CREATE TABLE audit_log (
  id                BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  occurred_at       DATETIME(3)  NOT NULL,
  correlation_id    VARCHAR(128) NOT NULL,
  request_id        VARCHAR(64)  NOT NULL,
  actor_type        ENUM('SERVICE','USER','SYSTEM') NOT NULL,
  actor_identity    VARCHAR(64)  NOT NULL,        -- 'mep-lean'
  api_key_prefix    CHAR(12)     NULL,            -- NUNCA la clave
  source_ip         VARCHAR(45)  NULL,
  http_method       VARCHAR(8)   NOT NULL,
  http_path         VARCHAR(512) NOT NULL,
  http_status       INT UNSIGNED NOT NULL,
  operation         VARCHAR(64)  NOT NULL,        -- 'response.publish', 'receipt.create', …
  resource_type     VARCHAR(64)  NOT NULL,        -- 'mep_response_version'
  resource_ref      VARCHAR(128) NOT NULL,        -- 'mep:int_20004:response#3'
  interaction_ref   VARCHAR(64)  NULL,
  opportunity_ref   VARCHAR(64)  NULL,
  idempotency_key   VARCHAR(256) NULL,
  idempotent_replay TINYINT(1)   NOT NULL DEFAULT 0,
  if_match          VARCHAR(96)  NULL,
  outcome           ENUM('SUCCESS','REJECTED','ERROR') NOT NULL,
  error_code        VARCHAR(64)  NULL,
  request_hash      CHAR(64)     NULL,            -- sha256 del payload canónico
  before_state      JSON         NULL,            -- redactado
  after_state       JSON         NULL,            -- redactado
  latency_ms        INT UNSIGNED NOT NULL,
  adapter_version   VARCHAR(32)  NULL,
  prev_hash         CHAR(64)     NULL,            -- encadenamiento
  entry_hash        CHAR(64)     NOT NULL,        -- sha256(prev_hash || campos canónicos)
  KEY ix_corr (correlation_id),
  KEY ix_res (resource_type, resource_ref, occurred_at),
  KEY ix_interaction (interaction_ref, occurred_at),
  KEY ix_time (occurred_at)
);
```

### 12.2 Qué se audita

| Evento | `operation` | Nivel |
|---|---|---|
| Publicación de respuesta (nueva versión) | `response.publish` | **Obligatorio**, con `before_state`/`after_state` |
| Replay idempotente de respuesta | `response.replay` | Obligatorio, `idempotent_replay = 1`, sin cambio de estado |
| Creación de acuse técnico | `receipt.create` | Obligatorio |
| Rechazo semántico (`422`) | `response.reject` / `receipt.reject` | Obligatorio, con `error_code` |
| Conflicto (`409`) / precondición (`412`) | `*.conflict` / `*.precondition_failed` | Obligatorio |
| Fallo de autenticación (`401`) / autorización (`403`) | `auth.failure` | Obligatorio |
| Rate limit (`429`) | `ratelimit.block` | Obligatorio (agregado por minuto si hay ráfaga) |
| Página de intake entregada | `intake.poll` | Obligatorio (sin `items`, solo `count`, `cursor_in`, `next_cursor`, `high_watermark`) |
| Lectura de OUV | `opportunity.read` | Obligatorio |
| Rotación / revocación de API key | `apikey.rotate` / `apikey.revoke` | Obligatorio |

### 12.3 Reglas de auditoría

- `INV-31`: el `audit_log` **nunca** almacena el valor de `X-API-Key` ni `source_content` completo. `before_state`/`after_state` se **redactan**: `source_content` → `{"sha256": "...", "length": 1234}`.
- `INV-32`: la escritura de auditoría ocurre en la **misma transacción** que la mutación. Si la auditoría falla, la mutación se revierte (`503`).
- `INV-33`: `audit_log` es append-only — el usuario de aplicación tiene `INSERT` y `SELECT`, **no** `UPDATE` ni `DELETE`.
- `INV-34`: `entry_hash` encadena con `prev_hash`; un job diario verifica la cadena y alerta ante cualquier rotura (`audit_chain_broken`).
- **Retención:** 24 meses en caliente, 7 años en almacenamiento frío (export mensual firmado a objeto inmutable / WORM).
- **Consulta:** endpoint interno `GET /internal/audit?interaction_ref=…&from=…&to=…` (solo scope `audit:read`, **no** expuesto a MEP), paginado, y export CSV/JSONL firmado.
- **Reconstrucción:** el histórico de `mep_response_version` + `audit_log` permite reconstruir el estado de cualquier interacción en cualquier instante.

---

## 13. Observabilidad

### 13.1 Logging estructurado (JSON)

Campos obligatorios en cada línea: `timestamp`, `level`, `correlation_id`, `request_id`, `actor_identity`, `api_key_prefix`, `method`, `path`, `status`, `latency_ms`, `operation`, `error_code`.

**Redacción obligatoria (`INV-35`):** `x-api-key`, `authorization`, `source_content`, `narrative_note`, `summary`, nombres propios (`display_name`) → reemplazados por hash o `[REDACTED]` en logs de nivel `info`. Solo `debug` en sandbox puede incluir payload completo.

### 13.2 Tracing

OpenTelemetry. `X-Correlation-ID` del request se propaga como atributo `crm.correlation_id` y, si viene en formato W3C, como `traceparent`. Spans: `http.server` → `auth` → `ratelimit` → `validation` → `db.tx` → `audit`.

### 13.3 Métricas (Prometheus)

| Métrica | Tipo | Labels |
|---|---|---|
| `crm_http_requests_total` | counter | `operation`, `status`, `api_key_prefix` |
| `crm_http_duration_seconds` | histogram | `operation` |
| `crm_intake_page_items` | histogram | — |
| `crm_response_versions_published_total` | counter | `business_milestone` |
| `crm_idempotent_replays_total` | counter | `operation` |
| `crm_semantic_rejections_total` | counter | `error_code` |
| `crm_rate_limit_blocks_total` | counter | `class`, `api_key_prefix` |
| `crm_audit_write_failures_total` | counter | — |
| `crm_etag_conflicts_total` | counter | `operation` |

### 13.4 SLOs

| Indicador | Objetivo |
|---|---|
| Disponibilidad de las 6 operaciones | 99.5 % mensual |
| p95 `GET /commercial-interactions` (limit 50) | ≤ 400 ms |
| p95 `PUT .../responses/{id}` | ≤ 600 ms |
| Tasa de `5xx` | < 0.5 % |
| Pérdida de entradas de auditoría | **0** |

**Alertas:** `5xx` > 1 % por 5 min · `crm_audit_write_failures_total` > 0 · cadena de auditoría rota · `429` sostenido > 10 % de los writes · API key a < 15 días de expirar.

---

## 14. Plan de implementación (tareas)

### Fase 0 — Fundaciones

| ID | Tarea | DoD |
|---|---|---|
| `T-001` | Scaffold NestJS 11, config por ambiente, healthcheck `/healthz`, `/readyz` | Arranca en los 3 ambientes |
| `T-002` | OpenAPI 3.1 `openapi/crm-mep.yaml` con las 6 operaciones + JSON Schemas | Valida con `spectral`; CI falla si el código diverge |
| `T-003` | Migraciones Sequelize del §8 + permisos append-only en BD | `audit_log`/`*_version` rechazan `UPDATE`/`DELETE` |
| `T-004` | Guard `X-API-Key` + scopes + `401`/`403` | `T-004` cubierto por `TS-SEC-*` |
| `T-005` | Filtro global de errores RFC 7807 + catálogo `ERR-*` | Todo error sale como `problem+json` |
| `T-006` | Interceptor de auditoría transaccional | Ninguna mutación sin fila en `audit_log` |
| `T-007` | Rate limiter Redis + headers `RateLimit-*` / `Retry-After` | `TS-RL-*` en verde |
| `T-008` | Middleware de idempotencia (`INV-28`) | `TS-IDEM-*` en verde |
| `T-009` | ETag/If-Match/If-None-Match transversal | `304`/`412` correctos |

### Fase 1 — Lectura (Intake + Opportunity)

| ID | Tarea |
|---|---|
| `T-101` | `GET /v1/commercial-interactions` con cursor opaco firmado, orden total, `has_more`/`next_cursor`/`page_observed_at`/`high_watermark` |
| `T-102` | Filtro `service_horizon`, validación de `limit` 1–200, expiración de cursor 7 días |
| `T-103` | `GET /v1/commercial-interactions/{ref}` con ETag y `304` |
| `T-104` | `GET /v1/commercial-opportunities/{ref}` con nulos preservados y `commercial_archetype` |
| `T-105` | Serializador que garantiza `source_content` byte-a-byte y ausencia de `interaction_type` |

### Fase 2 — Escritura

| ID | Tarea |
|---|---|
| `T-201` | `POST .../processing-receipts`: persistencia, idempotencia, `201`/`200` replay, `reason_code` condicional |
| `T-202` | Separación estricta acuse técnico ↔ hito `INTERACTION_RECEIVED` (`INV-12`, `INV-13`) |
| `T-203` | `PUT .../responses/{response_id}`: agregado versionado, `service_results[]`, `route_capacity`, `operational_links` |
| `T-204` | Validador de máquina de hitos (`INV-16`) y de campos exigidos por hito (§7.1) |
| `T-205` | Validador de dependencias (`INV-01`) y de `delivered_interaction_type` (`INV-20`) |
| `T-206` | Validador de mappings prohibidos (§7.4) con `additionalProperties: false` + lista negra |
| `T-207` | Narrativa incremental: clave lógica `(crm_interaction_ref, response_id, response_version)` (`P-08`) |
| `T-208` | `GET .../responses/{response_id}` = representación persistida idéntica (`INV-15`), `?version=n` |
| `T-209` | Validación de `deliverables[]` como URL de SharePoint Documents (`INV-23`) |

### Fase 3 — Proyección CRM

| ID | Tarea |
|---|---|
| `T-301` | Derivación de campos CRM desde `service_results[]` (fuente de verdad) |
| `T-302` | UI: entradas MEP de más reciente a más antigua, `source_content` siempre visible |
| `T-303` | UI: diferenciación visual entre Planner, registro SharePoint List y SharePoint Documents |
| `T-304` | UI: pista técnica de acuses separada de la narrativa comercial (sin duplicar notas) |
| `T-305` | `commercial_archetype` de solo lectura, sin mapping inverso a `Archetype_Lane` |

### Fase 4 — Endurecimiento y entrega

| ID | Tarea |
|---|---|
| `T-401` | Plantillas HTTPS de navegación por ambiente (`{interaction_ref}`, `{opportunity_ref}`) |
| `T-402` | Rotación/revocación de API key + runbook |
| `T-403` | Export firmado de auditoría + verificador de cadena |
| `T-404` | Dashboards, alertas y SLOs |
| `T-405` | Sandbox con fixtures `response-v1`…`response-v5` y colección Postman/Bruno para MEP |

---
## 15. Estrategia de pruebas

### 15.1 Pirámide y umbrales

| Nivel | Herramienta | Alcance | Umbral |
|---|---|---|---|
| Unitarias | Jest | Validadores, máquina de hitos, canonicalización, cursor, ETag | Cobertura ≥ 90 % en `domain/` y `validation/` |
| Contrato | Jest + `@stoplight/spectral` + Dredd/Prism contra `openapi/crm-mep.yaml` | Request/response de las 6 operaciones vs. schema | 100 % de operaciones y de códigos del §5.3 |
| Integración | Jest + Testcontainers (MySQL 8 + Redis) | Persistencia, transacciones, idempotencia, auditoría | Todos los `INV-xx` |
| E2E / secuencia | Supertest sobre app real + fixtures | Ciclo completo V1→V5 de una interacción | 100 % de `AC-xx` |
| Carga | k6 | Rate limit, p95, concurrencia | SLOs del §13.4 |
| Seguridad | ZAP baseline + tests propios | `401`/`403`, redacción, headers | Sin hallazgos altos |

**Regla `INV-36`:** ningún `INV-xx` de este spec se considera implementado sin al menos un test automatizado que lo referencie por ID en su nombre.

### 15.2 Fixtures obligatorios

```
test/fixtures/
├── intake/
│   ├── page-single-item.json          # C-4 (§7.6), ejemplo del brief
│   ├── page-multi-with-cursor.json    # has_more=true + next_cursor
│   ├── page-empty.json                # items=[], high_watermark=null
│   ├── services-c1-technical-only.json
│   ├── services-c2-financial-direct.json
│   ├── services-c3-parallel-independent.json
│   ├── services-c4-financial-depends-technical.json
│   └── services-cneg-inverted-dependency.json   # → 422
├── opportunity/
│   ├── ouv-9101-full.json             # ejemplo del brief
│   └── ouv-9102-nulls.json            # todos los opcionales en null
├── receipts/
│   ├── receipt-accepted.json          # ejemplo del brief
│   ├── receipt-duplicate.json
│   ├── receipt-quarantined.json       # con reason_code
│   └── receipt-rejected-no-reason.json # → 422
└── responses/
    ├── response-v1.json  # INTERACTION_RECEIVED
    ├── response-v2.json  # ENGINEER_ASSIGNED
    ├── response-v3.json  # ROUTE_CAPACITY_REGISTERED, route_capacity V1  (ejemplo del brief)
    ├── response-v4.json  # ROUTE_CAPACITY_REGISTERED, route_capacity V2
    └── response-v5.json  # INTERACTION_COMPLETED, route_capacity SIGUE en V2
```

### 15.3 Secuencia completa de versiones — `int_20004` (V1 → V5)

Es el caso maestro de aceptación. Un único `response_id = "mep:int_20004:response"` en los cinco.

| Fixture | `response_version` | `business_milestone` | `response_status` | `route_capacity.version` | Exige |
|---|---|---|---|---|---|
| `response-v1` | 1 | `INTERACTION_RECEIVED` | `RECEIVED` | `null` | — |
| `response-v2` | 2 | `ENGINEER_ASSIGNED` | `IN_PROGRESS` | `null` | `assignment`, `planner_interaction_url` |
| `response-v3` | 3 | `ROUTE_CAPACITY_REGISTERED` | `IN_PROGRESS` | `V1` | `route_capacity`, `eta_date`, `assignment`, `route_capacity_register_url` |
| `response-v4` | 4 | `ROUTE_CAPACITY_REGISTERED` | `IN_PROGRESS` | `V2` | replanificación de ruta/capacidad |
| `response-v5` | 5 | `INTERACTION_COMPLETED` | `COMPLETED` | **`V2`** (no avanza) | `service_results` completos con `deliverables`, `delivered_interaction_type` ≠ null |

**`response-v1.json`**

```json
{
  "response_id": "mep:int_20004:response",
  "response_version": 1,
  "business_milestone": "INTERACTION_RECEIVED",
  "response_status": "RECEIVED",
  "eta_date": null,
  "next_milestone": "Asignar ingeniero de preventa",
  "responded_at": "2026-08-21T14:38:00Z",
  "responded_by": { "ref": "mep_system", "display_name": "MEP-LEAN" },
  "assignment": null,
  "route_capacity": null,
  "service_results": [
    { "service": "TECHNICAL_DESIGN", "status": "RECEIVED", "outcome": null, "dependency": "NONE", "summary": "Recibido en la fábrica de preventa.", "reason_code": null, "deliverables": [] },
    { "service": "FINANCIAL_DESIGN", "status": "RECEIVED", "outcome": null, "dependency": "TECHNICAL_DESIGN", "summary": "Pendiente del resultado técnico.", "reason_code": null, "deliverables": [] }
  ],
  "operational_links": {},
  "narrative_note": "La interacción fue recibida por MEP-LEAN.",
  "delivered_interaction_type": null,
  "semantic_fingerprint": "1111111111111111111111111111111111111111111111111111111111111111"
}
```

**`response-v5.json`** (cierre; `route_capacity` permanece en `V2`)

```json
{
  "response_id": "mep:int_20004:response",
  "response_version": 5,
  "business_milestone": "INTERACTION_COMPLETED",
  "response_status": "COMPLETED",
  "eta_date": "2026-08-28",
  "next_milestone": null,
  "responded_at": "2026-08-28T18:10:00Z",
  "responded_by": { "ref": "engineer_15", "display_name": "Ingeniero Preventa" },
  "assignment": {
    "engineer": { "ref": "engineer_15", "display_name": "Ingeniero Preventa" },
    "assigned_at": "2026-08-21T14:59:30Z"
  },
  "route_capacity": {
    "version": "V2",
    "route_status": "VIABLE",
    "capacity_status": "PLANNED",
    "summary": "Ruta y capacidad replanificadas en V2.",
    "registered_at": "2026-08-25T11:20:00Z",
    "registered_by": { "ref": "engineer_15", "display_name": "Ingeniero Preventa" }
  },
  "service_results": [
    {
      "service": "TECHNICAL_DESIGN", "status": "COMPLETED", "outcome": "VIABLE", "dependency": "NONE",
      "summary": "Diseño técnico entregado.", "reason_code": null,
      "deliverables": [
        { "url": "https://verytel.sharepoint.com/sites/preventa/Shared%20Documents/int_20004/diseno-tecnico.pdf", "label": "Diseño técnico", "published_at": "2026-08-27T16:00:00Z" }
      ]
    },
    {
      "service": "FINANCIAL_DESIGN", "status": "COMPLETED", "outcome": "VIABLE", "dependency": "TECHNICAL_DESIGN",
      "summary": "Modelo financiero entregado.", "reason_code": null,
      "deliverables": [
        { "url": "https://verytel.sharepoint.com/sites/preventa/Shared%20Documents/int_20004/modelo-financiero.xlsx", "label": "Modelo financiero", "published_at": "2026-08-28T17:40:00Z" }
      ]
    }
  ],
  "operational_links": {
    "planner_interaction_url": "https://tasks.office.com/verytel/Home/Task/task-20004",
    "route_capacity_register_url": "https://verytel.sharepoint.com/sites/preventa/Lists/Commitments/DispForm.aspx?ID=20004"
  },
  "narrative_note": "Diseño técnico y financiero entregados; interacción cerrada.",
  "delivered_interaction_type": "DISENO_TECNICO_Y_FINANCIERO",
  "semantic_fingerprint": "5555555555555555555555555555555555555555555555555555555555555555"
}
```

### 15.4 Casos de prueba

#### Polling y lectura — `TS-INT-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-INT-01` | Página con `limit=1` sobre 3 elegibles | `items.length = 1`, `has_more = true`, `next_cursor ≠ null` |
| `TS-INT-02` | Recorrido completo paginado | Los 3 ítems exactamente una vez, sin repetir el último (cursor exclusivo) |
| `TS-INT-03` | Releer la misma página con el mismo cursor | Respuesta idéntica byte a byte (`INV-05`) |
| `TS-INT-04` | Insertar 50 interacciones concurrentes durante la paginación | Orden total repetible, sin saltos ni duplicados (`INV-03`) |
| `TS-INT-05` | Página vacía | `items = []`, `has_more = false`, `next_cursor = null`, `high_watermark = null` |
| `TS-INT-06` | Cursor manipulado / firma inválida | `400 INVALID_CURSOR` |
| `TS-INT-07` | Cursor de 8 días | `400 CURSOR_EXPIRED` |
| `TS-INT-08` | `limit=0` y `limit=201` | `400` |
| `TS-INT-09` | `service_horizon=DEFERRED` | Solo diferidas |
| `TS-INT-10` | `high_watermark` = mayor `source_created_at` de la página | Igualdad exacta |
| `TS-INT-11` | `source_content` con emojis, saltos de línea, comillas y ` ` escapado | Devuelto byte a byte (`INV-07`) |
| `TS-INT-12` | Ningún campo `interaction_type` en la respuesta | Ausente en el 100 % de los ítems (`INV-06`) |
| `TS-INT-13` | Relectura por identidad + `If-None-Match` | `304` sin cuerpo |
| `TS-INT-14` | `ETag` del cuerpo vs header | Idénticos (`INV-08`) |
| `TS-INT-15` | `interaction_ref` inexistente | `404` |

#### Oportunidad — `TS-OUV-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-OUV-01` | OUV completa (`ouv_9101`) | Response idéntica al fixture del brief |
| `TS-OUV-02` | OUV con opcionales vacíos | Todas las claves presentes con `null`, ninguna omitida (`INV-09`) |
| `TS-OUV-03` | `commercial_archetype` null | `null`, no `{}` ni `""` (`INV-10`) |
| `TS-OUV-04` | Intento de escribir `commercial_archetype` vía cualquier endpoint | No existe la operación → `404`/`405` (`INV-11`) |
| `TS-OUV-05` | `commercial_value.amount` entero grande (125000000) | Sin pérdida de precisión, sin notación científica |
| `TS-OUV-06` | `If-None-Match` con ETag vigente | `304` |

#### Servicios y hitos — `TS-SVC-*` / `TS-MIL-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-SVC-01` | `C-1` sólo técnico | `200` |
| `TS-SVC-02` | `C-2` financiero directo sin fase técnica | `200` |
| `TS-SVC-03` | `C-3` técnico y financiero simultáneos independientes | `200` |
| `TS-SVC-04` | `C-4` técnico seguido de financiero dependiente | `200` |
| `TS-SVC-05` | `C-NEG` técnico con `dependency = FINANCIAL_DESIGN` | **`422 INVERTED_SERVICE_DEPENDENCY`** (`INV-01`) |
| `TS-SVC-06` | `service_results[]` con `TECHNICAL_DESIGN` duplicado | `422` |
| `TS-SVC-07` | `outcome ≠ null` con `status = RECEIVED` | `422` |
| `TS-SVC-08` | `outcome = NOT_VIABLE` sin `reason_code` | `422` |
| `TS-SVC-09` | `deliverables[].url` apuntando a SharePoint **List** | `422 DELIVERABLE_NOT_A_DOCUMENT` (`INV-23`) |
| `TS-MIL-01` | `INTERACTION_RECEIVED` con `response_status ≠ RECEIVED` | `422` |
| `TS-MIL-02` | `ENGINEER_ASSIGNED` sin `assignment` | `422` |
| `TS-MIL-03` | `ENGINEER_ASSIGNED` sin `planner_interaction_url` | `422` |
| `TS-MIL-04` | `ROUTE_CAPACITY_REGISTERED` sin `eta_date` | `422` |
| `TS-MIL-05` | `ROUTE_CAPACITY_REGISTERED` sin `route_capacity_register_url` | `422` |
| `TS-MIL-06` | `INTERACTION_COMPLETED` con un servicio sin `deliverables` | `422` |
| `TS-MIL-07` | Retroceso `ROUTE_CAPACITY_REGISTERED` → `ENGINEER_ASSIGNED` | `422 MILESTONE_REGRESSION` (`INV-16`) |
| `TS-MIL-08` | Publicación después de `INTERACTION_COMPLETED` | `422 INTERACTION_ALREADY_COMPLETED` |
| `TS-MIL-09` | Dos `eta_date` distintos por servicio | Imposible por schema: `eta_date` es global y único |

#### Versionado y narrativa — `TS-VER-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-VER-01` | Secuencia V1→V5 completa | 5 versiones persistidas, mismo `response_id` (`INV-26`) |
| `TS-VER-02` | `route_capacity.version` en V5 sigue en `V2` | Aceptado; relojes independientes (`INV-17`) |
| `TS-VER-03` | `response_version = 3` cuando la actual es 4 | `422 NON_MONOTONIC_VERSION` |
| `TS-VER-04` | `response_version` saltando de 2 a 7 | Aceptado (monotónico estricto, no consecutivo) o `422` según `OPEN-02` |
| `TS-VER-05` | `response_id` del body ≠ el de la ruta | `422 RESPONSE_ID_MISMATCH` |
| `TS-VER-06` | `response_id` distinto en el mismo `interaction_ref` | `422 RESPONSE_ID_NOT_STABLE` (`INV-26`) |
| `TS-VER-07` | `narrative_note` de V3 no contiene el texto de V1/V2 | Solo texto de esa versión (`P-08`) |
| `TS-VER-08` | Listado de narrativa en UI | Orden descendente por `response_version`, `source_content` visible |
| `TS-VER-09` | Retry idéntico de V3 | `200` replay, `current_version` sigue en 3 (`INV-29`) |
| `TS-VER-10` | `response_version` derivado de `delivery_attempt` o ETag de SharePoint | Bloqueado por schema (`INV-27`) |

#### Clasificación — `TS-CLS-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-CLS-01` | `delivered_interaction_type` en V1..V4 | Debe ser `null`; si no, `422 PREMATURE_CLASSIFICATION` (`INV-20`) |
| `TS-CLS-02` | `delivered_interaction_type = "TIPO-POR-ESPECIFICAR"` en `INTERACTION_COMPLETED` | `422 PROVISIONAL_CLASSIFICATION` |
| `TS-CLS-03` | `INTERACTION_COMPLETED` con `delivered_interaction_type = null` | `422 MISSING_CLASSIFICATION` |
| `TS-CLS-04` | Clasificación inferida desde `requested_services[]` | No existe tal derivación en el código (test de arquitectura + revisión) (`INV-19`) |

#### Acuse técnico — `TS-RCP-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-RCP-01` | `POST` acuse `ACCEPTED` nuevo | `201`, body = representación persistida, `Location` presente |
| `TS-RCP-02` | Repetición con mismo `Idempotency-Key` y payload | `200` replay, sin nueva fila |
| `TS-RCP-03` | `QUARANTINED` sin `reason_code` | `422` |
| `TS-RCP-04` | Acuse no cambia estado comercial ni crea nota comercial | `commercial_interaction` sin cambios; UI no duplica (`INV-12`, `INV-13`) |
| `TS-RCP-05` | Acuse `ACCEPTED` seguido de `INTERACTION_RECEIVED` | Dos hechos distintos, dos representaciones distintas, sin duplicación de nota |
| `TS-RCP-06` | Acuse sobre `interaction_ref` inexistente | `404` |
| `TS-RCP-07` | `receipt_version` no monotónico | `422` |

#### Idempotencia y concurrencia — `TS-IDEM-*` / `TS-CONC-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-IDEM-01` | Mismo key, mismo payload, 10 veces en paralelo | Una sola persistencia, 10 respuestas idénticas |
| `TS-IDEM-02` | Mismo key, payload distinto | `409 IDEMPOTENCY_KEY_REUSE` |
| `TS-IDEM-03` | Key de 7 chars / 257 chars | `400` |
| `TS-IDEM-04` | Falta `Idempotency-Key` en un write | `400` |
| `TS-IDEM-05` | Falta `X-Correlation-ID` en un write | `400` |
| `TS-IDEM-06` | Reordenamiento de claves JSON en el payload | Mismo `request_hash` (canonicalización JCS) → replay, no `409` |
| `TS-IDEM-07` | Contenido distinto con el mismo `(response_id, response_version)` | `409 VERSION_CONTENT_CONFLICT` |
| `TS-CONC-01` | `PUT` con `If-Match` obsoleto | `412`, sin mutación |
| `TS-CONC-02` | Edición humana en el CRM entre `GET` y `PUT` de MEP | Tras `412`, relectura y reconciliación: **la edición humana se conserva** |
| `TS-CONC-03` | Dos `PUT` concurrentes con la misma versión y payload distinto | Uno `200`, otro `409`; nunca dos filas |
| `TS-CONC-04` | `GET` post-write | Representación **idéntica** a la respuesta del `PUT` (`INV-15`) |

#### Seguridad — `TS-SEC-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-SEC-01` | Sin `X-API-Key` | `401` |
| `TS-SEC-02` | Key inválida / desconocida | `401` genérico (sin revelar la causa) |
| `TS-SEC-03` | Key revocada | `401` dentro de ≤ 60 s de la revocación |
| `TS-SEC-04` | Key expirada | `401` |
| `TS-SEC-05` | Key de sandbox contra producción | `401` |
| `TS-SEC-06` | Key válida sin scope `responses:write` | `403 INSUFFICIENT_SCOPE` |
| `TS-SEC-07` | Key en query string en lugar del header | `401` |
| `TS-SEC-08` | HTTP plano | Rechazado / redirigido a HTTPS |
| `TS-SEC-09` | Grep de logs y de respuestas de error tras la suite completa | Cero apariciones del valor de la key y de `source_content` (`INV-31`, `INV-35`) |
| `TS-SEC-10` | Rotación con dos claves activas | Ambas funcionan durante la ventana; la vieja falla al cerrarse |
| `TS-SEC-11` | Body de 300 KB | `413` |
| `TS-SEC-12` | `Content-Type: text/plain` | `415` |

#### Rate limiting — `TS-RL-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-RL-01` | 121 writes en 60 s | El 121 devuelve `429` con `Retry-After` |
| `TS-RL-02` | Headers `RateLimit-*` presentes | En 2xx y en 4xx |
| `TS-RL-03` | `Retry-After` respetado | Tras esperar, la siguiente petición pasa |
| `TS-RL-04` | `429` seguido de retry con el mismo `Idempotency-Key` | Resultado idéntico al escenario sin `429`; `response_version` no salta (`INV-30`) |
| `TS-RL-05` | `429` no escribe en la BD de negocio | Cero filas nuevas; sí una entrada de auditoría `ratelimit.block` |
| `TS-RL-06` | Cuotas independientes por clase | Agotar `read-list` no bloquea `write` |
| `TS-RL-07` | Dos API keys distintas | Cuotas aisladas |
| `TS-RL-08` | Redis caído | Fail-open con límite local + alerta, sin `5xx` masivos |
| `TS-RL-09` | k6: 200 req/s durante 5 min | p95 dentro del SLO, `5xx` < 0.5 % |

#### Auditoría — `TS-AUD-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-AUD-01` | Cada `PUT` exitoso | Una fila `response.publish` con `before_state`/`after_state` |
| `TS-AUD-02` | Replay idempotente | Fila con `idempotent_replay = 1` y sin cambio de estado |
| `TS-AUD-03` | `422`, `409`, `412`, `401`, `403`, `429` | Una fila cada uno con `error_code` |
| `TS-AUD-04` | `UPDATE`/`DELETE` sobre `audit_log` con el usuario de la app | Error de permisos (`INV-33`) |
| `TS-AUD-05` | Fallo simulado de escritura de auditoría | La mutación **se revierte**; respuesta `503` (`INV-32`) |
| `TS-AUD-06` | Contenido de `before_state`/`after_state` | `source_content` redactado a `{sha256, length}` (`INV-31`) |
| `TS-AUD-07` | Verificador de cadena tras 1 000 entradas | Cadena íntegra; alterar una fila la rompe y dispara alerta (`INV-34`) |
| `TS-AUD-08` | Reconstrucción del estado de `int_20004` en `T` | Coincide con la versión vigente en ese instante |
| `TS-AUD-09` | Auditoría del polling | Una fila `intake.poll` sin `items` (solo `count` y cursores) |
| `TS-AUD-10` | `correlation_id` del request presente en todas las filas de esa petición | 100 % |

#### Frontera LEAN — `TS-LEAN-*`

| ID | Caso | Esperado |
|---|---|---|
| `TS-LEAN-01` | Payload con `evidence_url` o `PROCESS_EVIDENCE` | `422 UNKNOWN_PROPERTY` (`INV-24`) |
| `TS-LEAN-02` | Payload con `excel_row_id`, `event_id`, `snapshot_id`, `cut_id`, `delivery_attempt`, `archetype_lane` | `422` (`INV-25`) |
| `TS-LEAN-03` | Barrido del esquema de BD y del OpenAPI | Ninguna columna/campo con esos nombres (test de arquitectura) |
| `TS-LEAN-04` | Barrido de todas las respuestas de la suite | Ninguna clave fuera del contrato |
| `TS-LEAN-05` | Dos tareas Planner para una interacción | No representable: `planner_interaction_url` es escalar (`P-11`) |
| `TS-LEAN-06` | `semantic_fingerprint` no aparece en ninguna vista/proyección comercial | Verificado en UI y en derivaciones |

### 15.5 Datos de prueba y ambientes

- Sandbox con los fixtures precargados y un `interaction_ref` reservado por caso.
- Base de datos efímera por corrida (Testcontainers); sin datos productivos.
- Colección Bruno/Postman versionada para que MEP-LEAN valide su cliente contra sandbox.
- CI: `lint → unit → contract → integration → e2e → security` en cada PR; `k6` en nightly.

---

## 16. Criterios de aceptación (Preventa ↔ fábrica)

Cada criterio tiene ID y test asociado. Un criterio sin test en verde bloquea el Go-Live.

### 16.1 Polling y lectura

| ID | Criterio | Tests |
|---|---|---|
| `AC-01` | Cursor opaco, estable, exclusivo y con retención declarada | `TS-INT-02,03,06,07` |
| `AC-02` | Orden total y repetible bajo inserciones concurrentes | `TS-INT-04` |
| `AC-03` | `has_more`, `next_cursor`, `high_watermark` y tamaño máximo de página | `TS-INT-01,05,08,10` |
| `AC-04` | Relectura por identidad y ETag | `TS-INT-13,14,15` |
| `AC-05` | Contexto puntual de OUV con nulos preservados | `TS-OUV-01,02` |
| `AC-06` | `commercial_archetype` expone referencia y nombre estables o `null`, bajo autoridad CRM | `TS-OUV-03,04` |
| `AC-07` | El intake no contiene `interaction_type` y no confunde arquetipo comercial con carril operativo MEP | `TS-INT-12`, `TS-LEAN-02,03` |

### 16.2 Navegación

| ID | Criterio | Tests |
|---|---|---|
| `AC-08` | Plantilla HTTPS estable de interacción con `{interaction_ref}` | `TS-NAV-01` |
| `AC-09` | Plantilla HTTPS estable de OUV con `{opportunity_ref}` | `TS-NAV-02` |
| `AC-10` | Diferenciación en UI entre Planner, registro SharePoint List y SharePoint Documents | `TS-UI-01` |

### 16.3 Servicios e hitos

| ID | Criterio | Tests |
|---|---|---|
| `AC-11` | Sólo técnico; financiero directo sin fase técnica; técnico y financiero simultáneos e independientes; técnico seguido de financiero dependiente | `TS-SVC-01..04` |
| `AC-12` | Rechazo `422` de técnico dependiente de financiero | `TS-SVC-05` |
| `AC-13` | ETA global único. Cuatro hitos y ruta/capacidad `V1`/`Vx` versionada | `TS-MIL-01..09`, `TS-VER-02` |
| `AC-14` | Un mismo `response_id` estable identifica todos los hitos de una interacción | `TS-VER-01,05,06` |
| `AC-15` | `response_version` avanza una sola vez por nueva publicación comercial y no por retry | `TS-VER-09`, `TS-IDEM-01` |
| `AC-16` | Ningún contador, ID o versión interna de MEP/Planner/SharePoint se usa directamente como `response_version` | `TS-VER-10`, `TS-LEAN-02` |
| `AC-17` | Acuse técnico separado de la confirmación comercial `INTERACTION_RECEIVED` | `TS-RCP-04,05` |
| `AC-18` | `service_results[]` como fuente de verdad y campos CRM derivados | `TS-SVC-06..08`, `T-301` |
| `AC-19` | `delivered_interaction_type` es `null` antes del cierre; en `INTERACTION_COMPLETED` nunca `TIPO-POR-ESPECIFICAR` ni una inferencia desde `requested_services[]` | `TS-CLS-01..04` |

### 16.4 Escritura y seguridad

| ID | Criterio | Tests |
|---|---|---|
| `AC-20` | API key no humana enviada exclusivamente en `X-API-Key` sobre HTTPS | `TS-SEC-01,07,08` |
| `AC-21` | Clave distinta por ambiente, fuera de payloads/logs/Git, con rotación y revocación acordadas | `TS-SEC-03,05,09,10` |
| `AC-22` | `Idempotency-Key`, correlación y ETag/If-Match | `TS-IDEM-*`, `TS-CONC-01` |
| `AC-23` | Semántica probada para `409`, `412`, `422`, `429` y `503` | `TS-IDEM-02,07`, `TS-CONC-01`, `TS-SVC-05`, `TS-RL-01`, `TS-ERR-503` |
| `AC-24` | `GET` post-write devuelve la representación persistida | `TS-CONC-04` |
| `AC-25` | `source_content` original preservado sin alteración | `TS-INT-11` |
| `AC-26` | Un retry idéntico no duplica la entrada narrativa; contenido distinto con el mismo `(response_id, response_version)` responde `409` | `TS-VER-09`, `TS-IDEM-07` |
| `AC-27` | Una edición humana concurrente se conserva después de `412`, relectura y reconciliación | `TS-CONC-02` |

### 16.5 Enlaces y frontera LEAN

| ID | Criterio | Tests |
|---|---|---|
| `AC-28` | Sin `PROCESS_EVIDENCE` ni `evidence_url` externo | `TS-LEAN-01,03` |
| `AC-29` | SharePoint List se presenta como registro de ruta viable/capacidad planificada, nunca como entregable | `TS-SVC-09`, `TS-UI-01` |
| `AC-30` | Una interacción corresponde a una sola tarea Planner durante MEP-LEAN | `TS-LEAN-05` |
| `AC-31` | Ningún campo Excel, Event, Snapshot, Cut o retry cruza el contrato | `TS-LEAN-02,03,04,06` |

### 16.6 No funcionales (añadidos por este spec)

| ID | Criterio | Tests |
|---|---|---|
| `AC-32` | Toda mutación deja traza inmutable y encadenada en `audit_log` | `TS-AUD-01..08` |
| `AC-33` | Los límites de tasa se aplican por key y clase, con `Retry-After` y sin efectos colaterales | `TS-RL-01..09` |
| `AC-34` | Ningún log ni respuesta de error contiene secretos ni contenido humano completo | `TS-SEC-09`, `TS-AUD-06` |
| `AC-35` | SLOs de latencia y disponibilidad cumplidos bajo carga nominal | `TS-RL-09` |

---

## 17. Pendientes / a confirmar antes de producción

| ID | Pendiente | Impacto si no se cierra |
|---|---|---|
| `OPEN-01` | Enumeraciones completas de `ServiceResultStatus`, `ServiceOutcome`, `RouteStatus`, `CapacityStatus`, `OpportunityStatus` y catálogo cerrado de `reason_code` | Riesgo de `422` falsos en producción |
| `OPEN-02` | ¿`response_version` debe ser consecutiva (n+1) o solo monotónica creciente? | Define `TS-VER-04` |
| `OPEN-03` | Mapeo de `commercial_archetype` a un concepto existente del Blueprint (segmento/subsegmento, tipo de venta) o modelarlo nuevo | Bloquea `T-104`/`T-305` |
| `OPEN-04` | Alcance para el Go-Live del 9 de octubre: contrato completo (6 endpoints + máquina de 4 hitos) o un subconjunto operativo mínimo primero | Define el corte de fases §14 |
| `OPEN-05` | Ubicación del service account `X-API-Key` dentro del módulo de Auth/RBAC, y política de rotación/revocación por ambiente | Bloquea `T-004`/`T-402` |
| `OPEN-06` | Plantillas de navegación HTTPS por ambiente (sandbox/producción) que el CRM debe entregarle a MEP-LEAN | Bloquea `AC-08`, `AC-09` |
| `OPEN-07` | Catálogo cerrado de `delivered_interaction_type` (valores válidos al cierre) | Bloquea `TS-CLS-02` |
| `OPEN-08` | Valores definitivos de cuotas de rate limit por ambiente y tier | Bloquea `T-007` |
| `OPEN-09` | Retención legal exacta de `audit_log` y destino del archivo frío/WORM | Bloquea `T-403` |
| `OPEN-10` | Criterio de elegibilidad (`eligible_for_mep`): qué interacciones entran al pull y con qué regla de negocio | Bloquea `T-101` |

**Pruebas comprometidas explícitamente en el brief:** los 4 casos de forma válida de `requested_services[]` (`TS-SVC-01..04`), el caso negativo de dependencia invertida `422` (`TS-SVC-05`), y la secuencia completa de versiones de una misma interacción V1→V5 (`TS-VER-01`, fixtures `response-v1` … `response-v5`).

---

## 18. Definition of Done por fase

| Fase | DoD |
|---|---|
| Fase 0 | OpenAPI validado en CI · migraciones aplicadas · `401`/`403`/`429` y auditoría transversales en verde (`TS-SEC-*`, `TS-RL-*`, `TS-AUD-01..05`) |
| Fase 1 | `AC-01` … `AC-07` en verde · contract tests de las 3 lecturas al 100 % |
| Fase 2 | `AC-11` … `AC-19`, `AC-22` … `AC-27` en verde · secuencia V1→V5 reproducible desde fixtures |
| Fase 3 | `AC-10`, `AC-18`, `AC-29` verificados en UI · sin duplicación de notas por acuse + hito |
| Fase 4 | `AC-08`, `AC-09`, `AC-21`, `AC-32` … `AC-35` en verde · runbooks de rotación y de incidentes · `OPEN-*` cerrados o formalmente aceptados como riesgo |
