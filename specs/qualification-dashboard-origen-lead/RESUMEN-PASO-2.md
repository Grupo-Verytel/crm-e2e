# RESUMEN-PASO-2 — Filtro de origen Lead en el tablero de Calificación

**Fecha:** 2026-10-27
**Estado:** backend listo. Esperando aprobación antes del Paso 3 (subtítulo `text-muted`).

## Predicado

Una sola constante, `LEAD_ORIGIN_OUV_WHERE`, repartida en `openZonaWhere` y `closedOuvWhere`:

```text
origenVia: OuvOrigenVia.DesdeSql
sqlIdOrigen: { [Op.ne]: null }
```

El agregado (`sumOuvsOpenInZona`, `sumClosedOuvsInRange`) y el detalle (`listOuvOpenZonaDetails`, `listClosedOuvDetails`) usan esos dos métodos. Las zonas abiertas siguen siendo snapshot (`resultado = EnCurso`). Las cerradas siguen con `COALESCE(fecha_cierre, updated_at)` dentro del periodo. El corte de `EjecutivoComercial` por `comercial_id` sigue en el mismo `where`, junto al origen.

No hay query param. No se tocaron MQL, citas, SQL, `OuvsService`, `OuvDashboardService`, `OuvMarketingMetricsService` ni `QUALIFICATION_DASHBOARD_TARGETS`.

## Archivos

| Archivo | Cambio |
|---|---|
| `backend/src/modules/qualification/services/qualification-dashboard.service.ts` | +13. Import de `OuvOrigenVia` y el predicado en los dos `where` |
| `backend/src/modules/qualification/services/qualification-dashboard.service.spec.ts` | +470. Cuatro casos sobre fixtures: directa fuera, `desde_sql` dentro, tarjeta = detalle en los 7 `kind` del Bloque B, y origen + comercial juntos para `EjecutivoComercial` |

Diff: 2 archivos, 482 inserciones, 1 borrado.

## Tests

`qualification-dashboard.service.spec.ts`: **7 passed**.

Suite del módulo (`npx jest src/modules/qualification --runInBand`): **5 suites passed, 1 failed**. **42 passed, 3 failed**, de 45. Los 3 fallos están en `follow-up-status.spec.ts`, archivo que este paso no modifica. Cada caso abre MySQL y el timeout de Jest es 5 s; la conexión a la base se pasó de ese límite. Una corrida aparte de ese archivo dio 10 passed y 5 failed, el mismo timeout. No cambia el predicado ni los conteos de abajo.

## Conteos del endpoint (año 2026)

`GET /api/v1/qualification/dashboard?year=2026` y `GET /api/v1/qualification/dashboard/details` con un usuario `Gerente Comercial`. En este tablero ese rol lee todas las OUVs: el recorte por comercial aplica solo a `EjecutivoComercial`.

| KPI | Esperado (OUVs / COP) | Endpoint (OUVs / COP) | Detalle (`total` / suma) |
|---|---|---|---|
| Universo | 6 / 0 | 6 / 0 | 6 / 0 |
| Encima Funnel | 14 / 533.000.000 | 14 / 533.000.000 | 14 / 533.000.000 |
| En Funnel | 0 / 0 | 0 / 0 | 0 / 0 |
| Mayor Probabilidad | 0 / 0 | 0 / 0 | 0 / 0 |
| Valor ganado | 0 / 0 | 0 / 0 | 0 / 0 |
| Valor perdido | 7 / 1.922.000.000 | 7 / 1.922.000.000 | 7 / 1.922.000.000 |
| Valor descartado | 0 / 0 | 0 / 0 | 0 / 0 |

El Bloque A, en el mismo response, quedó como antes del filtro: MQL en bandeja 0, con cita 0, citas programadas 3, citas ejecutadas 0, SQL asignados 59, SQL convertidos a OUV 27.

Los siete números del Bloque B coinciden con lo aprobado. No hay `NOTAS-BLOQUEO-2.md`.
