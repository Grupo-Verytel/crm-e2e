# RESUMEN-PASO-1 — Backend

**Fecha:** 2026-10-20
**Rama:** `EP-Feature-GerenteComercial`
**Commit de este paso:** no. Espera aprobación.
**Paso 0:** `2054293` `feat(gerente-comercial-ouvs): paso 0 — inventario y spec`

El nombre `Gerente Comercial` está solo en `backend/src/modules/auth/constants/commercial-role-names.js`. El resto importa `commercial-roles.ts`.

## Contratos

`GET /api/v1/auth/me` agrega:

| Campo | Gerente Comercial | EjecutivoComercial | SoporteComercial |
|---|---|---|---|
| `ouv_board_default` | `own` | `all` | `all` |
| `can_create_direct_ouv` | `true` | `true` | `false` |

`GET /api/v1/discovery/ouvs` no cambia de firma. El gerente no está en `OWN_PIPELINE_ROLES`, así que `all=true` lista todas y `comercial_id` filtra. El ejecutivo sigue con `all` forzado a falso.

`GET /api/v1/discovery/ouvs/ejecutivos-comerciales` devuelve activos de `EjecutivoComercial` y `Gerente Comercial`, orden `full_name` ASC:

```json
{ "user_id": "...", "full_name": "...", "role_name": "Gerente Comercial" }
```

`GET /api/v1/leads/appointment-commercials` devuelve el mismo conjunto (con `email`).

Reasignar OUV, asignar SQL, cita de SQL y cita de lead aceptan un activo de cualquiera de los dos roles.

Guards `sql.cita_reagendada`, `sql.convertido_ouv`, `sql.descartado`, `ouv.creada_directa`, `ouv.avance_zona` y `ouv.retroceso_zona`: el ejecutivo activo sigue pasando; el gerente activo pasa solo si es el comercial asignado.

`canReadOuv` deja leer la bitácora de cualquier OUV al gerente. Escribir en la de otro sigue en 403.

Migración `20261020120000-gerente-comercial-manage-high-value.js`: agrega solo `{ action: 'manage_high_value', subject: 'Account' }`. Si la fila no existe, avisa y sigue. El `down` quita solo esa regla. **No se ejecutó contra la base** en este paso.

## Deuda y lo que queda para el Paso 2

- `GET /api/v1/discovery/ejecutivos-comerciales` no se tocó.
- El tooltip del checkbox de alto valor queda para el Paso 2: «Solo Soporte Comercial, Administrador o Gerente Comercial pueden cambiar esta marca.»
- El CSV de `/opportunities` (Q5=A) es frontend. También cambia el de Soporte: hoy exporta todo lo que el rol puede leer; pasará a usar el filtro aplicado. Sin filtro, Soporte sigue exportando todas.
- El botón de crear OUV usa `can_create_direct_ouv` en el Paso 2. El cliente no compara nombres de rol.
- El tab de OUVs asignadas y los dos dashboards no cambian de corte.
- Meter el rol en `BASE_ROLES` se propone en un decision record aparte en el Paso 3.

## Tests

```
npx jest --testPathPatterns "src/modules/discovery|src/modules/qualification|src/modules/workflow-engine|src/modules/demand-generation|src/modules/auth" --no-coverage
```

Test Suites: 40 passed, 40 total. Tests: 247 passed, 247 total.

Tras el formato de los specs nuevos se volvió a correr el subconjunto (6 suites, 42 tests) en verde.

## curl de ejemplo

Sustituir `TOKEN`. El gerente de prueba en este ambiente es Miguel Rico o Dani Rodríguez.

```bash
curl -s -H "Authorization: Bearer TOKEN" http://localhost:3000/api/v1/auth/me

curl -s -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/v1/discovery/ouvs?all=true&comercial_id=USER_ID_DEL_GERENTE"

curl -s -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/v1/discovery/ouvs?all=true"

curl -s -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/v1/discovery/ouvs/ejecutivos-comerciales

curl -s -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/v1/leads/appointment-commercials
```

Como ejecutivo, el mismo `all=true` con un `comercial_id` ajeno sigue devolviendo solo las suyas.
