# Spec — Cuenta de alto valor

**Versión:** 1.0
**Fecha:** 2026-10-18
**Estado:** Aprobado (Paso 0, Q1–Q3 = A).
**Decisión:** `specs/decisions/2026-10-18-cuenta-alto-valor.md`

---

## 1. Objetivo

Marcar una cuenta como cuenta de alto valor al crearla o editarla, y mostrar un ícono `Gem` en las OUVs de esa cuenta, en la lista de cuentas y en el detalle de la cuenta.

## 2. Alcance

Dentro:

- Columna `accounts.is_high_value`.
- Permiso CASL `manage_high_value` sobre `Account`, en la matriz y en una migración de datos para ambientes ya sembrados.
- Rechazo 403 de la operación completa cuando alguien sin ese permiso intenta cambiar la marca.
- Campo nuevo en las respuestas de cuenta y en las respuestas de OUV que alimentan el tablero y el detalle.
- Checkbox en el modal de alta y de edición. Ícono en las superficies de la sección 6.
- Auditoría por los hooks que ya existen. Sin filas de `audit_log` escritas a mano.

Fuera:

- Crear el rol Gerente Comercial (Artículo VI.1 de `CONSTITUTION.md`).
- Herencia entre cuentas. No hay modelo padre/hijo.
- Filtro, índice o bandeja de cuentas de alto valor.
- Ícono en `GET /api/v1/qualification/assigned-ouvs`, en leads, en personas o en otras tarjetas que solo muestran `empresa_nombre`.
- Página nueva de detalle de cuenta, salvo que Q2 elija lo contrario.
- Inferir la marca comparando `ouvs.empresa_nombre` con `accounts.name`.

## 3. Modelo

```sql
ALTER TABLE accounts
  ADD COLUMN is_high_value BOOLEAN NOT NULL DEFAULT false;
```

En MySQL 8, `BOOLEAN` es `TINYINT(1)`. El default cubre las filas ya existentes, incluidas las que lleguen de una carga que nombre columnas y omita esta. No hay script de Pipedrive en el repo que inserte en `accounts`. El seeder de demo nombra columnas y no incluye la nueva (`20260902010000-seed-account-profile-dummy.js:72-83`); el default aplica.

Sin índice.

`findOrCreateAccountAndPerson` crea cuentas sin este campo (`accounts.service.ts:347-350`). Esas altas siguen en `false` y no pasan por la regla de permiso.

## 4. Permiso

Acción `manage_high_value`, sujeto `Account`. Ver la decisión D-PERM.

La regla se agrega a `SoporteComercial` y `Admin` en `buildPermissions`, y una migración de datos re-ejecutable la inserta en `roles.permissions` de esos dos roles si no está. No se duplica ni se tocan otras reglas. El `down` quita solo esa regla de esos dos roles. El servicio no compara nombres de rol. No se crea `GerenteComercial`. Cuando ese rol entre al catálogo por su propio decision record, otra migración de datos le agrega `manage_high_value`.

El controller de cuentas hoy no recibe al usuario (`accounts.controller.ts:46-57`). El Paso 1 le pasa el `ability` del request al servicio. `create` y `update` de cuenta siguen exigiendo `create Account` y `update Account`. El permiso nuevo no reemplaza esos.

## 5. Contratos

Prefijo `api/v1` (`main.ts:91`).

### 5.1 Cuenta

`AccountResponseDto` suma `is_high_value: boolean`. El resto queda igual (`accounts.dto.ts:88-97`).

| Método | Ruta | CASL que ya existe | Cuerpo nuevo |
|---|---|---|---|
| `GET` | `/api/v1/accounts` | `read Account` | — |
| `GET` | `/api/v1/accounts/:accountId` | `read Account` | — |
| `POST` | `/api/v1/accounts` | `create Account` | `is_high_value?: boolean` |
| `PATCH` | `/api/v1/accounts/:accountId` | `update Account` | `is_high_value?: boolean` |

`is_high_value` es opcional. Si no viene, el alta guarda `false` y la edición no toca la columna. Un valor que no es booleano sigue el 400 del `ValidationPipe` global; este spec no cambia esa forma.

**403 nuevo**, antes de cualquier `INSERT` o `UPDATE`:

```json
{ "code": "FORBIDDEN", "message": "No tienes permiso para cambiar la marca de alto valor." }
```

Se dispara cuando el actor no tiene `manage_high_value` sobre `Account` y:

- en el alta, envía `is_high_value: true`, o
- en la edición, envía `is_high_value` con un valor distinto al persistido.

Enviar `false` en el alta, u omitir el campo, o enviar en la edición el mismo valor que ya tiene la cuenta, no dispara el 403. Si el 403 se dispara, no se guardan los demás campos del mismo request.

Código `FORBIDDEN` ya existe en `AUTH_ERROR_CODES` (`auth.constants.ts:11`).

### 5.2 OUV

`OuvResponseDto` (`ouv-response.dto.ts:1-49`) suma `account_is_high_value: boolean`.

Lo incluyen:

- `GET /api/v1/discovery/ouvs` (`ouvs.controller.ts:67-83`), que alimenta el kanban y la lista de `OuvsBoardPage`.
- `GET /api/v1/discovery/ouvs/:id` (`ouvs.controller.ts:94-99`), que alimenta `OuvDetailHeaderCard`.

El servicio junta los `account_id` de las filas de esa respuesta y pregunta una vez a `AccountsService`. No hay `include` del modelo `Account` desde discovery. `toResponse` (`ouvs.service.ts:1031`) no debe consultar la cuenta por fila.

## 6. UI

No hay diseño de esta función en `crm-e2e-DesignJD`. Se usa el design system de `crm-e2e`.

Token `--high-value` y clase `text-high-value`, con los valores de la decisión D-UI. Ícono `Gem` de lucide-react. `title` y `aria-label`: «Cuenta de alto valor». Componente presentacional `HighValueBadge` en `frontend/src/components/`.

El checkbox «Cuenta de alto valor» vive en `AccountFormModal`, que es el alta y la edición (`AccountFormModal.tsx:45-55`). También lo abre el formulario de lead; es el mismo componente. Habilitado si `user.permissions` contiene `manage_high_value` / `Account`, con el mismo patrón que el borrado (`AccountsListPage.tsx:22-26`). No hay helper `hasPermission`. Si no tiene el permiso, el checkbox se ve deshabilitado, con el tooltip de D5 ajustado a los roles que Q1 confirme, y el campo no se envía.

Superficies del ícono (Q2 = A, Q3 = A):

- Lista de empresas, junto al nombre (`AccountsListPage.tsx:131`).
- Detalle: cabecera del modal de edición (`AccountFormModal`). No hay ruta nueva (`AppRoutes.tsx:355` es solo `/accounts/empresas`).
- Tarjeta kanban de la OUV, junto a `empresa_nombre` (`OuvsBoardPage.tsx:615-617`).
- Fila de la vista lista del mismo tablero (`OuvsBoardPage.tsx:542-544`).
- Cabecera de detalle de la OUV, junto a la organización (`OuvDetailHeaderCard.tsx:288-292`).

`GET /qualification/assigned-ouvs` queda fuera de alcance.

El 403 se muestra como «No tienes permiso para cambiar la marca de alto valor.»

## 7. Requisitos EARS

- **REQ-01 (Ubicuo).** Cada cuenta deberá tener `is_high_value`, por defecto `false`.
- **REQ-02 (Evento).** Cuando un usuario con `manage_high_value` sobre `Account` cree o edite una cuenta enviando `is_high_value`, el sistema deberá guardar ese valor.
- **REQ-03 (No deseado).** Si un usuario sin ese permiso envía `is_high_value: true` en el alta, o en la edición un valor distinto al actual, el sistema deberá rechazar la operación completa con 403 `{ code: "FORBIDDEN", message: "No tienes permiso para cambiar la marca de alto valor." }` y no deberá persistir ningún campo de ese request. Si no envía el campo, la edición deberá continuar y dejar `is_high_value` como está.
- **REQ-04 (Ubicuo).** Un cambio de `is_high_value` deberá quedar en `audit_log` por `AuditHooksService`: el alta en el `INSERT` del registro (`audit-hooks.service.ts:37-45`) y la edición en una fila `UPDATE` con `campo_modificado = is_high_value` (`:47-66`). El servicio no escribe esa tabla.
- **REQ-05 (Ubicuo).** Las respuestas de lista y detalle de cuenta, y las de `GET /discovery/ouvs` y `GET /discovery/ouvs/:id`, deberán incluir la marca de la cuenta. La lista de OUVs deberá resolverla con una consulta para el conjunto de `account_id` de la página, no con una consulta por fila.
- **REQ-06 (Estado).** Mientras `account_is_high_value` sea verdadero, la tarjeta de esa OUV deberá mostrar `Gem` con tooltip y `aria-label` «Cuenta de alto valor». Si `account_id` es nulo o la cuenta no está activa, el valor es `false` y el ícono no se muestra.
- **REQ-07 (Estado).** Mientras una cuenta tenga `is_high_value` verdadero, la lista de cuentas y el detalle de la cuenta deberán mostrar el mismo ícono.
- **REQ-08 (Ubicuo).** La marca de una cuenta no deberá copiarse ni leerse desde otra cuenta. No hay relación padre/hijo que mantener.
- **REQ-09 (Estado).** Mientras el usuario tenga `manage_high_value` sobre `Account`, el checkbox «Cuenta de alto valor» deberá estar habilitado en el alta y en la edición. Si no lo tiene, deberá verse deshabilitado, con el tooltip «Solo Soporte Comercial o Administrador pueden cambiar esta marca.», y el cliente no deberá enviar el campo.
- **REQ-10 (Ubicuo).** Las respuestas de cuenta y de OUV que ya existen deberán conservar sus campos y su significado. Solo se agregan `is_high_value` y `account_is_high_value`.

## 8. Criterios de aceptación

1. Tras la migración, `information_schema` muestra `accounts.is_high_value` no nulo, default `false`, y un `COUNT` de filas con `NULL` es 0. Una segunda corrida de `up` no falla. `down` quita la columna y un `up` posterior la vuelve a crear.
2. `SoporteComercial` y `Admin` pueden crear una cuenta con `is_high_value: true` y pueden pasar una cuenta de `true` a `false` y de `false` a `true`. Ningún otro rol recibe `manage_high_value` en este cambio.
3. Un rol con `create`/`update` de `Account` pero sin `manage_high_value` (por ejemplo `EjecutivoComercial`, `role-permissions.js:64-67`) recibe 403 al enviar `true` en el alta o un valor distinto en la edición, y la fila queda como antes del request.
4. Ese mismo rol puede editar `name` sin enviar `is_high_value`, y la marca no cambia.
5. `GET /accounts`, `GET /accounts/:id`, `GET /discovery/ouvs` y `GET /discovery/ouvs/:id` incluyen el campo nuevo. En un listado de varias OUVs de cuentas distintas, el número de consultas a `accounts` para la marca no crece con la cantidad de filas.
6. Al cambiar la marca, `audit_log` tiene una fila `accounts` / `UPDATE` / `is_high_value` con el valor anterior y el nuevo.
7. Una OUV con `account_id` nulo responde `account_is_high_value: false`.
8. Dos cuentas no comparten la marca por ningún vínculo de parentesco, porque ese vínculo no existe.
