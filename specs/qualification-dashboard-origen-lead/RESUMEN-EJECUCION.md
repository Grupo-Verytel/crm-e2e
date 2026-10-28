# RESUMEN-EJECUCION — Tablero de Calificación solo con origen Lead

**Fecha:** 2026-10-27
**Rama:** `EP-FixBug.V8`
**Estado:** tres pasos cerrados en el working tree. Sin commit y sin push.

## Regla

El tablero `/qualification/dashboard` cuenta en el Bloque B solo OUVs nacidas del embudo Lead → MQL → SQL → OUV. El predicado, sin query param, está en `openZonaWhere` y `closedOuvWhere`:

```text
origenVia: OuvOrigenVia.DesdeSql
sqlIdOrigen: { [Op.ne]: null }
```

Agregado y «Ver detalle» comparten ese `where`. Las zonas abiertas siguen siendo un snapshot (`resultado = EnCurso`), sin periodo. Las cerradas siguen con `COALESCE(fecha_cierre, updated_at)` dentro del periodo. El corte de `EjecutivoComercial` por `comercial_id` se aplica junto al origen. Directas y migradas de Pipedrive quedan fuera: ambas llegan como `origen_via = directa` y `sql_id_origen` NULL, y no hay columna que las separe.

No se tocaron el Bloque A, `OuvsService`, `OuvDashboardService`, `OuvMarketingMetricsService` ni `QUALIFICATION_DASHBOARD_TARGETS`.

## Archivos

| Paso | Archivos |
|---|---|
| 1 | `specs/qualification-dashboard-origen-lead/RESUMEN-PASO-1.md` (solo lectura) |
| 2 | `backend/src/modules/qualification/services/qualification-dashboard.service.ts` (+13), `qualification-dashboard.service.spec.ts` (+470) |
| 3 | `frontend/src/modules/qualification/pages/QualificationDashboardPage.tsx` (+1), `frontend/src/modules/qualification/components/QualificationDashboardCharts.tsx` (subtítulo `text-sm text-muted` bajo los dos encabezados del Bloque B), `RESUMEN-PASO-3.md`, este archivo, `specs/decisions/2026-10-27-qualification-dashboard-lead-origin.md` |

Diff de código al cierre: 4 archivos, 489 inserciones, 3 borrados. Los resúmenes y el decision record van sin seguimiento de git hasta el commit.

## Tests

- `qualification-dashboard.service.spec.ts`: **7 passed**. Cubre directa fuera (abierta y cerrada), `desde_sql` dentro, tarjeta = detalle en los 7 `kind` del Bloque B, y origen + `comercial_id` juntos para `EjecutivoComercial`.
- Suite `npx jest src/modules/qualification --runInBand`: 5 suites en verde, 1 en rojo. 42 passed, 3 failed, de 45. Los rojos están solo en `follow-up-status.spec.ts` (timeout de 5 s al conectar a MySQL).
- El mismo spec, en un worktree de `develop` (`3dddf53`): 1 failed, 14 passed. Mismo timeout («exact yellow limit»). Preexistente. No se arregló. No hay `NOTAS-BLOQUEO-3.md`.

## Conteos, año 2026, lectura completa

Antes del filtro (consulta del Paso 1) y después (endpoint del Paso 2, repetido en la UI del Paso 3):

| KPI | Antes (OUVs / COP) | Después (OUVs / COP) |
|---|---|---|
| Universo | 16 / 1.667.490.000 | 6 / 0 |
| Encima Funnel | 85 / 140.035.000.000 | 14 / 533.000.000 |
| En Funnel | 30 / 62.836.250.600 | 0 / 0 |
| Mayor Probabilidad | 5 / 1.625.990.000 | 0 / 0 |
| Valor ganado | 26 / 40.060.960.000 | 0 / 0 |
| Valor perdido | 91 / 59.722.000.000 | 7 / 1.922.000.000 |
| Valor descartado | 4 / 1.371.000.000 | 0 / 0 |

Con las metas fijas, Encima Funnel pasa de 5601 % a 21 % (`533 M / 2.500 M`) y Valor perdido de 11944 % a 384 % (`1.922 M / 500 M`).

Bloque A, sin cambio: MQL en bandeja 0, con cita 0, citas programadas 3, citas ejecutadas 0, SQL asignados 59, SQL convertidos a OUV 27.

## Otros tableros

`/opportunities/dashboard` (año 2026, todos): Encima Funnel `$140.035 M · 85`, Perdidas `91 · $59.722 M`. Siguen el corte anterior. `/opportunities` sigue listando OUVs que no son de origen Lead (OUV-0434 en Universo). `/demand/dashboard`: OUV convertidas 27; ese servicio ya filtraba `desde_sql`.

## Pendientes

- Sesión visual de `EjecutivoComercial`. El spec cubre el `where`; no hubo login de ese rol.
- `follow-up-status.spec.ts` sigue en rojo por timeout de MySQL en esta rama y en `develop`.
- Sin commit y sin push. Esperando revisión.
