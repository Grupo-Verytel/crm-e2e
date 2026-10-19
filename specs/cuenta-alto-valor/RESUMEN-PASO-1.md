# RESUMEN-PASO-1 — Backend

Fecha: 2026-10-18. Sin commit de este paso (se commitea al aprobarlo). Sin push.

El Paso 0 quedó en `aef1b79` — `feat(cuenta-alto-valor): paso 0 — inventario y spec`.

## Contratos

Prefijo `api/v1`.

| Método | Ruta | CASL que ya existía | Campo nuevo |
|---|---|---|---|
| `GET` | `/accounts` y `/accounts/:accountId` | `read Account` | respuesta `is_high_value: boolean` |
| `POST` | `/accounts` | `create Account` | body opcional `is_high_value?: boolean` |
| `PATCH` | `/accounts/:accountId` | `update Account` | body opcional `is_high_value?: boolean` |
| `GET` | `/discovery/ouvs` y `/discovery/ouvs/:id` | `read Opportunity` | respuesta `account_is_high_value: boolean` |

El resto de respuestas de OUV que ya devolvían `OuvResponseDto` (alta, edición, avance, cierre, presupuesto) también llevan `account_is_high_value`, para no dejar dos formas del mismo DTO.

Permiso nuevo, fuera de CRUD: `{ action: "manage_high_value", subject: "Account" }`. Lo tienen solo `SoporteComercial` y `Admin`. El servicio pregunta `ability.can`. No hay lista de roles en el código.

**403** si quien no tiene el permiso envía `is_high_value: true` en el alta, o en la edición un valor distinto al guardado. No se persiste ningún campo de ese request.

```json
{
  "code": "FORBIDDEN",
  "message": "No tienes permiso para cambiar la marca de alto valor."
}
```

Si el campo no viene, la edición sigue y no toca la columna. En el alta, omitirlo o mandar `false` guarda `false` sin exigir el permiso. `account_id` nulo, cuenta inexistente o cuenta con `deleted_at` responden `account_is_high_value: false`.

La lista de OUVs hace una sola consulta `WHERE account_id IN (...)` vía `AccountsService.findHighValueByAccountIds`. No hay `BelongsTo` nuevo en `Ouv`.

## Migraciones

- `backend/database/migrations/20261018120000-add-accounts-is-high-value.js` — `accounts.is_high_value BOOLEAN NOT NULL DEFAULT false`. Mira `information_schema` antes de agregar o quitar. Sin índice.
- `backend/database/migrations/20261018120100-account-high-value-permission.js` — agrega la regla a `SoporteComercial` y `Admin` si no está. El `down` quita solo esa regla de esos dos roles. El resto de reglas queda igual.

`buildPermissions` en `role-permissions.js` empuja la misma regla para instalaciones nuevas. El seeder no reescribe roles que ya existen; por eso hace falta la migración de datos.

Ciclo en local (development), las dos migraciones:

1. `migration:run` — ambas `migrated`.
2. Segunda llamada a `up` de cada archivo, ya aplicadas: no duplica la regla (`hits` sigue en 1) ni falla la columna.
3. `migration:undo` + `migration:undo` — permiso revertido, columna eliminada. `EjecutivoComercial` no tenía la regla ni antes ni después. `Admin` pasó de 95 reglas a 94 (solo se fue esta). `SoporteComercial` de 62 a 61.
4. `migration:run` otra vez — columna y permiso de vuelta.

Columna verificada: `tinyint(1) NOT NULL DEFAULT 0`. `COUNT` de `NULL` = 0. Estado local al cerrar el paso: migraciones aplicadas.

## Tests

`npx jest src/modules/accounts/services/account-high-value.spec.ts src/modules/discovery --no-coverage`

**14 suites, 75 tests, todos pasaron.** Los 14 nuevos están en `account-high-value.spec.ts` (12) y `ouv-high-value.spec.ts` (2). El resto son los specs de discovery que ya existían, incluida la creación de OUV.

Cubren: alta y edición con `SoporteComercial` y `Admin`; `EjecutivoComercial` con `true` → 403 y sin `create`/`update`; edición sin el campo deja la marca; lista y detalle de cuenta; una consulta por página de OUVs; `account_id` nulo → `false`; fila `audit_log` `UPDATE` con `campo_modificado = is_high_value`.

No había specs previos de `AccountsService`. La regresión de cuentas es este archivo nuevo más el hecho de que `findOrCreateAccountAndPerson` sigue llamando `createAccount` sin el campo (queda en `false`).

## Curl de ejemplo

No se levantó el servidor. El cuerpo es el del servicio y del DTO.

Alta con Soporte Comercial o Administrador:

```bash
curl -s -X POST http://localhost:3000/api/v1/accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Cliente Joya\",\"is_high_value\":true}"
```

Respuesta 201, con el resto de campos de siempre y `"is_high_value": true`.

El mismo body con un Ejecutivo Comercial:

```json
HTTP/1.1 403
{ "code": "FORBIDDEN", "message": "No tienes permiso para cambiar la marca de alto valor.", "statusCode": 403 }
```

Nest agrega `statusCode` al objeto que lanza `ForbiddenException`. No se crea la fila.

Edición sin la marca:

```bash
curl -s -X PATCH http://localhost:3000/api/v1/accounts/$ACCOUNT_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Cliente Joya SAS\"}"
```

`is_high_value` no cambia.

Listado de OUVs: cada ítem de `GET /api/v1/discovery/ouvs` incluye `account_is_high_value`.

## Archivos

- `backend/database/migrations/20261018120000-add-accounts-is-high-value.js`
- `backend/database/migrations/20261018120100-account-high-value-permission.js`
- `backend/database/seeders/lib/role-permissions.js`
- `backend/src/modules/accounts/models/account.model.ts`
- `backend/src/modules/accounts/dtos/accounts.dto.ts`
- `backend/src/modules/accounts/services/accounts.service.ts`
- `backend/src/modules/accounts/services/account-high-value.spec.ts`
- `backend/src/modules/accounts/controllers/accounts.controller.ts`
- `backend/src/modules/discovery/dtos/ouv-response.dto.ts`
- `backend/src/modules/discovery/services/ouvs.service.ts`
- `backend/src/modules/discovery/services/ouv-high-value.spec.ts`
- `backend/src/modules/discovery/controllers/ouvs.controller.ts`

## Para el Paso 3, sin hacerlo ahora

- `DESPLIEGUE.md`: después de la migración de permisos, quien deba ver el checkbox habilitado cierra sesión y vuelve a entrar. El backend ya aplica el permiso en el request siguiente, porque el guard relee `roles.permissions`.
- Deuda: `docs/modelo-destino-migracion.md` debe incluir `is_high_value` cuando se ejecute la migración de Pipedrive. No se tocó.
- Cuando exista el rol Gerente Comercial por su propio decision record, otra migración de datos le agrega `manage_high_value`.

## Riesgos

- `accounts.service.ts` ya tenía avisos de formato y un `prefer-const` ajenos a este cambio. No se reformateó ese código.
- El checkbox del frontend sigue sin existir. Hasta el Paso 2 la marca solo se puede poner por API.
- Quien ya tenía la sesión abierta no ve la regla nueva en `user.permissions` hasta volver a entrar. El 403 del servidor sí aplica de inmediato.
