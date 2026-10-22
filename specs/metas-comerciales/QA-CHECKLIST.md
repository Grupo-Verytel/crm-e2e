# QA — Metas comerciales

Fecha: 2026-10-20. REQ-01 a REQ-10. La prueba manual de Evilio sigue pendiente (checklist del Paso 2). Las migraciones no se aplicaron en esta corrida (DA-14).

| Req | Cómo se probó | Evidencia | Resultado |
|---|---|---|---|
| REQ-01 | Test automático | `commercial-goals.service.spec.ts`: un alta válida devuelve comercial, año, Q, segmento y monto | OK en test. La tabla no se creó en la base de `.env` |
| REQ-02 | Test automático | El mismo spec: duplicado vivo → 409 `CONFLICT` con `existing_goal_id` y el mensaje que nombra Q, año y segmento. Un PATCH que pisa otra fila viva también. La carrera del índice único también responde 409 | OK en test |
| REQ-03 | Test automático | Comercial que `isActiveWithAnyRole` rechaza → 400 `VALIDATION` | OK en test |
| REQ-04 | Test automático | DTO: 0, negativo, decimal, Q 0 y 5, año 2019 y 2101. Segmento fuera de `listSegments()` → 400 | OK en test |
| REQ-05 | Test automático | `verytel-quarter.spec.ts`: 31 ene, 1 feb, 30 abr, 1 may, 31 jul, 1 ago, 31 oct, 1 nov, 31 dic. Texto `1 nov 2026 – 31 ene 2027`. El helper de UI repite la regla; no tiene runner | OK en backend. La pantalla queda en la prueba manual |
| REQ-06 | Revisión de código | El engranaje está en `/opportunities/dashboard` y solo mira `read CommercialGoal`. La ruta `/dashboard/metas-comerciales` redirige a `/opportunities` sin ese permiso | Código listo. Manual pendiente (puntos 1, 6 y 7) |
| REQ-07 | Test automático | `commercial-goals.permissions.spec.ts`: Soporte y Admin pasan `CaslGuard`. Ejecutivo, Gerente Comercial y Preventa reciben 403. Las cuatro acciones están en `buildPermissions` y en cada ruta | OK |
| REQ-08 | Test automático | `commercial-goal.audit.spec.ts`: INSERT, UPDATE de `amount_cop` (anterior y nuevo) y DELETE, con `usuario_id` del contexto | OK en test. La vista de Auditoría la confirma Admin en el punto 3 del manual. Soporte no entra a ese módulo (DA-08) |
| REQ-09 | Test automático y revisión de la migración | Tras el soft-delete el GET responde 404 y un alta de la misma combinación responde 201. El índice `uq_commercial_goals_active_natural` está en `20261020231000` | OK en test. El ciclo run/undo/run no se ejecutó (DA-14) |
| REQ-10 | Test automático | El listado manda `page`, `limit`, los cuatro filtros y el orden año desc, Q desc, comercial asc | OK en test |

## Suite del Paso 3

Backend, `npx jest --forceExit --no-coverage` en `backend/`:

`Test Suites: 1 failed, 78 passed, 79 total`

`Tests: 20 failed, 529 passed, 549 total`

Los 20 rojos son `mep-contract-wiring.spec.ts`: `JWT_SECRET` no está en el entorno del test. Es la misma deuda que en Gerente Comercial (allí 20 fallos de 519). El resto está en verde, incluidas las 4 suites nuevas (30 tests).

Frontend, `npm run build` en `frontend/`: `tsc -b && vite build`, 418 módulos, en verde.

## Prueba manual de Evilio

Pendiente. Los ocho puntos están en `RESUMEN-PASO-2.md`. Hay que correr antes las dos migraciones y volver a iniciar sesión como Soporte y como Admin.
