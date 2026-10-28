# 2026-10-27 — Tablero de Calificación solo con OUVs de origen Lead

Estado: aplicada en el working tree de `EP-FixBug.V8` (2026-10-27). Sin commit.

## D-UNIVERSO — El Bloque B solo cuenta `desde_sql`

`QualificationDashboardService` cuenta, suma y lista en el Bloque B únicamente OUVs con:

```text
origen_via = 'desde_sql'
sql_id_origen IS NOT NULL
```

En código: `origenVia: OuvOrigenVia.DesdeSql` y `sqlIdOrigen: { [Op.ne]: null }`, en `openZonaWhere` y `closedOuvWhere`. No hay query param. El agregado y cada «Ver detalle» usan esos dos métodos, así que la tarjeta y el modal cuentan el mismo conjunto.

El Bloque A (MQL, citas, SQL) no entra en esta regla. Un SQL convertido ya nace de un lead.

## D-TIEMPO — Las zonas abiertas siguen siendo un snapshot

Universo, Encima Funnel, En Funnel y Mayor Probabilidad filtran `resultado = EnCurso` y la zona actual. No filtran por el año, el trimestre ni el rango de fechas de la pantalla. Una OUV abierta de un año anterior sigue en la tarjeta del año que se está mirando.

Ganado, perdido y descartado siguen acotados al periodo con `COALESCE(fecha_cierre, updated_at)`, en el día de Bogotá (UTC−5).

## D-EXCLUSION — Directa y Pipedrive salen juntas

`crearDirecta` y la carga de Pipedrive (`docs/modelo-destino-migracion.md`) escriben las dos `origen_via = 'directa'` y `sql_id_origen` NULL. No existe `pipedrive_id` ni otra columna que las distinga. El tablero las excluye con el mismo predicado y no intenta separarlas.

`/opportunities`, `/opportunities/dashboard` y `/demand/dashboard` no usan este servicio. El tablero de mercadeo ya filtraba `origenVia: DesdeSql` por su cuenta; este decision record no lo cambia.
