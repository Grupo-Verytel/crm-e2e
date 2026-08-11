# DR — Tablas de segments y subsegments parametrizables (reemplaza ENUM segmento)

**Fecha:** 2026-08-10
**Estado:** Aprobado — actualiza versión anterior del mismo DR dentro de la misma sesión de clarificación
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)

## Contexto

Blueprint V2 define `segmento` como ENUM cerrado y **duplicado de forma independiente** en tres tablas: `leads.segmento` (`Gobierno|D&S|PymesEspeciales|B2B`), `ouvs.segmento` (`Gobierno|D&S|ProyectosEspeciales|B2B`) y `campaigns.segmento_objetivo`. Esa duplicación ya había generado una inconsistencia real entre Blueprint V2 leads/ouvs (`PymesEspeciales` vs `ProyectosEspeciales`).

El cambio de reglas de negocio pide, además de subsegments parametrizables (decisión previa de este mismo DR), que **el segmento también sea tabla**, no ENUM — con `leads` y `ouvs` referenciando ambas tablas por columna de relación.

## Decisión

1. Se crea tabla **`segments`**: `id`, `name` VARCHAR, `active` BOOLEAN (DEFAULT true). Reemplaza el ENUM `segmento` como fuente única — ya no se duplica el listado de valores por tabla, eliminando de raíz la inconsistencia `PymesEspeciales`/`ProyectosEspeciales`.
2. Se crea tabla **`subsegments`**: `id`, `segment_id` (FK a `segments.id`, reemplaza el campo ENUM que tenía en la versión anterior de este DR), `name` VARCHAR, `active` BOOLEAN (DEFAULT true).
3. Ninguna de las dos tiene interfaz de administración web todavía — se parametrizan por seed/migración directa, igual que se había decidido para subsegments (los nombres de subsegmento siguen en definición; se aplica el mismo criterio a segments por consistencia, a confirmar si el cliente lo requiere antes de Wave 1).
4. `leads.segment_id` — FK a `segments.id` (reemplaza `leads.segmento` ENUM).
5. `leads.subsegment_id` — FK opcional a `subsegments.id` (sin cambio respecto a la decisión previa).
6. `ouvs.segment_id` — FK a `segments.id` (reemplaza `ouvs.segmento` ENUM).
7. `ouvs.subsegment_id` — FK opcional a `subsegments.id`, independiente del de `leads` (sin cambio respecto a la decisión previa).
8. Regla de integridad a nivel de servicio (no solo FK): `subsegment_id` elegido debe pertenecer al mismo `segment_id` ya seleccionado en ese registro.

## Impacto de migración

- Requiere **seed inicial** de `segments` con los 4 valores vigentes (Gobierno, D&S, Proyectos Especiales, B2B) como fuente única y ya unificada — resuelve el hallazgo lateral de nomenclatura sin necesidad de un DR aparte.
- Requiere **migración de datos**: los registros existentes con `leads.segmento`/`ouvs.segmento` (ENUM) deben mapearse a `segment_id` antes de eliminar la columna ENUM — no es solo cambio de schema.
- `campaigns.segmento_objetivo` **queda fuera de este cambio por ahora** — sigue como ENUM hasta que se confirme si también migra.

## Pendiente para spec

- Criterios EARS de validación cruzada segmento↔subsegmento en `spec-demand-generation.md` (leads) y `spec-calificacion.md` (OUV).
- Confirmar si `campaigns.segmento_objetivo` migra a `segment_id` también.
- Definir plan de migración de datos existentes como tarea explícita del prompt de implementación (no asumir que Cursor lo infiere solo).

## Alternativas descartadas

- Mantener `segmento` como ENUM y solo tabular `subsegments` — descartado por el arquitecto: se pidió explícitamente tabla también para segmento.
- Construir administración web de `segments`/`subsegments` ya — descartado por ahora, mismo criterio que la decisión original de subsegments.
