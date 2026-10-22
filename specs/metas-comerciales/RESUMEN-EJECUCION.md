# RESUMEN-EJECUCION — Metas comerciales

Fecha: 2026-10-20. Rama `EP-Feature-MetasComerciales`, desde `develop` con Gerente Comercial ya integrado. Sin push. No hubo bloqueo duro.

## Pasos y commits

| Paso | Commit | Mensaje |
|---|---|---|
| 0 | `3f02ce4` | `feat(metas-comerciales): paso 0 — inventario y spec` |
| 1 | `6b259c7` | `feat(metas-comerciales): paso 1 — backend` |
| 2 | `3472ff3` | `feat(metas-comerciales): paso 2 — frontend` |
| 3 | este commit | `docs(metas-comerciales): paso 3 — QA, despliegue y cierre` |

## Pruebas

- Paso 1. `verytel-quarter.spec.ts` y `commercial-goals`: 4 suites, 30 tests, en verde. `npm run build` del backend en verde. Migraciones no aplicadas (DA-14).
- Paso 2. `npm run build` del frontend: 418 módulos, en verde. ESLint de los archivos tocados, sin errores. Prueba manual no ejecutada.
- Paso 3, backend, `npx jest --forceExit --no-coverage`: `Test Suites: 1 failed, 78 passed, 79 total`. `Tests: 20 failed, 529 passed, 549 total`. Los 20 rojos son `mep-contract-wiring.spec.ts` por `JWT_SECRET`. La corrida de Gerente Comercial ya tenía esos 20 (sobre 519). Los 30 tests nuevos están en los 529 verdes.
- Paso 3, frontend, `npm run build`: `tsc -b && vite build`, 418 módulos, en verde.

## Decisiones autónomas

El detalle está en `DECISIONES-AUTONOMAS.md`. Evilio debe validar estas tres:

- **DA-01.** No hay ruta `/dashboard`. El engranaje está en `/opportunities/dashboard`. La pantalla es `/dashboard/metas-comerciales` y «← Dashboard» vuelve al tablero de OUVs.
- **DA-02.** La meta usa `segments.id`, incluido el segmento «Otros». No usa el ENUM `ouvs.segmento`.
- **DA-14.** No se corrió `migration:run` ni el `undo`. `DB_HOST` de `backend/.env` no es local.

También quedaron cerradas, y se pueden revertir como dice ese archivo: monto `DECIMAL(18,0)` con tope de entero seguro (DA-03), unicidad con `active_marker` (DA-04), sin `created_by` (DA-05), `<select>` nativo (DA-06), acceso denegado = redirección a `/opportunities` (DA-07), Soporte sin Auditoría (DA-08), módulo `commercial-goals` sin ítem de menú (DA-09), el 409 nombra Q, año y segmento y trae `existing_goal_id` (DA-10), dos textos de vacío (DA-11), la cifra abreviada siempre en millones o mil (DA-12) y los casos de trimestre solo en el backend (DA-13).

## Prueba manual pendiente

Checklist en `RESUMEN-PASO-2.md`, puntos 1 a 8 (incluye 5b). Antes: aplicar las dos migraciones y volver a iniciar sesión como Soporte y como Admin. El punto 3 (auditoría anterior → nuevo) lo confirma Admin, porque Soporte no abre el módulo de Auditoría.

## Deuda

- Migraciones `20261020231000` y `20261020231100` escritas y sin aplicar.
- Prueba manual de Evilio.
- El frontend no tiene runner de tests. El helper de trimestre de la UI no se ejecuta en CI.
- `mep-contract-wiring.spec.ts` sigue en rojo por `JWT_SECRET`. No es de esta rama.

## Mejora futura

Avance de la meta contra las ventas reales. Fuera de este alcance también quedaron copiar las metas del trimestre anterior, la carga masiva y el historial de cambios dentro de la pantalla.
