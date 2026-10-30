# RESUMEN-PASO-2A-1 — Agregados y detalle del tablero de OUVs

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes` (sin commit, sin push)
**Alcance:** backend de `/opportunities/dashboard`. Sin menú Reportes y sin pantallas nuevas.

## 2A.0 — Esquema

`backend/.env` apunta a:

| | |
|---|---|
| Host | `xtam-video-dev.cchfdbjtfv0t.us-east-2.rds.amazonaws.com` |
| Puerto | `3306` |
| Base | `crm_e2e` |

No es `localhost`. Es la base que usa el backend de esta máquina. No hay cadena de certification en el repo ni en `.env`. No me conecté al host comentado `db-red-cuidadana…` ni a producción.

### `status_history` y `audit_log`

Las columnas coinciden con `StatusHistory`, `AuditLog` y las migraciones `20260903010000-create-status-history.js` y `20250626120000-create-auth-audit-tables.js`.

Índices de más en esta base, que esa migración de `status_history` no crea: `changed_by` y `idx_status_history_to_estado (to_estado, changed_at)`. Los de `audit_log` coinciden con la migración.

### `ouvs`

El modelo `Ouv` y las migraciones del repo no declaran estas columnas, y la base sí las tiene: `project_type`, `execution_term_months`, `close_probability`, `origen`, `canal_origen`, `ouv_type`, `parent_ouv_id`. `docs/modelo-destino-migracion.md` ya marcaba las tres primeras como fuera del código. Este paso no las lee (D6) y no agrega columnas.

`ouvs` no tiene `deleted_at`. El modelo tampoco.

### USD (D4)

Cero OUVs con `presupuesto_moneda = 'USD'` o `moneda_final = 'USD'` (414 filas). No hay consecutivo que reportar. La regla quedó en `specs/decisions/2026-10-28-dashboard-ouv-moneda-cop.md`. El código no las excluye: el test `uses presupuesto when the lost amount is zero and still counts USD` mete una fila USD y la suma entra al abierto.

## Predicados

Un solo módulo: `backend/src/modules/discovery/lib/ouv-dashboard-metrics.ts`. El agregado y `listOuvDashboardDetails` llaman las mismas funciones.

| Predicado | Regla | Monto del detalle |
|---|---|---|
| `isDashboardOpen` | `resultado === 'EnCurso'` | `presupuesto_monto` |
| `isWonInPeriod` | `resultado === 'Ganada'` y `fecha_cierre` en el periodo fiscal | `monto_final` |
| `isLostInPeriod` | `resultado === 'Perdida'` y `fecha_cierre` en el periodo | `lostAmount`: `monto_estimado_perdido` si es > 0; si no, `presupuesto_monto` |
| `isMayorProbabilidadAbierta` | abierta y `zona_actual === 'MAYOR_PROBABILIDAD'` | `presupuesto_monto` |
| `amountWinRate` | `SUM(monto ganado) / (SUM(monto ganado) + SUM(monto perdido))`, o `null` si el denominador es 0 | — |

`Descartada` no cumple ninguno. El periodo sigue siendo `resolveOuvDashboardPeriod` (`verytel-quarter.ts`). Sin periodo, ganadas y perdidas no se acotan por fecha, igual que hoy.

La foto abierta que ya existía (`isOpenAt`: reconstruida con `created_at` y `fecha_cierre`) no se tocó. Alimenta `pipeline_value`, `pipeline_weighted`, el embudo, `pipeline_by_sector.amount` y `executives.open_count` / `pipeline_amount`. En esta base hay 0 cerradas con `fecha_cierre` todavía en el futuro, así que hoy ese conjunto y `EnCurso` coinciden. Si una ganada tuviera cierre futuro, seguiría en la foto vieja y no en `by_segment.open_*`.

`origen_via` no se filtra. `close_probability`, `ouv_type` y `parent_ouv_id` no se leen.

## Contrato JSON que se agrega

`GET /api/v1/discovery/ouv-dashboard` conserva los campos de antes. Se suman:

```json
{
  "close_rate": { "rate_amount": 0.3767 },
  "pipeline_by_sector": [
    { "open_count": 59, "win_rate_amount": 0.0233 }
  ],
  "executives": [{ "win_rate_amount": 0.2 }],
  "by_segment": [
    {
      "segmento": "Gobierno central",
      "open_count": 59,
      "open_amount": 56554025210,
      "won_count": 4,
      "won_amount": 921000000,
      "lost_count": 46,
      "lost_amount": 38557000000,
      "win_rate": 0.08,
      "win_rate_amount": 0.0233
    }
  ],
  "mayor_probabilidad_by_segment": [
    { "segmento": "Ciudades y gobernaciones", "count": 3, "amount": 7990100000 }
  ]
}
```

`win_rate` y `close_rate.rate` siguen siendo la tasa por cantidad. `open_count` de `pipeline_by_sector` es el conteo `EnCurso` del segmento (M039). `amount` de esa misma fila sigue siendo la foto `isOpenAt`.

`by_segment` es la tabla de M001/M015/M029/M039: abiertas sin filtro de periodo; ganadas y perdidas del periodo. Orden por nombre de segmento.

### Detalle

`GET /api/v1/discovery/ouv-dashboard/details`

Mismos filtros que el tablero (`year`, `quarter`, `period_from`, `period_to`, `comercial_id`, `segmento`) más `kind`, `page` (default 1), `limit` (default 20, máximo 50) y `zona` opcional. `zona` recorta el detalle; no cambia el agregado del tablero. El mismo `CheckAbility read Opportunity` y el mismo `canReadAllOuvs`: `EjecutivoComercial` ignora `comercial_id` y queda en el suyo.

`kind`: `open_by_segment`, `won_by_segment`, `lost_by_segment`, `mayor_probabilidad`, `won_by_executive`, `open_by_executive`.

Respuesta: `{ kind, items, total, page, limit }`. Cada ítem:

| Campo | Origen |
|---|---|
| `ouv_id`, `consecutivo`, `titulo` | `ouvs` |
| `empresa` | `empresa_nombre` |
| `comercial` | `users.full_name` |
| `segmento` | `ouvs.segmento` |
| `zona` | `zona_actual` (enum, no el rótulo) |
| `monto` | el del predicado, sin redondear por fila |
| `moneda` | `presupuesto_moneda` en abiertas, mayor probabilidad y perdidas; `moneda_final` en ganadas |
| `fecha` | `created_at` si `fecha_tipo = creacion`; `fecha_cierre` si `fecha_tipo = cierre` |

La tarjeta redondea la suma a 2 decimales (`roundMoney`). La prueba compara `round(sum(items.monto), 2)` con ese total, recorriendo todas las páginas. `limit` máximo es 50: Gobierno central tiene 59 abiertas y Defensa y seguridad 61, así que un segmento puede ocupar dos páginas. `total` es el universo del `kind` después del RBAC, no el tamaño de la página.

El detalle se filtra en memoria sobre el mismo `findAll` del tablero, para que el predicado no se duplique en SQL.

## Conteos en esta base

Año fiscal 2026 (1 feb 2026 – 31 ene 2027), sin trimestre. Abiertas = `EnCurso` de ahora, no del corte del año. Cálculo SQL con las mismas reglas; no es una llamada HTTP.

Antes, el JSON no traía `by_segment`, `mayor_probabilidad_by_segment`, `rate_amount`, `win_rate_amount` ni `open_count`. Los totales globales de ganadas y perdidas del año fiscal ya salían de `closeStats` / `won_vs_lost`. Esos totales no cambian.

| Corte | Cantidad | Monto |
|---|---:|---:|
| Abiertas, todos los segmentos | 147 | 217.957.375.210 |
| Ganadas del año fiscal | 21 | 33.116.860.000 |
| Perdidas del año fiscal | 84 | 54.806.000.000 |
| Tasa por cantidad | 21 / 105 = 0,2 | |
| Tasa por monto (`rate_amount`) | | 0,3767 |

Abiertas por segmento (`open_count` / `open_amount`):

| Segmento | Cantidad | Monto |
|---|---:|---:|
| Ciudades y gobernaciones | 24 | 99.780.850.000 |
| Defensa y seguridad | 61 | 61.222.500.000 |
| Gobierno central | 59 | 56.554.025.210 |
| Industria | 2 | 400.000.000 |
| Otros | 1 | 0 |

Ganadas del año fiscal: Ciudades y gobernaciones 11 / 31.163.400.000; Defensa y seguridad 6 / 1.032.460.000; Gobierno central 4 / 921.000.000.

Perdidas del año fiscal: Gobierno central 46 / 38.557.000.000; Defensa y seguridad 38 / 16.249.000.000.

Mayor probabilidad abierta: Ciudades y gobernaciones 3 / 7.990.100.000; Defensa y seguridad 4 / 1.856.500.000; Industria 1 / 250.000.000.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/src/modules/discovery/lib/ouv-dashboard-metrics.ts` | Predicados, campos nuevos, listado de detalle |
| `backend/src/modules/discovery/lib/ouv-dashboard-metrics.spec.ts` | Tasa por monto, cruce por segmento, suma del detalle, USD, descartada |
| `backend/src/modules/discovery/services/ouv-dashboard.service.ts` | `loadRows` compartido y `getDetails` |
| `backend/src/modules/discovery/services/ouv-dashboard.service.spec.ts` | RBAC, paginación, suma por `kind` |
| `backend/src/modules/discovery/controllers/ouv-dashboard.controller.ts` | `GET details` |
| `backend/src/modules/discovery/dtos/ouv-dashboard-details.dto.ts` | Query del detalle |
| `specs/decisions/2026-10-28-dashboard-ouv-moneda-cop.md` | Regla COP |

Pruebas: `npx jest` de esos dos spec, 17 pruebas, todas en verde.

## Para el frontend (sin hacerlo)

La tabla nueva debe leer `by_segment` y `mayor_probabilidad_by_segment`, no rearmar la cifra. El clic de una fila de segmento manda ese `segmento` al `kind` abierto, ganado o perdido. Mayor probabilidad usa `kind=mayor_probabilidad` y el `segmento` de la fila. El ejecutivo usa `won_by_executive` o `open_by_executive` con su `comercial_id`. `executives.won_amount` ya es la suma de `won_by_executive`. `executives.open_count` sigue siendo la foto vieja; el detalle `open_by_executive` suma `EnCurso`.

STOP. Sin frontend hasta aprobar este resumen.
