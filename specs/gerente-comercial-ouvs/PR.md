# PR — Gerente Comercial en OUVs

## Resumen

El rol `Gerente Comercial` (con espacio) ya estaba en `roles`. Esta rama no lo crea ni lo renombra. En `/opportunities` entra viendo sus OUVs, puede ver las de otro comercial o todas, y el CSV usa ese filtro. Actúa sobre una OUV o un SQL solo cuando él es el comercial asignado. Lee la bitácora de cualquier OUV y no escribe en la de otro. La migración le agrega `manage_high_value` / `Account`.

## Decisiones

- El nombre vive en `commercial-role-names.js`. El cliente no compara roles: usa `ouv_board_default`, `can_create_direct_ouv` y `can_act_as_assigned_commercial`.
- Los guards de zona, alta directa, cita, conversión y descarte aceptan al Gerente solo si es el asignado. Evilio aprobó esa ampliación.
- «Limpiar» vuelve al default del usuario. Para el Gerente, a sus OUVs.
- El CSV de Soporte también respeta el filtro aplicado.
- El rol no entra a `BASE_ROLES` en este cambio. La propuesta está en `specs/decisions/2026-10-20-propuesta-gerente-comercial-base-roles.md`.

## Cambios por capa

- Backend. Constante, campos de `/auth/me`, catálogos, validaciones de asignación, `canReadOuv`, guards, migración `20261020120000`.
- Frontend. Default de la bandeja, textos, sufijo del selector, CSV, botón de crear, acciones de OUV y SQL, tooltip de alto valor.
- Specs. `specs/gerente-comercial-ouvs/` y los dos decision records del 2026-10-20.

## Migración

`20261020120000-gerente-comercial-manage-high-value.js`. Antes de correrla, en cada ambiente, confirmar la fila `Gerente Comercial` y sus usuarios. El detalle está en `DESPLIEGUE.md`.

## Cómo probar

Checklist: `QA-CHECKLIST.md`.

Backend, Paso 3: `npx jest --forceExit --no-coverage`. 75 suites, 519 tests, 499 en verde y 20 en rojo. Los 20 son `mep-contract-wiring.spec.ts` (`JWT_SECRET`), deuda previa.

Frontend, Paso 3: `npm run build`. `tsc -b && vite build`, 406 módulos, en verde.

Manual de Evilio, Paso 2: los 12 puntos del checklist, incluidos preventa en la bitácora y la edición de venta ganada.

## Deuda

- El rol sigue solo en la base de datos. Hay que aprobar aparte meterlo en `BASE_ROLES` con las 31 reglas actuales.
- `GET /discovery/ejecutivos-comerciales` no tiene consumidores y no se tocó.
- El tab «OUVs Asignadas» y los dashboards de calificación y de discovery no arrancan en «mis OUVs» para el Gerente.
- `mep-contract-wiring.spec.ts` sigue en rojo por `JWT_SECRET`.
