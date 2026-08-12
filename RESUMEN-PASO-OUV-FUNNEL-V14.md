# RESUMEN — OUV Funnel v1.4 (discovery)

**Fecha:** 2026-08-11  
**Spec:** `docs/specs/spec-ouv-funnel.md` v1.4 (APROBADO)  
**Prompt:** `PROMPT-IMPLEMENTACION-OUV-FUNNEL-V14.md`  
**Estado:** cerrado — DoD cumplido

## Qué se hizo

### Migración `20260810190500-restructure-ouv-contactos-account-id.js`
- Guarda producción (`NODE_ENV=production` exige `ALLOW_CONTACT_TRUNCATE=true`).
- Truncate defensivo de `ouv_contactos`.
- `ouv_contactos`: ADD `person_id` NOT NULL FK → `people`; DROP `nombre`/`cargo`/`email`/`telefono`.
- `ouvs`: ADD `account_id` nullable FK → `accounts`; ADD `segment_id` / `subsegment_id` nullable.
- **Ejecutada** en development (2026-08-10) — verificada en DB:
  - `ouv_contactos`: `contacto_ouv_id, ouv_id, notas, created_at, updated_at, deleted_at, person_id`
  - `ouvs`: columnas `account_id`, `segment_id`, `subsegment_id` presentes

### Backend discovery
- Models `OuvContacto` (`personId`) / `Ouv` (`accountId`, `segmentId`, `subsegmentId`).
- `crearDesdeLead` eliminado → **`reutilizarDesdeLead`** (reutiliza `person_id`).
- **`crearDesdeSql`**: principal `position=1` → `AccountsService.getPeopleWithAccounts` → `account_id` (GC-13) + `empresa_nombre` = `accounts.name` (sin `lead.empresa_nombre`); fail-fast si falta person/account.
- Contactos: create `{ person_id | person }`; **EARS-08b**; `actualizarNotas`; soft-delete + limpia FK influencias.
- `DiscoveryModule` importa `AccountsModule`; exporta `OuvsService` + `OuvContactosService`.
- Calificación sigue orquestando (`convertirEnOuv` → `crearDesdeSql`); evento `ouv.creada_desde_sql` sin duplicar.

### Accounts GC-11
- Soft-delete de `people` bloquea si hay filas activas en `lead_contacts` **o** `ouv_contactos` (sin bypass de “columna ausente”).

### Frontend discovery
- `ContactoFormModal` / `ContactosSidePanel` / `OuvDetailPage`: accounts/people; editar solo notas; `lockAccountId` cuando la OUV ya tiene account.
- `CrearOuvDirectaModal`: selector opcional de `account_id`.
- API types enriquecidos (`name`, `account_name`, `person_id`, …).

### Higiene
- `AGENTS.md`: `ouvs.account_id` ya no figura como “pendiente de GC-13”.

## Definition of Done

- [x] Migración 5A + schema verificado en DB
- [x] `ouvs.account_id` (+ segment FKs)
- [x] `reutilizarDesdeLead` (no copia)
- [x] `crearDesdeSql` GC-13 + `accounts.name`
- [x] Servicios públicos exportados; sin endpoint de conversión en discovery
- [x] EARS-08b / EARS-09 / EARS-10
- [x] GC-11 con `ouv_contactos.person_id`
- [x] FE contactos vía accounts/people
- [x] `tsc` backend + frontend OK (2026-08-11)
- [x] Este resumen

## Cómo probar

```powershell
# Ya corrido; re-run solo si hace falta en otro entorno:
cd backend
$env:ALLOW_CONTACT_TRUNCATE='true'
npm run migration:run
```

1. Convertir SQL→OUV: `ouvs.account_id` + `empresa_nombre` desde account del principal; `ouv_contactos` con los mismos `person_id`.
2. OUV directa sin account → primer contacto setea `account_id`; contacto de otra empresa → 400.
3. Soft-delete person ligado a OUV → rechazado (GC-11).
4. Panel contactos: buscar/crear person; editar solo notas.

## Archivos tocados

- `backend/database/migrations/20260810190500-restructure-ouv-contactos-account-id.js`
- `backend/src/modules/discovery/models/ouv-contacto.model.ts`, `ouv.model.ts`
- `backend/src/modules/discovery/dtos/ouv-contacto.dto.ts`, `crear-ouv-directa.dto.ts`, `ouv-response.dto.ts`
- `backend/src/modules/discovery/services/ouv-contactos.service.ts`, `ouvs.service.ts`
- `backend/src/modules/discovery/controllers/ouv-contactos.controller.ts`
- `backend/src/modules/discovery/discovery.module.ts`
- `backend/src/modules/accounts/services/accounts.service.ts`
- `frontend/src/modules/discovery/api/ouvs-api.ts`
- `frontend/src/modules/discovery/components/ContactoFormModal.tsx`, `ContactosSidePanel.tsx`, `CrearOuvDirectaModal.tsx`
- `frontend/src/modules/discovery/pages/OuvDetailPage.tsx`
- `AGENTS.md`
- `RESUMEN-PASO-OUV-FUNNEL-V14.md`

## Fuera de alcance (prompt)

- Reescribir calificación EARS-12 / KPIs / Wave 2
- Reestructurar `lead_contacts` de nuevo
- Commit / PR (solo si lo pedís)
