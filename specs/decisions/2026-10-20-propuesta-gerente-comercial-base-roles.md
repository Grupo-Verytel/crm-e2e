# 2026-10-20 — Propuesta: agregar Gerente Comercial a `BASE_ROLES`

Estado: propuesta. No está aprobada para implementar. Este cambio no modifica `role-permissions.js` ni crea el rol.

## Problema

El rol vive solo en la tabla `roles`. El nombre exacto es `Gerente Comercial` (con espacio). `BASE_ROLES` en `backend/database/seeders/lib/role-permissions.js` no lo incluye. Ningún seeder ni migración lo inserta. Un ambiente nuevo que solo corre el catálogo de código no tiene la fila, y la migración `20261020120000-gerente-comercial-manage-high-value.js` avisa y sigue sin crearla.

## Propuesta

Agregar el rol al catálogo de código con el nombre `Gerente Comercial`, sin renombrarlo a `GerenteComercial`, y con los permisos que la fila tiene después de la migración de alto valor (31 reglas). No derivarlos de las claves actuales de `MATRIX`: esa matriz no genera `Report` ni los sujetos `View:*`, y la fila sí los tiene.

Reglas a copiar, una vez cada una:

- `approve` / `Account`, `approve` / `Lead`
- `close` / `Opportunity`
- `create` / `Account`, `create` / `Opportunity`, `create` / `Report`
- `export` / `Report`
- `manage_high_value` / `Account`
- `read` / `Account`, `Billing`, `Lead`, `Opportunity`, `Presale`, `Pricing`, `Report`, `Service`
- `read` / `View:BANDEJA_FACTURACION`, `View:BANDEJA_MQL`, `View:BANDEJA_PMO`, `View:BANDEJA_PREVENTA`, `View:BANDEJA_PRICING`, `View:BANDEJA_SQL`, `View:CAMPANAS_LISTA`, `View:DASHBOARD_MARKETING`, `View:DASHBOARD_VENTAS`, `View:LEADS_LISTA`, `View:OUV_CERRADAS`, `View:PIPELINE_OUV`
- `update` / `Account`, `Opportunity`, `Report`

El seeder no debe reescribir una fila que ya exista con otros permisos. Si el nombre en ese ambiente no es exactamente `Gerente Comercial`, no debe insertar otra fila: hay que avisarle a Evilio.

## Fuera de esta propuesta

No se pide implementarlo en la rama `EP-Feature-GerenteComercial`. El despliegue de esta rama sigue exigiendo que la fila ya exista.
