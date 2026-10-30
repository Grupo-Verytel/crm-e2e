# RESUMEN-CIERRE-2A — Tablero de OUVs

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes`
**Commit:** `3da81ee6ba34bc52debd6409735522b1e9ffc851`
**Mensaje:** `feat(discovery): cortes por segmento, win rate por monto y detalle en tablero de OUVs`
**Push:** no. Queda a la espera de aprobación.

Este archivo queda fuera de ese commit porque cita su hash. Los otros `RESUMEN-PASO-*.md` sí entraron: el repo ya versiona resúmenes del mismo tipo (`specs/cuenta-alto-valor/`, `specs/metas-comerciales/`, `specs/gerente-comercial-ouvs/`) y `.gitignore` no los excluye.

## 1. Build y lint

| Paquete | Script | Resultado |
|---|---|---|
| Backend | `prebuild` (`node scripts/sync-openapi.js`) + `build` (`nest build`) | Exit 0 |
| Backend | `lint` (`eslint "{src,apps,libs,test}/**/*.ts" --fix`) | Exit 1. 480 problemas (414 errores, 66 avisos), previos a esta rama |
| Frontend | `build` (`tsc -b && vite build`) | Exit 0 |
| Frontend | `lint` (`eslint .`) | Exit 1. 58 problemas (51 errores, 7 avisos), previos a esta rama salvo el de esta página |

El lint del backend, por el `--fix` del script, reescribió archivos ajenos al tablero. Esos cambios se revirtieron con `git restore` y no están en el commit.

En archivos de esta rama el lint acotado (sin `--fix`) queda en exit 0, después de dos correcciones:

- Se quitó el import sin uso de `VerytelQuarter` en `ouv-dashboard-metrics.ts`.
- En `OuvDashboardPage.tsx`, el efecto del detalle dejó de llamar `setState` en el mismo tick: los filtros van en `useCallback` y la bandera de carga se actualiza en `setTimeout(0)`.

Los tests del tablero (`ouv-dashboard-metrics.spec.ts` y `ouv-dashboard.service.spec.ts`) pasan: 2 suites, 18 tests.

## 2. `lost_by_executive`

Búsqueda en el repo: cero coincidencias en backend, frontend, DTOs, tipos y specs.

## 3. Regresión contra `develop`

`develop` en `803d078`, servido en el puerto 3001. Esta rama, en el puerto 3000. Misma base `crm_e2e`, mismo admin, las dos respuestas tomadas en la misma corrida.

Se comparó el JSON de `GET /api/v1/discovery/ouv-dashboard` después de quitar los campos nuevos: `by_segment`, `mayor_probabilidad_by_segment`, `rate_amount`, `win_rate_amount`, `open_amount_now`, `open_count_now` y el `open_count` nuevo de `pipeline_by_sector`. El `open_count` de `executives` ya existía en `develop` y sí se comparó.

| Consulta | Resultado |
|---|---|
| `year=2026` | Idénticos |
| `year=2026&quarter=3` | Idénticos |
| `year=2026&comercial_id=039f487b-c346-443b-a69d-d0c2e9b0aba5` | Idénticos |

Ese `comercial_id` es el primer ejecutivo del tablero con `open_count` mayor que cero. La respuesta de esta rama trae `by_segment`; la de `develop` no. No hay lista de diferencias.

## 4. Modal de perdidas

Año fiscal 2026, trimestre «Todo el año fiscal». Clic en perdidas de Gobierno central (`46 $38.557 M`).

El modal «Perdidas del periodo · Gobierno central» muestra `46 registros · suma $38.557 M`. El monto del encabezado es `38557000000`. El endpoint `GET /discovery/ouv-dashboard/details?kind=lost_by_segment&segmento=Gobierno%20central&year=2026` responde `total` 46 y `amount_total` 38557000000.

## 5. Pendientes en el decision record

`specs/decisions/2026-10-28-dashboard-ouv-abierta.md`, sección `## Pendientes conocidos`:

- Verificación visual con EjecutivoComercial: cubierta por el test de servicio, que fuerza el `comercial_id` del actor. Sigue pendiente con una cuenta habilitada por QA. No se cambian contraseñas en la base.
- Deuda: agregados y detalle se calculan en memoria sobre `findAll`.
- Columnas en MySQL fuera del modelo `Ouv`: `close_probability`, `ouv_type`, `parent_ouv_id` y las demás que el paso 2A.0 listó. Este tablero no las lee.

## Commit

`3da81ee6ba34bc52debd6409735522b1e9ffc851` en `EP-Feature-Reportes`. 16 archivos: código del tablero, los dos decision records (`2026-10-28-dashboard-ouv-abierta.md` y `2026-10-28-dashboard-ouv-moneda-cop.md`) y `specs/reportes-comerciales/RESUMEN-PASO-1.md`, `RESUMEN-PASO-2A-1.md`, `RESUMEN-PASO-2A-2.md`. Sin push.
