# 2026-10-18 — Cuenta de alto valor (`accounts.is_high_value`)

Estado: aprobada con el Paso 0 (2026-10-18). Q1, Q2 y Q3 quedaron en A. Prevalece el repo cuando choca con el prompt (R3).

## D-PERM — Acción CASL propia, no permiso por campo

El permiso es `{ action: 'manage_high_value', subject: 'Account' }`.

CASL de este repo no soporta `fields`. `AppAbility` es `MongoAbility<[string, string]>` (`casl-ability.factory.ts:9`). `CaslPermissionRule` solo tiene `action`, `subject` y `conditions` opcionales (`casl-permission.interface.ts:1-5`). La fábrica llama `can(action, subject)` o `can(action, subject, conditions)` (`casl-ability.factory.ts:16-21`). El guard solo evalúa `ability.can(action, subject)` (`casl.guard.ts:39-41`). `@CheckAbility` no acepta campos (`check-ability.decorator.ts:3-6`).

El precedente ya usado para una acción fuera de CRUD es `{ action: 'schedule', subject: 'Lead' }`, agregado al final de `buildPermissions` para `SoporteComercial` y `Admin` (`role-permissions.js:211-213`).

**Descartado:** `update Account` con `fields: ['is_high_value']`. Exigiría cambiar la regla, la fábrica, el guard y el JSON de `roles.permissions`. Es más ancho que esta funcionalidad.

La comprobación vive en `AccountsService` (alta y edición), con el `request.ability` que arma `JwtAuthGuard` en cada request (`jwt-auth.guard.ts:68-78`). No hay lista de nombres de rol en el servicio.

## D-ROLES — Códigos reales; no se crea un rol

| Nombre del prompt | Código en `role-permissions.js` |
|---|---|
| Soporte Comercial | `SoporteComercial` (`:152`) |
| Administrador | `Admin` (`:136`). No existe `Administrador`. |
| Gerente Comercial | **No existe.** No está en `BASE_ROLES` (`:134-183`) ni en `spec-auth.md:61-62`. |

`CONSTITUTION.md` Artículo VI.1 prohíbe introducir un rol que no esté en el catálogo vigente. La mención de «Gerente Comercial» en `ouv-access.ts:17` es un ejemplo de cualquier rol que no sea `EjecutivoComercial`: `canReadAllOuvs('GerenteComercial')` pasa por eso (`ouv-access.spec.ts:13`), no porque el rol esté sembrado.

**Q1 = A.** `manage_high_value` lo reciben solo `SoporteComercial` y `Admin`. No se crea ningún rol. El tooltip del checkbox deshabilitado es: «Solo Soporte Comercial o Administrador pueden cambiar esta marca.»

Cuando «Gerente Comercial» entre al catálogo de roles por su propio decision record, se le agrega `manage_high_value` con una migración de datos. Este cambio no lo hace.

**Q2 = A.** El detalle de cuenta es el modal de edición (`AccountFormModal`), con `HighValueBadge` en su cabecera. En la lista, el ícono va junto al nombre. Sin ruta nueva.

**Q3 = A.** El ícono va en la tarjeta kanban, en la fila de la vista lista del tablero y en `OuvDetailHeaderCard`, junto al nombre de la empresa. `GET /qualification/assigned-ouvs` queda fuera de alcance.

El seeder `20250626120000-seed-base-roles.js:14-25` inserta roles que no existen y no reescribe `permissions` de los que ya existen. Re-ejecutarlo no actualiza ambientes desplegados. Hace falta, además del cambio en `buildPermissions`, una migración de datos idempotente del mismo estilo que `20260810180100-add-account-person-permissions.js` (lee `roles.permissions`, agrega la regla si falta). El JWT solo lleva `sub` y `role` (`jwt-auth.guard.ts:20-23`); el guard relee el JSON en cada request, así que el backend ve el permiso sin reemitir tokens. El checkbox del frontend usa `user.permissions` del login / `me`, así que esa sesión hay que recargarla.

## D-DATOS — Columna propia, sin herencia, sin índice

`accounts.is_high_value BOOLEAN NOT NULL DEFAULT false`. Las filas ya existentes quedan en `false` por el default. No hay índice: el listado filtra por `name` y `tax_id` (`accounts.service.ts:50-56`), no por esta marca.

No hay cuentas padre e hijas. No existe `parent_id` ni equivalente en `accounts`. D4 no cambia el esquema.

`ouvs.account_id` es FK nullable a `accounts.account_id` (`ouv.model.ts:85-91`, migración `20260810190500-restructure-ouv-contactos-account-id.js:55-69`). `empresa_nombre` es un snapshot (`ouv.model.ts:105-111`) y no se usa para decidir el ícono. Si `account_id` es nulo, o la cuenta no se encuentra (incluida una cuenta con `deleted_at`), la respuesta lleva `account_is_high_value: false`.

La respuesta de OUV agrega ese booleano. No anida la cuenta. La respuesta de cuenta agrega `is_high_value`. El resto de los campos no cambia (REQ-10).

Discovery no importa el modelo `Account`. Ya llama a `AccountsService` (`ouvs.service.ts:10`, `discovery.module.ts:55`). El flag de una página de OUVs sale de un solo método público nuevo que recibe los `account_id` de esa página y devuelve un mapa. Una consulta por request, no una por fila.

## D-UI — Sin diseño de referencia; token propio

`crm-e2e-DesignJD` no tiene checkbox, ícono ni token de cuenta de alto valor. Se propone sobre el design system actual.

Token `--high-value`, clase Tailwind `text-high-value`.

| Modo | Valor | Superficie | Contraste |
|---|---|---|---|
| Claro (`:root`) | `#4C3BCF` | `--surface` `#FFFFFF` (`tokens.css:19`) | 7.41:1 |
| Oscuro | `#C4B5FD` | `--surface` `#2A2A2A` (`tokens.css:76`) | 7.77:1 |

El oscuro va en los dos bloques que ya pisan el tema: `tokens.css` `:root[data-theme='dark']` y `global.css` `html[data-theme='dark']` (este gana por especificidad; el mismo patrón que `--semaphore-amarillo` en `global.css:21-22`).

El índigo no es `--brand-primary` `#0033A0`, ni `--semaphore-amarillo` (`#B8860B` / `#F0B429`), ni `--danger` `#C2362F`, ni el verde del semáforo. El claro `#4C3BCF` sobre `#2A2A2A` queda en 1.94:1; por eso el oscuro usa otro valor.

No hay página de detalle de cuenta. El detalle es el modal de edición. El ícono de OUV va en el kanban, en la fila de la lista del tablero y en la cabecera de detalle. `GET /qualification/assigned-ouvs` queda fuera: su DTO no trae `account_id` (`assigned-ouvs-response.dto.ts:3-13`).

Deuda, sin tocarla en este cambio: `docs/modelo-destino-migracion.md` debe incluir `is_high_value` cuando se ejecute la migración de Pipedrive.

El `DESPLIEGUE.md` del Paso 3 debe decir que, después de la migración de permisos, los usuarios afectados cierran sesión y vuelven a entrar para que el checkbox se habilite. El backend aplica el permiso en el request siguiente.
