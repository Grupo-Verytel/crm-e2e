# RESUMEN-PASO-1 — Tablero de Calificación solo con origen Lead

**Fecha:** 2026-10-27
**Estado:** diagnóstico de solo lectura. Sin cambios de código. Esperando aprobación antes del Paso 2.
**Base consultada:** `crm_e2e` (conteos de esta fecha, año 2026, corte Bogotá UTC−5).

No hace falta tabla, columna ni migración. El vínculo OUV ↔ Lead ya existe y, en los datos actuales, no es ambiguo.

---

## Dónde vive la pantalla

| Pieza | Archivo |
|---|---|
| Ruta | `frontend/src/routing/AppRoutes.tsx` → `/qualification/dashboard` |
| Página | `frontend/src/modules/qualification/pages/QualificationDashboardPage.tsx` |
| Tarjetas | `frontend/src/modules/qualification/components/QualificationDashboardCharts.tsx` (`DonutMetric`, aria-label `{label}. Ver detalle`) |
| Modal | El mismo page, `ModalShell` + `QualificationDashboardDetailTable` |
| Cliente | `frontend/src/modules/qualification/api/qualification-dashboard-api.ts` |
| API | `GET /api/v1/qualification/dashboard` y `GET /api/v1/qualification/dashboard/details` |
| Controlador | `QualificationDashboardController` |
| Servicio | `QualificationDashboardService` (privado del módulo de calificación) |

Los 12 controles salen de esos dos endpoints. El detalle usa el mismo periodo que la tarjeta y un `kind`. Tarjeta y detalle del Bloque B ya comparten el predicado (`openZonaWhere` / `closedOuvWhere`). El filtro de origen se agrega ahí, una sola vez.

Filtros que el tablero tiene hoy:

- Periodo: `year`, `quarter`, o `period_from` + `period_to`. El año gana si no hay rango de fechas. Por defecto la UI manda el año en curso.
- RBAC: `EjecutivoComercial` ve solo OUVs con `comercial_id` propio en el Bloque B. El resto de roles que pasan CASL `read Opportunity` ven el universo. El Bloque A no se recorta por comercial.
- No hay filtro de segmento ni selector de comercial en esta pantalla. Esos filtros viven en `/opportunities/dashboard`, no aquí. El Paso 2 no los inventa.

El % de la dona no sale de metas comerciales. El numerador es el KPI y el denominador está fijo en `QUALIFICATION_DASHBOARD_TARGETS`. Encima Funnel hoy es 140.035.000.000 / 2.500.000.000 = 5601 %. Valor perdido es 59.722.000.000 / 500.000.000 = 11944 %. Al bajar el numerador, el % baja. Las metas fijas no se tocan.

---

## Vínculo OUV ↔ Lead

Cadena real:

`leads.lead_id` ← `mqls.lead_id` (NOT NULL, 1:1) ← `sqls.mql_id` (NOT NULL, 1:1) ← `ouvs.sql_id_origen` (NULL permitido, único).

Discriminador en `ouvs`:

| Columna | Valores | Uso |
|---|---|---|
| `origen_via` | `desde_sql` \| `directa` | Cómo se creó la OUV |
| `sql_id_origen` | UUID o NULL | SQL de origen. NULL en alta directa y en la carga histórica |

Alta desde SQL (`OuvsService.crearDesdeSql`): `origen_via = 'desde_sql'` y `sql_id_origen` poblado.
Alta directa (`OuvsService.crearDirecta`, vías 2/3/4): `origen_via = 'directa'` y `sql_id_origen = NULL`.
Carga Pipedrive (`docs/modelo-destino-migracion.md`, paso 4): la misma marca que la directa. No hay columna `pipedrive_id` ni otro origen. Directa y migrada no se pueden separar, y REQ-3 pide excluir las dos.

`ouvs` no tiene `deleted_at`. `sqls`, `mqls` y `leads` sí, con `paranoid: true`.

Conteo global de OUVs (414):

| `origen_via` | `sql_id_origen` | Filas |
|---|---|---|
| `directa` | NULL | 387 |
| `desde_sql` | poblado | 27 |

Inconsistencias de cadena (desde_sql sin SQL, directa con SQL, SQL/MQL/Lead ausente o soft-deleted, `sqls.ouv_id` distinto de la OUV): **0**.

**Predicado propuesto** (el mismo que ya usa `OuvMarketingMetricsService` para el tablero de marketing, más el guard de FK):

```text
ouvs.origen_via = 'desde_sql'
AND ouvs.sql_id_origen IS NOT NULL
```

Se aplica dentro de `openZonaWhere` y `closedOuvWhere`. Así el agregado y el detalle quedan atados. No hace falta un query param `origin=lead`: estos dos endpoints solo los consume este tablero, y la regla es siempre, no opcional. Un param omitible devolvería otra vez el universo completo.

---

## Tabla de controles

| Control | Endpoint | Servicio / consulta | ¿Ya filtra por Lead? | Cambio propuesto | ¿Compartido? |
|---|---|---|---|---|---|
| 1. MQL en bandeja (sin aprobar) | `GET /qualification/dashboard` (`mql_bandeja.pending_total`) y `details?kind=mql_bandeja` | `countMqlBandejaPending` / `listMqlBandejaDetails`: `mqls.estado = 'Activo'` | Sí, por esquema. `mqls.lead_id` es NOT NULL | Ninguno | No |
| 2. Con cita agendada | mismo, `mql_bandeja.with_cita` / `kind=mql_with_cita` | `countMqlBandejaByLeadCita(true)`: MQL Activo + `leads.fecha_cita IS NOT NULL` | Sí. El conteo ya exige `Lead` vivo | Ninguno | No |
| 3. Citas programadas | `citas_calificacion.scheduled_by_commercial` / `kind=citas_scheduled` | `countCitasByEstados` / `listCitaDetails`: `sql_citas` en `Agendada` o `Reagendada`, `fecha` en el periodo | Sí. `sql_citas.sql_id` es NOT NULL y el SQL cuelga de un MQL/Lead | Ninguno | No |
| 4. Citas ejecutadas | `citas_calificacion.executed` / `kind=citas_executed` | Igual, estados `Realizada`, `Cancelada`, `NoAsistio` | Sí, misma cadena | Ninguno | No |
| 5. SQL convertidos a OUV (y denominador Asignados en periodo) | `sql_converted_to_ouv_in_period` y `sql_assigned_in_period` / `kind=sql_converted_ouv` | `countSqlConvertedToOuvAssignedInRange` y `countSqlAssignedInRange` sobre `sqls` (`fecha_asignacion` en el periodo, `comercial_asignado_id` no nulo; el convertido exige `estado = ConvertidoOUV` y `ouv_id` no nulo) | Sí. Cuenta SQL, no OUVs sueltas. El detalle ya incluye MQL y Lead | Ninguno | No |
| 6. Universo | `pipeline.open_zonas.universo` / `kind=ouvs_universo` | `sumOuvsOpenInZona` / `listOuvOpenZonaDetails` → `openZonaWhere`: `zona_actual = UNIVERSO`, `resultado = EnCurso`. Snapshot, sin periodo | No | AND origen Lead en `openZonaWhere` | No |
| 7. Encima Funnel | `open_zonas.encima_funnel` / `kind=ouvs_encima_funnel` | Igual, zona `ENCIMA_FUNNEL` | No | El mismo predicado | No |
| 8. En Funnel | `open_zonas.en_funnel` / `kind=ouvs_en_funnel` | Igual, zona `EN_FUNNEL` | No | El mismo predicado | No |
| 9. Mayor Probabilidad | `open_zonas.mayor_probabilidad` / `kind=ouvs_mayor_probabilidad` | Igual, zona `MAYOR_PROBABILIDAD` | No | El mismo predicado | No |
| 10. Valor ganado | `ouvs_won_in_period` / `kind=ouvs_won` | `sumClosedOuvsInRange` / `listClosedOuvDetails` → `closedOuvWhere`: `resultado = Ganada`, `SUM(monto_final)`, fecha `COALESCE(fecha_cierre, updated_at)` en el periodo | No | AND origen Lead en `closedOuvWhere` | No |
| 11. Valor perdido | `ouvs_lost_in_period` / `kind=ouvs_lost` | Igual, `Perdida`, monto `COALESCE(monto_estimado_perdido, presupuesto_monto)` | No | El mismo predicado | No |
| 12. Valor descartado | `ouvs_discarded_in_period` / `kind=ouvs_discarded` | Igual, `Descartada`, mismo monto | No | El mismo predicado | No |

El monto de las zonas abiertas es `SUM(presupuesto_monto)`. El de ganadas es `SUM(monto_final)`. Perdidas y descartadas usan `COALESCE(monto_estimado_perdido, presupuesto_monto)`. El detalle resuelve el mismo monto por fila en `resolveOuvAmount`.

---

## Conteos Bloque B (hoy → con el predicado)

Año 2026, sin recorte de comercial (vista de un rol que lee todas las OUVs). Las zonas abiertas no filtran por periodo: es el comportamiento actual del servicio (`Snapshot, not period-filtered`).

| KPI | OUVs hoy | Monto hoy (COP) | OUVs origen Lead | Monto origen Lead (COP) |
|---|---:|---:|---:|---:|
| Universo | 16 | 1.667.490.000 | 6 | 0 |
| Encima Funnel | 85 | 140.035.000.000 | 14 | 533.000.000 |
| En Funnel | 30 | 62.836.250.600 | 0 | 0 |
| Mayor Probabilidad | 5 | 1.625.990.000 | 0 | 0 |
| Valor ganado | 26 | 40.060.960.000 | 0 | 0 |
| Valor perdido | 91 | 59.722.000.000 | 7 | 1.922.000.000 |
| Valor descartado | 4 | 1.371.000.000 | 0 | 0 |

Universo origen Lead queda en monto 0 porque esas 6 OUVs no tienen `presupuesto_monto`. Siguen contando como 6 OUVs.

Referencia del Bloque A, mismo corte 2026:

| Control | Valor |
|---|---:|
| MQL en bandeja | 0 |
| Con cita agendada | 0 |
| Citas programadas (`Agendada`) | 3 |
| Citas ejecutadas | 0 |
| SQL asignados en el periodo | 59 |
| SQL convertidos a OUV | 27 |

Las 27 OUVs `desde_sql` son exactamente los 27 SQL convertidos del año. Abiertas (6+14) + perdidas en 2026 (7) = 27. Cada tarjeta del Bloque B, ya filtrada, queda por debajo de 27.

Matiz para el criterio de aceptación: las zonas abiertas siguen siendo foto del pipeline, no del periodo. Si en 2027 queda abierta una OUV nacida de un Lead en 2026, Encima Funnel de 2027 puede superar los SQL convertidos de 2027. El Paso 2 no cambia ese corte de fecha. Solo agrega el origen.

---

## Qué no se toca

| Pantalla | API | Servicio | Por qué queda igual |
|---|---|---|---|
| `/opportunities` | listado de OUVs | `OuvsService` | Otro servicio. Muestra directas y migradas |
| `/opportunities/dashboard` | `GET /discovery/ouv-dashboard` | `OuvDashboardService` + `ouv-dashboard-metrics.ts` | Carga todas las OUVs. No llama a `QualificationDashboardService` |
| `/demand/dashboard` (API `GET /dashboard/marketing`) | marketing | `DashboardService` + `OuvMarketingMetricsService` | Ya filtra `origen_via = desde_sql` por su cuenta |
| `/dashboard/metas-comerciales` | `GET /commercial-goals` | módulo de metas | No usa OUVs de este tablero |

No existe la ruta `/dashboard`. El tablero de marketing está en `/demand/dashboard`.

`QualificationDashboardService` está exportado por el módulo, pero ningún otro módulo lo inyecta. Cambiar sus `where` de OUV no cambia el default de otro tablero. Por eso no propongo un parámetro nuevo.

---

## Paso 2, si se aprueba

1. En `openZonaWhere` y `closedOuvWhere`, agregar `origenVia: OuvOrigenVia.DesdeSql` y `sqlIdOrigen` no nulo.
2. No tocar las consultas de MQL, citas ni SQL.
3. No tocar `OuvDashboardService`, `OuvsService` ni `OuvMarketingMetricsService`.
4. Extender `qualification-dashboard.service.spec.ts`: una OUV `directa` (y, con la misma marca, una migrada) queda fuera del agregado y del detalle; una `desde_sql` entra; el `count` del agregado coincide con el `total` del detalle.

El Paso 3, aparte, solo agrega el subtítulo «Solo oportunidades originadas en Leads» con la clase existente `text-muted` (`--text-muted`). No hay token `text-ink-muted`.
