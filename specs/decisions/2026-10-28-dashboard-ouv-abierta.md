# 2026-10-28 — Dos definiciones de OUV abierta en el tablero

Estado: aplicada en EP-Feature-Reportes (2026-10-28).

## D-ABIERTA — Foto y EnCurso conviven

`GET /discovery/ouv-dashboard` mantiene dos predicados. No se unifican en este paso.

`isOpenAt` reconstruye la foto en un instante con `created_at` y `fecha_cierre`. Sigue alimentando el pipeline ponderado, el valor del pipeline, el embudo, `pipeline_by_sector.amount`, `executives.open_count` y `executives.pipeline_amount`. Esas cifras no abren detalle.

`isDashboardOpen` es `resultado = EnCurso`. Alimenta `by_segment` (abiertas), `mayor_probabilidad_by_segment`, `pipeline_by_sector.open_count` y `open_amount_now`, y `executives.open_count_now` y `open_amount_now`. El detalle (`open_by_segment`, `open_by_executive`, `mayor_probabilidad`) usa el mismo predicado. `Descartada` no entra.

En la base `crm_e2e` del 2026-10-28 las dos definiciones coinciden: hay 0 OUVs cerradas con `fecha_cierre` todavía en el futuro.

## D-PERIODO — Abiertas de hoy, cierres del periodo

Las abiertas de `by_segment` son las `EnCurso` de ahora. No se filtran por año, trimestre ni rango. Ganadas y perdidas sí: `fecha_cierre` dentro del periodo fiscal Verytel (`verytel-quarter.ts`), con la misma regla de monto perdido del tablero.

## D-MEMORIA — Deuda de volumen

El agregado y el detalle cargan las OUVs con un `findAll` y calculan en memoria. Con 414 filas la respuesta cabe bajo 2 s. Si el volumen crece, hay que volver a medir ese corte y, si se pasa de 2 s, mover el predicado a SQL sin duplicar la regla.

## Pendientes conocidos

- Verificación visual con EjecutivoComercial: cubierta por el test de servicio, que fuerza el `comercial_id` del actor. Sigue pendiente con una cuenta habilitada por QA. No se cambian contraseñas en la base.
- Deuda: agregados y detalle se calculan en memoria sobre `findAll`.
- Columnas en MySQL fuera del modelo `Ouv`: `close_probability`, `ouv_type`, `parent_ouv_id` y las demás que el paso 2A.0 listó. Este tablero no las lee.
