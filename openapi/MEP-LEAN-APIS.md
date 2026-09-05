# APIs CRM Frisson ↔ MEP-LEAN

Contrato **v0.2.0-draft**. El CRM es el servidor; MEP-LEAN es el cliente.

- **Swagger / OpenAPI (fuente de verdad):** [`openapi/crm-mep.yaml`](./crm-mep.yaml)
- **Cómo verlo:** abrir el YAML en [Swagger Editor](https://editor.swagger.io/), Redoc o cualquier visor OpenAPI 3.1
- **Prefijo:** `/v1` (sin `/api/v1`)
- **Auth:** header `X-API-Key` (máquina a máquina). El front CRM **no** llama estas rutas.

Las rutas internas del comercial (`GET/POST /api/v1/discovery/ouvs/:id/solicitudes-preventa`) son otra superficie: JWT, CORS, UI. No forman parte de este contrato.

---

## Convenciones

| Tema | Regla |
|---|---|
| Transporte | HTTPS (TLS 1.2+). HTTP → 426 |
| Fechas | UTC, RFC 3339, sufijo `Z` |
| ETag | Fuerte, opaco, entrecomillado. Nunca `W/` |
| Writes | `Content-Type: application/json`. Cuerpo ≤ 256 KB |
| Idempotencia | Header `Idempotency-Key` (8–256: `A-Za-z0-9._:-`). Mismo key + payload distinto → 409 |
| Correlación | `X-Correlation-ID` obligatorio en writes; opcional en reads |
| Errores | `application/problem+json` (RFC 7807) |
| Nulos | Un campo sin valor se serializa como `null`. Nunca se omite |

### Headers comunes

```
X-API-Key: <clave-por-ambiente>
X-Correlation-ID: corr_01JCRM20004
```

Writes además:

```
Idempotency-Key: mep-receipt-int_20004-v1
If-Match: "int-20004-v1"          # opcional; desactualizado → 412
Content-Type: application/json
```

Reads condicionales:

```
If-None-Match: "int-20004-v1"     # sin cambios → 304
```

### Error (todas las operaciones)

```json
{
  "type": "https://crm.frisson/problems/unauthorized",
  "title": "Unauthorized",
  "status": 401,
  "detail": "Authentication required.",
  "code": "UNAUTHORIZED",
  "correlation_id": "corr_01JCRM20004"
}
```

| HTTP | Código típico | Cuándo |
|---|---|---|
| 400 | `ERR-400`, `CURSOR_EXPIRED` | Query/body mal formado o cursor vencido |
| 401 | `UNAUTHORIZED` | Clave ausente, inválida o revocada |
| 403 | `FORBIDDEN` | Identidad válida sin el scope |
| 404 | `NOT_FOUND` | Recurso inexistente o no visible |
| 409 | `CONFLICT` | `Idempotency-Key` reusado con otro payload |
| 412 | `PRECONDITION_FAILED` | `If-Match` desactualizado |
| 413 | — | Cuerpo > 256 KB |
| 415 | — | `Content-Type` distinto de `application/json` |
| 422 | `UNPROCESSABLE_CONTENT` | JSON válido, semántica inválida |
| 429 | `TOO_MANY_REQUESTS` | Cuota; ver `Retry-After` |
| 503 | `SERVICE_UNAVAILABLE` | Error transitorio del CRM |

---

## 1. Pull paginado de interacciones

`GET /v1/commercial-interactions`

Scope: `interactions:read`

Query:

| Param | Tipo | Default | Notas |
|---|---|---|---|
| `cursor` | string | — | Opaco, firmado, exclusivo. Expirado (7 días) → 400 |
| `limit` | int 1–200 | 50 | Sin `OFFSET` |
| `service_horizon` | `IMMEDIATE` \| `DEFERRED` \| `UNSPECIFIED` | — | Filtro opcional |

Orden estable: `source_created_at ASC, id ASC`. Solo salen filas con `eligible_for_mep = true` **y** `polling_status IS NULL`. En cuanto MEP acusa por `POST .../processing-receipts` (`ACCEPTED`, `DUPLICATE`, `QUARANTINED` o `REJECTED`), esa interacción **deja de salir** del pull. No es solo `ACCEPTED`. El GET por `{ref}` sigue devolviendo la fila para reconciliar. La respuesta **nunca** incluye `interaction_type`.

### Cómo funciona el cursor (polling)

`cursor` le dice al CRM: *dame lo que viene después de este punto*. Es un token **opaco y firmado** (HMAC). MEP no lo lee ni lo fabrica: solo reenvía el `next_cursor` literal de la página anterior.

No es un `crm_interaction_ref`. Esto **está mal**:

```
next_cursor: "int_ouv0012_2"          ← no
cursor=int_ouv0012_2                  ← no
```

Se ve más así (recortado):

```
next_cursor: "eyJ0IjoxNzI0...iat.firma"
```

Codifica, por dentro, `(source_created_at, id)` del **último ítem de esa página**, más el filtro `service_horizon` con el que se emitió y un `iat`. Es **exclusivo**: la página siguiente no repite ese último ítem. No hay `OFFSET`.

Retención: **7 días** desde que se emitió. Vencido → `400 CURSOR_EXPIRED`. Firma o filtro distinto → `400 INVALID_CURSOR`.

`has_more: true` ⇔ hay `next_cursor`. `has_more: false` ⇔ `next_cursor: null` (INV-04). En la última página **el CRM no deja un cursor de checkpoint**.

#### Recorrido

**Llamada 1 — primera vez, sin cursor**

```
GET /v1/commercial-interactions?limit=2
X-API-Key: …
X-Correlation-ID: corr_poll_001
```

```json
{
  "items": [
    { "crm_interaction_ref": "int_20001", "source_created_at": "2026-08-21T14:30:00Z" },
    { "crm_interaction_ref": "int_20002", "source_created_at": "2026-08-21T14:32:00Z" }
  ],
  "has_more": true,
  "next_cursor": "eyJ0IjoxNzI0MjU4NzIwMDAwLCJpIjoiMiIsImgiOm51bGwsImlhdCI6MTcyNDI1ODQwMDAwMH0.xxxx",
  "page_observed_at": "2026-08-21T14:40:00Z",
  "high_watermark": "2026-08-21T14:32:00Z"
}
```

MEP guarda `next_cursor` tal cual (checkpoint persistente, no en memoria sola).

**Llamada 2 — se reenvía el cursor recibido**

```
GET /v1/commercial-interactions?limit=2&cursor=<next_cursor-literal-de-la-llamada-1>
```

El CRM decodifica y devuelve lo que está **después** de `int_20002`:

```json
{
  "items": [
    { "crm_interaction_ref": "int_20003" },
    { "crm_interaction_ref": "int_20004" }
  ],
  "has_more": false,
  "next_cursor": null,
  "page_observed_at": "2026-08-21T14:41:00Z",
  "high_watermark": "2026-08-21T14:36:00Z"
}
```

Ahí termina el barrido de esta ronda: no hay más páginas **ahora**.

**Ciclo siguiente del job (p. ej. 5 min después)**

Las que ya acusaste (`polling_status` no nulo) **no vuelven** al GET. Podés arrancar **sin** cursor: solo salen las pendientes. Si entre ciclos nació `int_20005` y no tiene receipt, esa es la que viene.

Sigue paginando con `next_cursor` mientras `has_more: true`. No hace falta un checkpoint de refs ya procesados para no re-verlas; el acuse es ese checkpoint.

`high_watermark` es informativo (`source_created_at` máximo de **esa** página). No se manda de vuelta. `page_observed_at` es el instante en que el CRM armó la página.

Si usás `service_horizon`, el cursor queda atado a ese filtro. Reenviarlo con otro horizonte (o sin él) → `400 INVALID_CURSOR`.

#### Qué hay que evitar

- Fabricar un cursor (con `source_created_at`, un `int_…`, etc.). Siempre el `next_cursor` literal.
- Perder el checkpoint: si el proceso cae, se retoma el último `next_cursor` **no nulo** guardado + el set de refs ya procesados; no “desde cero” sin más.
- Mezclar `limit` está bien; mezclar `service_horizon` con un cursor viejo, no.
- Acusar y seguir esperando esa misma fila en el pull: ya no sale.
- Tratar `next_cursor: null` como error. Es “no hay más pendientes ahora”; el próximo ciclo, sin cursor, trae solo lo nuevo.

### Response `200`

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

Si hay más páginas: `has_more: true` y `next_cursor` con el token firmado.

Errores: 400, 401, 403, 429, 503.

---

## 2. Releer una interacción

`GET /v1/commercial-interactions/{interaction_ref}`

Scope: `interactions:read`

Path: `interaction_ref` (máx. 64). Header opcional: `If-None-Match`.

### Response `200`

```json
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
```

Header de respuesta: `ETag: "int-20004-v1"` (idéntico al `etag` del cuerpo).

Otros: `304` (sin cambios), 401, 403, 404, 429, 503.

Enums de `requested_services`:

- `service`: `TECHNICAL_DESIGN` \| `FINANCIAL_DESIGN`
- `dependency`: `NONE` \| `TECHNICAL_DESIGN` \| `FINANCIAL_DESIGN`

---

## 3. Contexto de OUV

`GET /v1/commercial-opportunities/{opportunity_ref}`

Scope: `opportunities:read`. Solo lectura. Header opcional: `If-None-Match`.

### Response `200` — OUV completa

```json
{
  "crm_opportunity_ref": "ouv_9101",
  "title": "OUV de ejemplo para integración",
  "organization": { "ref": "org_4101", "name": "Cliente de ejemplo" },
  "commercial_value": { "amount": 125000000, "currency": "COP" },
  "stage": { "ref": "stage_design", "name": "Diseño de preventa" },
  "status": "OPEN",
  "expected_close_date": "2026-09-30",
  "commercial_owner": { "ref": "commercial_17", "display_name": "Ejecutivo Comercial" },
  "commercial_archetype": { "ref": "arch_b2g_structured", "name": "B2G-ESTRUCTURADO" },
  "context_observed_at": "2026-08-21T14:31:20Z",
  "source_version": "7",
  "etag": "\"ouv-9101-v7\""
}
```

`commercial_value.amount` es entero en unidad menor (COP sin decimales).

### Response `200` — opcionales en `null`

```json
{
  "crm_opportunity_ref": "ouv_9102",
  "title": null,
  "organization": null,
  "commercial_value": null,
  "stage": null,
  "status": null,
  "expected_close_date": null,
  "commercial_owner": null,
  "commercial_archetype": null,
  "context_observed_at": "2026-08-21T14:31:20Z",
  "source_version": "1",
  "etag": "\"ouv-9102-v1\""
}
```

`status`: `OPEN` \| `WON` \| `LOST` \| `CANCELLED` \| `null`.

Otros: `304`, 401, 403, 404, 429, 503.

---

## 4. Acuse técnico (receipt)

`POST /v1/commercial-interactions/{interaction_ref}/processing-receipts`

Scope: `receipts:write`

Headers obligatorios: `X-API-Key`, `Idempotency-Key`, `X-Correlation-ID`.

El acuse es un hecho de **transporte**. No muta la interacción comercial y **no** equivale al hito `INTERACTION_RECEIVED`.

`reason_code` obligatorio (no nulo) cuando `processing_status` es `QUARANTINED` o `REJECTED`; si no → 422.

`semantic_fingerprint`: 64 hex. Opaco para el CRM.

### Request body

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

`processing_status`: `ACCEPTED` \| `DUPLICATE` \| `QUARANTINED` \| `REJECTED`.

### Response `201` (nuevo) / `200` (replay idempotente)

El cuerpo es el mismo documento persistido. `201` incluye header `Location`.

Errores: 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 503.

---

## 5. Publicar respuesta MEP (write-back)

`PUT /v1/commercial-interactions/{interaction_ref}/responses/{response_id}`

Scope: `responses:write`

Headers obligatorios: `X-API-Key`, `Idempotency-Key`, `X-Correlation-ID`.

Único canal por el que MEP publica hechos comerciales.

- `response_id` del path debe coincidir con el del body → si no, 422
- `response_version` monotónico estricto por `response_id`. Un retry **no** lo incrementa
- La máquina de hitos no admite retroceso; repetir el mismo hito en una versión nueva sí
- `response_id`, `response_version` y `route_capacity.version` son tres relojes independientes
- Propiedad no declarada → 422
- `delivered_interaction_type` debe ser `null` antes del cierre. En `INTERACTION_COMPLETED` nunca `TIPO-POR-ESPECIFICAR`

Hitos (`business_milestone`):

`INTERACTION_RECEIVED` → `ENGINEER_ASSIGNED` → `ROUTE_CAPACITY_REGISTERED` → `INTERACTION_COMPLETED`

`response_status`: `RECEIVED` \| `IN_PROGRESS` \| `COMPLETED`

### Request / response — V1 `INTERACTION_RECEIVED`

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
    {
      "service": "TECHNICAL_DESIGN",
      "status": "RECEIVED",
      "outcome": null,
      "dependency": "NONE",
      "summary": "Recibido en la fábrica de preventa.",
      "reason_code": null,
      "deliverables": []
    },
    {
      "service": "FINANCIAL_DESIGN",
      "status": "RECEIVED",
      "outcome": null,
      "dependency": "TECHNICAL_DESIGN",
      "summary": "Pendiente del resultado técnico.",
      "reason_code": null,
      "deliverables": []
    }
  ],
  "operational_links": {},
  "narrative_note": "La interacción fue recibida por MEP-LEAN.",
  "delivered_interaction_type": null,
  "semantic_fingerprint": "1111111111111111111111111111111111111111111111111111111111111111"
}
```

### Request / response — V3 `ROUTE_CAPACITY_REGISTERED`

Desde este hito son obligatorios `eta_date`, `assignment` (ya no puede volver a `null`) y `operational_links.route_capacity_register_url`. `planner_interaction_url` es obligatorio desde `ENGINEER_ASSIGNED`.

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
    {
      "service": "TECHNICAL_DESIGN",
      "status": "IN_PROGRESS",
      "outcome": "VIABLE",
      "dependency": "NONE",
      "summary": "Ruta técnica viable; entregable en construcción.",
      "reason_code": null,
      "deliverables": []
    },
    {
      "service": "FINANCIAL_DESIGN",
      "status": "RECEIVED",
      "outcome": null,
      "dependency": "TECHNICAL_DESIGN",
      "summary": "Pendiente del resultado técnico.",
      "reason_code": null,
      "deliverables": []
    }
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

### Request / response — V5 `INTERACTION_COMPLETED`

`route_capacity.version` puede quedarse en `V2` aunque `response_version` sea 5 (relojes independientes).

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
      "service": "TECHNICAL_DESIGN",
      "status": "COMPLETED",
      "outcome": "VIABLE",
      "dependency": "NONE",
      "summary": "Diseño técnico entregado.",
      "reason_code": null,
      "deliverables": [
        {
          "url": "https://verytel.sharepoint.com/sites/preventa/Shared%20Documents/int_20004/diseno-tecnico.pdf",
          "label": "Diseño técnico",
          "published_at": "2026-08-27T16:00:00Z"
        }
      ]
    },
    {
      "service": "FINANCIAL_DESIGN",
      "status": "COMPLETED",
      "outcome": "VIABLE",
      "dependency": "TECHNICAL_DESIGN",
      "summary": "Modelo financiero entregado.",
      "reason_code": null,
      "deliverables": [
        {
          "url": "https://verytel.sharepoint.com/sites/preventa/Shared%20Documents/int_20004/modelo-financiero.xlsx",
          "label": "Modelo financiero",
          "published_at": "2026-08-28T17:40:00Z"
        }
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

### Response `200`

El cuerpo es la representación persistida completa (creación o replay). Header `ETag`.

Errores: 400, 401, 403, 404, 409, 412, 413, 415, 422, 429, 503.

Enums de `service_results[]`:

| Campo | Valores |
|---|---|
| `status` | `RECEIVED` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED` |
| `outcome` | `VIABLE` \| `NOT_VIABLE` \| `PARTIAL` \| `null` |
| `dependency` | `NONE` \| `TECHNICAL_DESIGN` \| `FINANCIAL_DESIGN` |

`reason_code` obligatorio cuando `outcome` es `NOT_VIABLE` o `PARTIAL`, o cuando `status` es `CANCELLED`.

`deliverables[].url` debe ser HTTPS de SharePoint **Documents** (nunca una List). `route_capacity_register_url` sí es List; no es entregable.

`route_capacity.route_status`: `VIABLE` \| `NOT_VIABLE` \| `CONDITIONED`  
`route_capacity.capacity_status`: `PLANNED` \| `NOT_PLANNED` \| `CONDITIONED`

---

## 6. Leer respuesta persistida

`GET /v1/commercial-interactions/{interaction_ref}/responses/{response_id}`

Scope: `responses:read`

Query: `version` (int ≥ 1, opcional). Sin `version` → última publicada. Con `?version=n` → esa versión del histórico (404 si no existe).

Header opcional: `If-None-Match`.

### Response `200`

Exactamente el mismo JSON que devolvió el `PUT` de esa versión (mismos campos, mismo `ETag`, mismo orden de `service_results[]`). Ver ejemplos V1 / V3 / V5 arriba.

Otros: `304`, 401, 403, 404, 429, 503.

---

## Flujo típico

```
MEP  GET  /v1/commercial-interactions
MEP  GET  /v1/commercial-opportunities/{ouv}
MEP  POST /v1/commercial-interactions/{ref}/processing-receipts
MEP  PUT  .../responses/{response_id}     (V1 RECEIVED)
MEP  PUT  .../responses/{response_id}     (V2 ENGINEER_ASSIGNED)
MEP  PUT  .../responses/{response_id}     (V3 ROUTE_CAPACITY_REGISTERED)
MEP  PUT  .../responses/{response_id}     (V5 INTERACTION_COMPLETED)
MEP  GET  .../responses/{response_id}     (verificación)
```

---

## Fixtures del repo

| Recurso | Archivo |
|---|---|
| Página de intake | `backend/test/fixtures/intake/page-single-item.json` |
| OUV completa | `backend/test/fixtures/opportunity/ouv-9101-full.json` |
| OUV con nulos | `backend/test/fixtures/opportunity/ouv-9102-nulls.json` |
| Receipt ACCEPTED | `backend/test/fixtures/receipts/receipt-accepted.json` |
| Response V1 | `backend/test/fixtures/responses/response-v1.json` |
| Response V3 | `backend/test/fixtures/responses/response-v3.json` |
| Response V5 | `backend/test/fixtures/responses/response-v5.json` |
