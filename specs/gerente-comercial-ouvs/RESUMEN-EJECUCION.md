# RESUMEN-EJECUCION — Gerente Comercial en OUVs

Fecha: 2026-10-20. Rama `EP-Feature-GerenteComercial`, desde `EP-Feature-Remember`. Sin push. No hubo AJ.

## Pasos y commits

| Paso | Commit | Mensaje |
|---|---|---|
| 0 | `20542936a7c92abefc98ff17fd3cffb807d73284` | `feat(gerente-comercial-ouvs): paso 0 — inventario y spec` |
| 1 | `edfb4fa8eda5a64c4435993cea87bad20c26e613` | `feat(gerente-comercial-ouvs): paso 1 — backend` |
| 2 | `99596cff8016adb72d52a0b69f974d26fc239a8c` | `feat(gerente-comercial-ouvs): paso 2 — frontend` |
| 3 | este commit | `docs(gerente-comercial-ouvs): paso 3 — QA, despliegue y cierre` |

## Archivos por paso

- Paso 0. `spec.md`, `specs/decisions/2026-10-20-gerente-comercial-rol-existente.md`, `RESUMEN-PASO-0.md`.
- Paso 1. Constante del rol, `/auth/me`, catálogos, asignación, `canReadOuv`, guards, migración `20261020120000`, specs de regresión, `RESUMEN-PASO-1.md`.
- Paso 2. Bandeja, CSV, selectores, bitácora, detalle de OUV y de SQL, venta ganada, tooltip, `can_act_as_assigned_commercial`, `RESUMEN-PASO-2.md`.
- Paso 3. `AGENTS.md`, la frase de «Limpiar» en el spec, `QA-CHECKLIST.md`, `DESPLIEGUE.md`, `PR.md`, `specs/decisions/2026-10-20-propuesta-gerente-comercial-base-roles.md`, este archivo.

## Pruebas

- Paso 1. Regresión de discovery, calificación, workflow, demanda y auth: 40 suites, 247 tests, en verde. Migración local: 30 reglas, `up` a 31, `undo` a 30, segundo `up` a 31. La única regla nueva es `manage_high_value` / `Account`.
- Paso 2. `npm run build` en verde. Prueba manual de Evilio, 12 puntos, incluidos preventa en la bitácora y la edición de venta ganada del Gerente.
- Paso 3, backend, `npx jest --forceExit --no-coverage`: `Test Suites: 1 failed, 74 passed, 75 total`. `Tests: 20 failed, 499 passed, 519 total`. Los 20 rojos son `mep-contract-wiring.spec.ts`: `AuthModule` pide `JWT_SECRET` y el test no lo cubre. La corrida de cuenta de alto valor ya tenía esos 20. El resto está en verde.
- Paso 3, frontend, `npm run build`: `tsc -b && vite build`, 406 módulos, en verde.

## Deuda

- El rol no está en `BASE_ROLES`. La propuesta, sin implementar, está en `specs/decisions/2026-10-20-propuesta-gerente-comercial-base-roles.md`.
- `GET /discovery/ejecutivos-comerciales` no tiene consumidores y no se modificó.
- El tab «OUVs Asignadas» y los dashboards de calificación y de discovery no tienen el default «mis OUVs» para el Gerente.
- `mep-contract-wiring.spec.ts` sigue en rojo por `JWT_SECRET`. No es de esta rama.
