# RESUMEN-EJECUCION — Metas semanales de generación de demanda

Fecha de cierre: 2026-10-29. Sin commit, push ni merge.

Spec: `specs/demand-goals/spec.md`. Decisiones: `specs/decisions/2026-10-29-metas-generacion-demanda.md`.

## Archivos

### Backend

- `backend/database/migrations/20261029120000-reshape-marketing-dashboard-targets.js`
- `backend/database/migrations/20261029120100-demand-goal-permissions.js`
- `backend/database/seeders/lib/role-permissions.js`
- `backend/src/modules/demand-generation/models/marketing-dashboard-target.model.ts`
- `backend/src/modules/demand-generation/models/enums/marketing-dashboard-metric.enum.ts`
- `backend/src/modules/demand-generation/models/marketing-dashboard-target.audit.spec.ts`
- `backend/src/modules/demand-generation/dtos/marketing-dashboard-goals.dto.ts`
- `backend/src/modules/demand-generation/dtos/dashboard-response.dto.ts`
- `backend/src/modules/demand-generation/lib/weekly-goal-attainment.ts`
- `backend/src/modules/demand-generation/lib/weekly-goal-attainment.spec.ts`
- `backend/src/modules/demand-generation/services/marketing-dashboard-targets.service.ts`
- `backend/src/modules/demand-generation/services/marketing-dashboard-targets.service.spec.ts`
- `backend/src/modules/demand-generation/services/marketing-dashboard-targets.permissions.spec.ts`
- `backend/src/modules/demand-generation/services/dashboard.service.ts`
- `backend/src/modules/demand-generation/services/demand-generation.service.ts`
- `backend/src/modules/demand-generation/controllers/dashboard.controller.ts`
- `backend/src/modules/demand-generation/demand-generation.module.ts`
- `backend/src/modules/demand-generation/migrations/reshape-marketing-dashboard-targets.spec.ts`

### Frontend

- `frontend/src/modules/demand-generation/pages/MarketingDashboardPage.tsx`
- `frontend/src/modules/demand-generation/components/MarketingDashboardGoalsModal.tsx`
- `frontend/src/modules/demand-generation/api/dashboard-api.ts`
- `frontend/src/modules/demand-generation/types.ts`
- `frontend/src/modules/demand-generation/lib/can-edit-demand-goals.ts`
- `frontend/src/modules/demand-generation/lib/bogota-fiscal.ts`
- `frontend/src/components/fiscal-quarter-options.ts`
- `frontend/src/components/FiscalQuarterSelect.tsx`

### Specs

- `specs/demand-goals/spec.md`
- `specs/demand-goals/RESUMEN-PASO-0.md`
- `specs/demand-goals/RESUMEN-PASO-1.md`
- `specs/demand-goals/RESUMEN-PASO-2.md`
- `specs/demand-goals/RESUMEN-PASO-3.md`
- `specs/demand-goals/RESUMEN-EJECUCION.md`
- `specs/decisions/2026-10-29-metas-generacion-demanda.md`
- `AGENTS.md` (sección 15)

## Checklist de despliegue a certification

- [ ] **a)** La migración `20261029120000-reshape-marketing-dashboard-targets.js` corre sobre una base donde `marketing_dashboard_targets` no existe. Ese es el camino T1: crea el esquema nuevo vacío, sin snapshot y sin metas vivas. En la RDS de desarrollo la tabla ya existía con el grano viejo; certification puede no tenerla.
- [ ] **b)** La migración `20261029120100-demand-goal-permissions.js` agrega `create`, `read`, `update` y `delete` de `DemandGoal` a las filas `Admin` y `DirectorMercadeo`. No crea el rol. Si `DirectorMercadeo` no existe, no lo inserta.
- [ ] **c)** Después de esa migración, los usuarios `Admin` y `DirectorMercadeo` cierran sesión y vuelven a entrar. Si no, el engranaje no aparece.
- [ ] **d)** `crm-e2e-DesignJD` deja de funcionar contra cualquier base ya migrada. La tabla ya no tiene `period_type`, `interactions`, `period_leads` ni `converted_ouvs`.

## Pendientes fuera de alcance

- Acceso por URL a `/demand/dashboard` de `TraductorDeNegocio` y `ProductManager`. La pestaña no se les muestra; la ruta sigue abierta si el API les deja leer `Lead`.
- Formato de error del `ValidationPipe` global. Sigue respondiendo `message` como arreglo, con prefijo de ruta y sin `code: "VALIDATION"`. El modal ya quita el prefijo (F1). El pipe no se cambió.
- Filas de `audit_log` en la RDS de desarrollo atribuidas a `erobles` por el smoke del Paso 3. El smoke creó y luego eliminó las metas de prueba. Esas filas de auditoría quedan. No se borran desde aquí.

## Verificación

- `npx tsc -b --noEmit` en `frontend`: verde.
- `npx tsc --noEmit -p tsconfig.build.json` en `backend`: verde.
- ESLint de los archivos de esta funcionalidad en frontend, y de los archivos nuevos de backend: verde.
- Jest del Paso 2, cinco suites: 34 pruebas en verde. La de migración usa el esquema temporal `crm_e2e_dg_migtest`. No se corrió `migration:run` ni `migration:undo` sobre `crm_e2e`.
- `dashboard.service.ts` sigue con 7 avisos de Prettier en código que ya estaba (firma de `daysBetween`, conteos y el cierre del archivo). No se reformateó: este paso no cambia backend.

## Cierre de pantalla (F1 y F2)

- F1: si el 400 trae `message` en arreglo, el modal muestra cada texto sin prefijos como `goals.2.`.
- F2: con metas vivas y los tres campos vacíos, Guardar queda deshabilitado y se lee «Para quitar las metas usa "Quitar metas del Q"». Sin metas y con los tres vacíos, Guardar sigue deshabilitado.
