# PR — Cuenta de alto valor

## Resumen

`accounts.is_high_value` marca una empresa. Solo `SoporteComercial` y `Admin` pueden cambiarla, con la acción CASL `manage_high_value` sobre `Account`. La OUV no copia la marca: `account_is_high_value` se lee de la cuenta, una consulta por página. En la UI es un `Gem` junto al nombre y un checkbox en el modal de la empresa, también cuando ese modal se abre desde el lead.

## Decisiones

- Solo `SoporteComercial` y `Admin`. No se crea `GerenteComercial`.
- El detalle de la cuenta es el modal de edición. No hay ruta nueva.
- El ícono va en la lista de cuentas, en la tarjeta y la fila del tablero de OUVs, y en la cabecera del detalle. `GET /qualification/assigned-ouvs` queda fuera.
- Sin permiso, el cliente no envía el campo. Un `true` o un cambio igual responden 403 y no guardan nada de ese request.
- `--high-value`: `#4C3BCF` en claro y `#C4B5FD` en oscuro, también en `html[data-theme='dark']`.

## Cambios por capa

- Backend. Columna, permiso en `buildPermissions` y migración de datos, DTOs de cuenta y `OuvResponseDto`, chequeo en `AccountsService`, lote en `OuvsService`.
- Frontend. Token, `HighValueBadge`, `canManageHighValue`, checkbox del modal, ícono en lista, kanban, fila y detalle.
- Specs. `specs/cuenta-alto-valor/` y `specs/decisions/2026-10-18-cuenta-alto-valor.md`.

## Migración

`20261018120000-add-accounts-is-high-value.js` y después `20261018120100-account-high-value-permission.js`. El orden lo da el timestamp de `migration:run`. El despliegue está en `DESPLIEGUE.md`.

## Cómo probar

Checklist: `QA-CHECKLIST.md`.

Backend, Paso 3: `npx jest --forceExit --no-coverage`. 72 suites, 487 tests, 467 en verde y 20 en rojo. Los 20 son `mep-contract-wiring.spec.ts` (`JWT_SECRET`), deuda previa.

Frontend, Paso 3: `npm run build`. `tsc -b && vite build`, 406 módulos, en verde.

Manual de Evilio, Paso 2: crear marcada, ver el ícono en Empresas y en la OUV (kanban de escritorio y móvil, lista y detalle), checkbox deshabilitado como Ejecutivo Comercial, desmarcar como Administrador, y crear la empresa desde el lead con y sin permiso.

## Deuda

- `docs/modelo-destino-migracion.md` no lista `is_high_value`. Hay que agregarlo cuando se ejecute la migración de Pipedrive.
- Cuando exista el rol Gerente Comercial, hay que darle `manage_high_value` con una migración de datos. No se crea el rol en este cambio.
- Los archivos de UI que ya existían siguen con avisos de lint `react-hooks` (setState dentro de un effect, refs): `AccountFormModal.tsx`, `AccountsListPage.tsx`, `OuvsBoardPage.tsx`, `OuvDetailHeaderCard.tsx` y `VentaGanadaDetailPage.tsx`. No son de esta marca y no se reescribieron.
