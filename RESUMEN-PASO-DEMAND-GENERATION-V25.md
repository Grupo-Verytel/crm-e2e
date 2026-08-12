# RESUMEN-PASO-DEMAND-GENERATION-V25

**Fecha:** 2026-08-10  
**Estado:** completado (código) — migraciones locales requieren `ALLOW_CONTACT_TRUNCATE=true`  
**Spec:** `docs/specs/spec-demand-generation.md` v2.5  
**Prompt:** `PROMPT-IMPLEMENTACION-DEMAND-GENERATION-V25.md`

---

## Qué se hizo

### Backend

| Pieza | Detalle |
|---|---|
| Migraciones | `20260810190000` segments/subsegments + seed 4 segmentos; `190100` truncate + `lead_contacts.person_id`; `190200` leads fields; `190300` `sqls.origen_creacion`; `190400` roles ProductManager/TraductorDeNegocio + EjecutivoComercial CRU |
| Models | `LeadContact` solo `person_id`; `Lead` sin copia denormalizada; `Segment`/`Subsegment`; `Sql.origenCreacion` |
| LeadsService | Contactos vía `AccountsService`; rutas directas ProductManager / EjecutivoComercial; filtro TraductorDeNegocio; CSV via findOrCreateAccountAndPerson; DG-08 join people/accounts |
| State machine | Approve MQL → `origen_creacion = enrutamiento_normal` |
| API | `GET /segments`; create/list pasan `roleName` |
| Roles seed | `role-permissions.js` + migración de roles |
| Accounts | `getPeopleWithAccounts`, `assertPeopleSameAccount`, `findOrCreateAccountAndPerson`; GC-11 usa `person_id` en `lead_contacts` |
| AGENTS.md | `ouvs.account_id` (GC-13 pendiente); sin `cuenta_id` |

### Frontend

- `LeadFormModal`: cuenta/persona vía módulo accounts; `contacts: [{ person_id }]`; modos standard / product_manager / ejecutivo; checklist; business_referrer
- `LeadsPage` / `DemandNav` / detalle: roles ProductManager, EjecutivoComercial, TraductorDeNegocio (solo lectura “Mis referidos”)
- CSV headers `account_name` / `tax_id`
- `segments-api.ts`, helpers de display de contactos

### Fuera de alcance (cumplido)

Sin `ouvs.account_id`; sin reestructurar schema de `ouv_contactos` (solo truncate en migración); sin KPI calificación.

---

## Parche post-v2.5 — `sql.creado_directo` (2026-08-10)

Ruta `EjecutivoComercial` (EARS-29): tras `sqls.create` en la misma txn se invoca `workflowEngine.transition(..., 'sql.creado_directo', { estadoAnterior: null, estadoNuevo: Asignado })`. Regla añadida en `workflow.rules.ts` con `destinatarios: []` (solo audit). Tests leads + workflow OK; build OK.

---

## Cómo probar

1. En `backend/`:  
   `$env:ALLOW_CONTACT_TRUNCATE='true'; npm run migration:run`  
   (en producción exige el flag; sin él la migración 190100 aborta — R1).
2. Re-login para cargar roles/permisos nuevos (`ProductManager`, `TraductorDeNegocio`).
3. Crear lead estándar (Gestor): buscar/crear empresa + contactos → guardar.
4. Login ProductManager: Nuevo Lead → BTL/FABRICA + checklist → nace `MQL_PENDING`.
5. Login EjecutivoComercial: Nuevo Lead directo → nace `SQL` + SQL asignado.
6. Soft-delete person con lead asociado → debe fallar (GC-11).

---

## Archivos tocados (principales)

- `backend/database/migrations/2026081019*.js`
- `backend/database/seeders/lib/role-permissions.js`
- `backend/src/modules/demand-generation/**`
- `backend/src/modules/accounts/services/accounts.service.ts` (+ constants)
- `backend/src/modules/discovery/services/ouv*.ts`, `qualification/services/sqls.service.ts` (adaptación enrich)
- `frontend/src/modules/demand-generation/**`
- `AGENTS.md`
