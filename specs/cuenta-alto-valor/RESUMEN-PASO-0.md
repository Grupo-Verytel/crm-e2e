# RESUMEN-PASO-0 — Inventario y spec (sin código)

Fecha: 2026-10-18. Repo: `crm-e2e`. No se modificó código ni `crm-e2e-DesignJD`.

Cuando el prompt contradice el repo, gana el repo (R3). Esos choques están marcados **REPO**.

No hay `NOTAS-BLOQUEO-0.md`. `ouvs.account_id` sí es FK a `accounts`, así que el ícono se puede resolver sin comparar nombres.

Spec: `specs/cuenta-alto-valor/spec.md`. Decisión: `specs/decisions/2026-10-18-cuenta-alto-valor.md`.

---

## Hallazgos

### 1. `accounts`

| Pieza | Dónde |
|---|---|
| Modelo | `backend/src/modules/accounts/models/account.model.ts:15-60`. Tabla `accounts`, `paranoid: true`, PK `account_id`. Columnas: `name`, `tax_id`, `economic_sector`, `address`, `website`, timestamps, `deleted_at`. No tiene `is_high_value`. |
| Alta de tabla | `backend/database/migrations/20260810180000-create-accounts-people.js:6-31` |
| Perfil | `backend/database/migrations/20260902000000-add-account-profile-fields.js` agrega sector, dirección y sitio |
| DTOs | `backend/src/modules/accounts/dtos/accounts.dto.ts:33-97`. Alta, edición y respuesta no traen la marca. |
| Servicio | `backend/src/modules/accounts/services/accounts.service.ts:59-120` lista, obtiene, crea y edita. `toAccountDto` en `:714-724`. |
| Errores | `backend/src/modules/accounts/constants/accounts.constants.ts:1-13`. No hay código de permiso. |

Endpoints, prefijo `api/v1` (`backend/src/main.ts:91`):

| Método | Ruta | CASL | Controller |
|---|---|---|---|
| `GET` | `/api/v1/accounts` | `read Account` | `accounts.controller.ts:27-34` |
| `GET` | `/api/v1/accounts/:accountId` | `read Account` | `:36-42` |
| `POST` | `/api/v1/accounts` | `create Account` | `:44-49` |
| `PATCH` | `/api/v1/accounts/:accountId` | `update Account` | `:51-58` |
| `DELETE` | `/api/v1/accounts/:accountId` | `delete Account` | `:60-67` |

El controller no recibe al usuario. El `ability` ya está en el request (`jwt-auth.guard.ts:77-78`).

No hay `accounts.service.spec.ts`.

### 2. OUV → cuenta

**Hay FK.** `ouvs.account_id CHAR(36) NULL` → `accounts.account_id` (`ouv.model.ts:85-91`; migración `20260810190500-restructure-ouv-contactos-account-id.js:55-69`, índice `ouvs_account_id_idx`).

`empresa_nombre` es un snapshot aparte (`ouv.model.ts:105-111`). No sirve para el ícono.

El modelo `Ouv` no tiene `BelongsTo` hacia `Account`. Discovery ya usa el servicio público (`ouvs.service.ts:10`, `discovery.module.ts:55`). `toResponse` no carga la cuenta (`ouvs.service.ts:1031`).

La tarjeta y la lista del tablero salen de `GET /api/v1/discovery/ouvs` (`ouvs.controller.ts:67-83`). El detalle sale de `GET /api/v1/discovery/ouvs/:id` (`:94-99`). El DTO de respuesta está en `ouv-response.dto.ts:1-49` y no trae la marca.

`account_id` puede ser nulo (Vías 2/3/4, comentario en `ouv.model.ts:85`). En ese caso el ícono no se muestra.

### 3. Padre e hija

**REPO.** No hay `parent_id` ni otra FK de cuenta a cuenta. D4 no pide columnas ni lógica. Cada fila guarda su propia marca.

### 4. Frontend

| Superficie | Componente | Notas |
|---|---|---|
| Alta y edición | `frontend/src/modules/accounts/components/AccountFormModal.tsx:45-55` | Un solo modal. También lo abre el formulario de lead. |
| Lista | `frontend/src/modules/accounts/pages/AccountsListPage.tsx:120-149` | Ruta `/accounts/empresas` (`AppRoutes.tsx:355`). |
| Detalle | **No existe.** | La fila abre el modal de edición (`AccountsListPage.tsx:149`) o el de contactos. |
| Tarjeta kanban de OUV | `frontend/src/modules/discovery/pages/OuvsBoardPage.tsx:605-643` | Junto a `empresa_nombre` en `:615-617`. |
| Lista del mismo tablero | `OuvsBoardPage.tsx:542-544` | Misma respuesta que el kanban. |
| Cabecera de detalle | `frontend/src/modules/discovery/components/OuvDetailHeaderCard.tsx:200-292` | La organización está en `:288-292`. El consecutivo es el título del layout (`OuvDetailPage.tsx:570`). |

Permisos en UI: no hay `hasPermission`. El patrón real es `user.permissions.some(p => p.action === '…' && p.subject === '…')` (`AccountsListPage.tsx:22-26`). El tipo es `CaslPermissionRule` (`frontend/src/modules/auth/types.ts:7-11`), sin `fields`.

`GET /api/v1/qualification/assigned-ouvs` lista OUVs en una tabla (`AssignedOuvsTable.tsx`), no en una tarjeta. Su DTO no tiene `account_id` (`assigned-ouvs-response.dto.ts:3-13`). Queda fuera de D3.

### 5. CASL y roles

**REPO — no hay permiso por campo.** Ver decisión D-PERM. La acción propia es la que cabe.

**Mecanismo recomendado:** `{ action: 'manage_high_value', subject: 'Account' }`, comprobado en el servicio con `ability.can`, no con una lista de roles.

Códigos reales en `backend/database/seeders/lib/role-permissions.js`:

| Prompt | Código | Cuentas hoy |
|---|---|---|
| Soporte Comercial | `SoporteComercial` (`:152`) | `CRUD` (`:89`) |
| Administrador | `Admin` (`:136`). No existe `Administrador`. | `CRU` (`:38`) |
| Gerente Comercial | **No está** en `BASE_ROLES` (`:134-183`) ni en `spec-auth.md:61-62`. | — |

**REPO.** Crear `GerenteComercial` chocaría con el Artículo VI.1 de `CONSTITUTION.md` (`:46`). El comentario de `ouv-access.ts:17` y el test `ouv-access.spec.ts:13` no siembran ese rol: cualquier nombre que no sea ejecutivo comercial pasa `canReadAllOuvs`.

Cómo entra un permiso nuevo:

1. Agregarlo en `buildPermissions`, como `schedule` / `Lead` (`role-permissions.js:211-213`), para instalaciones nuevas.
2. Migración de datos que actualice `roles.permissions`, como `20260810180100-add-account-person-permissions.js:24-64`. El seeder `20250626120000-seed-base-roles.js:14-25` no reescribe roles que ya existen. Volver a correrlo no alcanza en un ambiente desplegado.

El guard lee `roles.permissions` en cada request (`jwt-auth.guard.ts:58-78`). El checkbox del cliente depende de la sesión cargada en el login / `me`.

Roles con `create`/`update` de `Account` que no deberían recibir la acción, salvo que Q1 diga otra cosa: `EjecutivoComercial`, `DirectorMercadeo`, `GestorMercadeo`, `ProductManager`, `Pricing`, `PMO`, `FyA`, `Cliente` (`role-permissions.js:51-131`). `TraductorDeNegocio` solo tiene `read`.

### 6. Cargas que insertan en `accounts`

No hay script de Pipedrive en el repo. El mapa de migración nombra columnas y no incluye la nueva (`docs/modelo-destino-migracion.md:47-62`). El seeder de demo inserta por nombre de columna y omite la marca (`20260902010000-seed-account-profile-dummy.js:72-83`). Un `DEFAULT false` no rompe esos `INSERT`. `findOrCreateAccountAndPerson` tampoco envía el campo (`accounts.service.ts:347-350`).

### 7. Diseño en `crm-e2e-DesignJD`

No hay piezas de esta funcionalidad (ni checkbox, ni `Gem`, ni token). Las pantallas equivalentes, sin la marca, son las mismas rutas de cuentas y de OUV. Se propone con los tokens y las tarjetas que ya usa `crm-e2e`.

### 8. Color

Semáforo y peligro, para no repetirlos (`tokens.css:31-38` y `:90`; `global.css:21-22`):

- `--semaphore-verde`: mezcla de turquesa y `#2F9E44`
- `--semaphore-amarillo`: `#B8860B` en claro, `#F0B429` en oscuro
- `--danger`: `#C2362F`
- `--brand-primary`: `#0033A0` (no es semáforo, pero tampoco debe ser el color del ícono)

Superficie: `#FFFFFF` en claro (`tokens.css:19`), `#2A2A2A` en oscuro (`tokens.css:76`).

Propuesta `--high-value`:

| Modo | Hex | Contraste sobre `--surface` |
|---|---|---|
| Claro | `#4C3BCF` | 7.41:1 |
| Oscuro | `#C4B5FD` | 7.77:1 |

Los dos superan 3:1. El valor claro sobre la superficie oscura cae a 1.94:1, así que el bloque oscuro tiene que pisar el token. Hay que declararlo en `:root`, en `:root[data-theme='dark']` y en `html[data-theme='dark']` de `global.css`, porque ese último selector gana. La clase nueva en `frontend/tailwind.config.js` sería `text-high-value`, al lado de las de `:13`.

---

## Decisiones que el spec ya cierra

- Acción `manage_high_value` / `Account`. Sin `fields`.
- Columna `BOOLEAN NOT NULL DEFAULT false`. Sin índice. Sin herencia.
- Respuesta de cuenta: `is_high_value`. Respuesta de OUV: `account_is_high_value`. Sin anidar la cuenta.
- Una consulta por página de OUVs, vía `AccountsService`.
- 403 `{ code: "FORBIDDEN", message: "No tienes permiso para cambiar la marca de alto valor." }` y no se guarda nada de ese request.
- Si el campo no viene, la edición no lo toca. `false` en el alta no exige el permiso.
- Auditoría solo por `AuditHooksService`.

---

## Cierre (2026-10-18)

Q1 = A, Q2 = A, Q3 = A. Quedó anotado en `specs/decisions/2026-10-18-cuenta-alto-valor.md`.

Deuda, sin tocarla: `docs/modelo-destino-migracion.md` debe incluir `is_high_value` cuando se ejecute la migración de Pipedrive. El `DESPLIEGUE.md` del Paso 3 debe pedir cerrar sesión y volver a entrar después de la migración de permisos.

## Preguntas abiertas (respondidas)

### Q1 — Gerente Comercial no es un rol del repo

El prompt nombra tres roles. Solo existen `SoporteComercial` y `Admin`. Crear `GerenteComercial` contradice el Artículo VI.1.

- **A (recomendada).** El permiso lo reciben `SoporteComercial` y `Admin`. No se crea rol. El tooltip queda: «Solo Soporte Comercial o Administrador pueden cambiar esta marca.»
- **B.** Además de esos dos, dárselo a `DirectorMercadeo`, que sí existe (`role-permissions.js:51`). El tooltip incluye «Director de Mercadeo».
- **C.** Parar este cambio hasta un decision record que incorpore Gerente Comercial al catálogo. Este paso no crea el rol.

### Q2 — No hay pantalla de detalle de cuenta

D3 y REQ-07 piden el ícono en el detalle. La UI solo tiene lista y modal.

- **A (recomendada).** El detalle es el modal de edición, con el ícono en su cabecera, y la lista lo muestra junto al nombre. No hay ruta nueva.
- **B.** Crear `/accounts/empresas/:accountId`. Amplía el alcance.

### Q3 — Dónde está «la tarjeta de OUV»

El tablero tiene tarjeta kanban y tabla. El detalle tiene otra tarjeta de cabecera. Las tres leen el mismo DTO de OUV.

- **A (recomendada).** Ícono en la tarjeta kanban, en la fila de la vista lista del tablero y en la cabecera de detalle, junto al nombre de la empresa.
- **B.** Solo en la tarjeta kanban.
- **C.** Kanban y cabecera de detalle, no en la tabla.

`GET /qualification/assigned-ouvs` no entra en ninguna opción. Si debe entrar, hace falta decirlo aparte: hoy esa respuesta no trae `account_id`.

---

## Cómo probar este paso

Lectura de los tres documentos. No hay migración, test ni pantalla que ejecutar.

## Riesgos

- Aprobar el Paso 1 sin Q1 dejaría el permiso en dos roles y el tooltip del prompt nombraría un tercero que el sistema no tiene.
- El seeder no actualiza permisos viejos. Sin la migración de datos, un ambiente ya desplegado no vería `manage_high_value` aunque la matriz del archivo sí lo tenga.
- `docs/modelo-destino-migracion.md:47-62` quedará desactualizado cuando exista la columna. No se toca en este paso.
