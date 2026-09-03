# Module: implementation (api)

Handover. SER-####, kickoff, acta de inicio, hitos RFS/RFB.

## Boundaries (see .cursor/rules/700-modules.mdc)
- Expose ONE public service + DTOs/events. No deep imports from other modules.
- Cross-module access goes through the other module's public service only.
- Shared code -> libs/.

## Wave
Commercial phase — build in its assigned sprint (work plan).

---

## PMO integration (Control Project)

Implemented slice: the OUV's delivery project lives in the PMO, and this module is the only
door between both systems. Correlation key is the `ouv_id` — the PMO stores it as
`pro_project.OUV_ID`.

Public service: `ProjectExecutionService`. Cross-module reads go through `OuvsService`
(discovery) and notifications through `WorkflowEngineService` — no deep imports.

Spec and rationale: `docs/specs/spec-implementacion-pmo.md` and
`docs/specs/decisions/2026-09-DR-integracion-pmo-control-project.md`.

### Endpoints

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/v1/implementation/projects/:ouvId` | JWT + CASL `create Service` | Opens the delivery project in the PMO |
| GET | `/api/v1/implementation/projects/:ouvId/execution` | JWT + CASL `read Service` | Execution indicators (billing, costs, schedule, scope) |
| GET | `/api/v1/implementation/projects/:ouvId/state-history` | JWT + CASL `read Service` | Full state-change history |
| POST | `/api/v1/integrations/execution/status-changes` | `x-api-key` (`PmoApiKeyGuard`) | Inbound webhook pushed by the PMO |

The two GET routes are a read-through to the PMO: nothing is cached or duplicated in the CRM
database, so the indicators can never drift from the PMO's own numbers.

### Opening the project

The POST is a deliberate user action, not a side effect of `OuvsService.ganar()`: that runs inside
a DB transaction, and an outbound HTTP call there would let a PMO outage block the closing of a won
opportunity. The service requires `resultado = Ganada` and fills the payload from the OUV (title,
`monto_final`); optional fields the caller omits are omitted from the payload too, so the PMO's own
column DEFAULTs apply. A repeat of the same OUV comes back as `409 PMO_PROJECT_ALREADY_EXISTS` —
the PMO keys on `OUV_ID`.

### Inbound webhook

```json
{
  "referenceId":     "<ouv_id>",
  "newStatus":       "<PMO state name, free text>",
  "occurredAt":      "<ISO 8601>",
  "externalEventId": "<UUID, stable across PMO retries>",
  "comment":         "<optional>"
}
```

| Status | Case |
|--------|------|
| 202 | Event ingested |
| 200 | Idempotent replay — the `externalEventId` was already stored |
| 400 | Payload fails DTO validation |
| 401 | Missing or invalid `x-api-key` |
| 404 | `referenceId` matches no OUV |

Ingest-only by design: the CRM validates neither the status value nor the transition, because the
PMO owns that state machine. `newStatus` is stored verbatim in `project_status_events.new_status`;
it is only truncated to 40 chars when written into `notifications.estado_nuevo`.

Idempotency is enforced by the UNIQUE index on `project_status_events.external_event_id`, and the
notification carries the same id as its dedup discriminator — so a retry never produces a second
bell/toast, while a genuine second transition of the same OUV always does.

`externalEventId` is a **UUID v5** (the PMO derives it from its `PSH_NCODE` so retries repeat it),
which is why the DTO validates it with `@IsUUID()` and not `@IsUUID('4')` — pinning v4 rejects every
real push with a 400. Covered by `dtos/status-change.dto.spec.ts`.

### Notification to the comercial

Ingestion and notification share one transaction. The workflow rule
`ouv.estado_proyecto_cambiado` (see `workflow-engine/workflow.rules.ts`) has no guards and one
recipient: the OUV's `comercial_id`. The actor is the system user, since the trigger is a machine,
not a person. The socket push fires after commit, like every other workflow notification.

### Outbound client

`PmoApiClient` calls the PMO with `x-api-key` and an 8s timeout, mapping failures to the standard
error shape: `PMO_PROJECT_NOT_FOUND` (404), `PMO_PROJECT_ALREADY_EXISTS` (409),
`PMO_PAYLOAD_REJECTED` (422 — the PMO returned 400, so the defect is on the CRM side),
`PMO_BAD_RESPONSE` (502), `PMO_UNREACHABLE` / `PMO_NOT_CONFIGURED` (503).

On the PMO side the key is stored only as a bcrypt hash (`INTEGRATION_API_KEYS`, entries shaped
`name:hash`); generate one with `npm run api-key crm` in `controlproject/api`.

### Environment

| Variable | Use |
|----------|-----|
| `PMO_API_BASE_URL` | Base URL of the PMO API |
| `PMO_API_KEY` | Key the CRM sends to the PMO (outbound) |
| `PMO_INBOUND_API_KEY` | Key the PMO must send to the webhook (inbound) |

Template: `backend/.env.sample`.

### Migration

`backend/database/migrations/20260823120000-create-project-status-events.js`

### Frontend

`/services` lists won OUVs; `/services/:ouvId` renders the project card (four indicators + state
timeline) and offers "Crear proyecto en el PMO" when the PMO answers `PMO_PROJECT_NOT_FOUND`.
Code in `frontend/src/modules/implementation`.
