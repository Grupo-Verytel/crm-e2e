# RESUMEN-PASO-1 — Metas comerciales (backend)

Fecha: 2026-10-20. Rama `EP-Feature-MetasComerciales`. Build de Nest en verde. Tests nuevos en verde. La migración no se aplicó (DA-14).

## DDL

Tabla `commercial_goals` en `backend/database/migrations/20261020231000-create-commercial-goals.js`.

- `commercial_goal_id CHAR(36)` PK
- `user_id CHAR(36)` FK a `users.user_id`
- `fiscal_year SMALLINT`, `quarter TINYINT`, `segment_id CHAR(36)` FK a `segments.id`
- `amount_cop DECIMAL(18,0)`
- `created_at`, `updated_at`, `deleted_at`
- `active_marker TINYINT` generada: `IF(deleted_at IS NULL, 1, NULL)`
- único `uq_commercial_goals_active_natural (user_id, fiscal_year, quarter, segment_id, active_marker)`
- índices `idx_commercial_goals_fiscal_quarter` y `idx_commercial_goals_segment`

`down` elimina la tabla. Permisos en `20261020231100-commercial-goal-permissions.js`: agrega `create/read/update/delete` de `CommercialGoal` a `SoporteComercial` y `Admin`. El `down` quita solo esas reglas. La misma matriz quedó en `role-permissions.js` para un seed nuevo.

## Contratos

Prefijo `api/v1/commercial-goals`. Ability `CommercialGoal`.

| Método | Ruta | Ability |
|---|---|---|
| GET | `/commercial-goals` | read |
| GET | `/commercial-goals/summary?fiscal_year=` | read |
| GET | `/commercial-goals/:id` | read |
| POST | `/commercial-goals` | create |
| PATCH | `/commercial-goals/:id` | update |
| DELETE | `/commercial-goals/:id` | delete |

El 409 es `{ code: "CONFLICT", message, existing_goal_id }`. El mensaje nombra Q, año y segmento. Un 400 de negocio usa `{ code: "VALIDATION", message }`. El 404 usa `{ code: "NOT_FOUND", message }`.

El calendario está en `backend/src/common/time/verytel-quarter.ts` y reutiliza `bogota-day.ts`.

`DemandGenerationService.findSegmentNamesByIds` resuelve el nombre aunque el segmento ya no esté activo. El alta y la edición siguen exigiendo que esté en `listSegments()`.

## Pruebas

```
npx jest --forceExit --no-coverage src/common/time/verytel-quarter.spec.ts src/modules/commercial-goals --runInBand
Test Suites: 4 passed, 4 total
Tests:       30 passed, 30 total
```

Cubren REQ-01 a REQ-10 del servicio, el DTO (0, negativo, decimal, Q y año), el 403 de `CaslGuard` para Ejecutivo, Gerente Comercial y Preventa, el alta de Soporte y Admin, y la auditoría INSERT / UPDATE (`amount_cop` anterior y nuevo) / DELETE con `usuario_id`.

`npm run build` en `backend/`: prebuild + `nest build`, exit 0.

`npx eslint` sobre los archivos tocados: sin errores.

## Migración

No se ejecutó `migration:run`, `undo` ni un segundo `run`. `DB_HOST` de `backend/.env` no es localhost. R9 lo prohíbe. DA-14. Cuando haya una base local:

```bash
cd backend
npm run migration:run
npm run migration:undo
npm run migration:undo
npm run migration:run
```

Hacen falta dos `undo` porque este paso agrega dos migraciones (tabla y permisos). El segundo `run` las vuelve a aplicar.

## curl

Sustituir el token y los UUID. No se ejecutaron contra la base remota.

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/commercial-goals/summary?fiscal_year=2026"

curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/commercial-goals?fiscal_year=2026&quarter=4&page=1&limit=20"

curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"UUID\",\"fiscal_year\":2026,\"quarter\":4,\"segment_id\":\"UUID\",\"amount_cop\":1200000000}" \
  http://localhost:3000/api/v1/commercial-goals
```

## Archivos

- `backend/src/common/time/verytel-quarter.ts` y su spec
- `backend/src/modules/commercial-goals/**`
- `backend/database/migrations/20261020231000-create-commercial-goals.js`
- `backend/database/migrations/20261020231100-commercial-goal-permissions.js`
- `backend/database/seeders/lib/role-permissions.js`
- `backend/src/app.module.ts`
- `backend/src/modules/demand-generation/services/demand-generation.service.ts` (`findSegmentNamesByIds`)

## Riesgos

- Hasta correr las migraciones, Soporte y Admin que ya existen no tienen el permiso en `roles.permissions`. Hay que cerrar sesión y volver a entrar después.
- Editar una meta cuyo segmento se desactivó después responde 400: la edición vuelve a exigir el catálogo activo.
- Una suma de metas por encima de `Number.MAX_SAFE_INTEGER` no es un caso de negocio esperado. Cada meta está topeada a ese entero; el resumen conserva el string de dígitos que devuelve MySQL cuando viene sin notación científica.
- El engranaje y la pantalla todavía no existen (Paso 2).

## Cómo probar

1. En una base local, el ciclo de migraciones de arriba.
2. Entrar como Soporte (después de reiniciar sesión) y repetir el curl de alta, el duplicado (409) y el delete + alta otra vez.
3. Como Ejecutivo, el mismo POST debe responder 403.
