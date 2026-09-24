# Spec — Influencias multi-contacto en OUV

**Estado:** en revisión — pendiente de aprobación del arquitecto.  
**Decisión:** `specs/decisions/2026-09-24-influencias-multi-contacto.md`  
**Base de repo:** tabla `ouv_influencias`; contacto = `contacto_ouv_id` → `ouv_contactos` → `people`. Valores persistidos: `SinEvaluar`, `Verde`, `Rojo`, `Amarillo` (este último solo hasta la migración).

## EARS

**EARS-01 (Ubiquitous).** El sistema permitirá entre 1 y 5 contactos por tipo de influencia en una OUV. El mismo contacto no se repite dentro del mismo tipo. El mismo contacto puede estar en tipos distintos. Un tipo sin contactos tiene cero filas.

**EARS-02 (Unwanted).** SI se intenta agregar un 6º contacto al mismo tipo, ENTONCES el sistema rechazará con error RFC 7807 y mensaje en español.

**EARS-03 (Unwanted).** SI se intenta agregar un contacto ya asignado al mismo tipo, ENTONCES el sistema rechazará.

**EARS-04 (Ubiquitous).** La calificación aceptará solo `SinEvaluar`, `Verde` o `Rojo`. El default de un contacto nuevo es `SinEvaluar`.

**EARS-05 (Ubiquitous).** Cada contacto de una influencia tendrá su propia nota opcional de máximo 1000 caracteres.

**EARS-06 (Event-driven).** CUANDO se evalúe el filtro de influencias, el sistema contará los tipos distintos en `{Economica, Tecnica, Fabrica}` con al menos 1 `Verde`, y lo dará por cumplido si el conteo es ≥ 2. `Usuario` y `Coach` no cuentan. Un `Rojo` en el mismo tipo no anula un `Verde`.

**EARS-07 (Event-driven).** CUANDO se consulten las influencias de una OUV, el sistema retornará también el estado del filtro `{ passed, greenTypes, required }`, con `required` = 2. El frontend no recalcula la regla.

**EARS-08 (Event-driven).** CUANDO se agregue, quite, califique o edite la nota de un contacto, el sistema registrará en `audit_log` el usuario, la fecha, el valor anterior y el nuevo.

**EARS-09 (Unwanted).** SI el filtro no se cumple al intentar avanzar la OUV hacia `EN_FUNNEL` o `MAYOR_PROBABILIDAD`, ENTONCES el sistema bloqueará la transición e indicará cuántos tipos en verde tiene y cuántos requiere.

**EARS-10 (Migración).** Los registros en `Amarillo` pasan a `SinEvaluar`. Cada id afectado queda en `audit_log` con actor `00000000-0000-4000-8000-000000000001`, valor anterior `"Amarillo"`, valor nuevo `"SinEvaluar"` y `contexto` = `"migration:2026-09-24-influencias-multi-contacto"`. Los literales de calificación en migración, auditoría y tests son `Verde`, `Rojo`, `Amarillo` y `SinEvaluar`. Si el tipo tiene contacto, su nota se conserva en ese contacto.

**EARS-11 (Migración).** SI `contacto_ouv_id` es NULL, ENTONCES la migración eliminará la fila completa (nota, calificación y fila). El texto no se conserva. Antes de borrar, la migración escribe en consola (a) el conteo total, (b) el conteo de las que estaban en `Verde` y (c) los `ouv_id` de (b). SI (b) es mayor que 0, ENTONCES no se ejecuta la migración en ningún ambiente hasta nueva orden.

**EARS-12 (Ubiquitous).** El único de `ouv_influencias` será `(ouv_id, tipo, contacto_ouv_id)`, sin índice parcial. La tabla tendrá `deleted_at` y `paranoid: true`. El índice incluye filas borradas.

**EARS-13 (Event-driven).** CUANDO se agregue un contacto cuya terna `(ouv_id, tipo, contacto_ouv_id)` exista soft-deleted, el sistema restaurará esa fila, pondrá `estado` en `SinEvaluar` y `notas` en null, y no insertará otra fila.

## Casos del filtro D3

| # | Estado | Esperado |
|---|---|---|
| 1 | ECO: V, V · TEC: SE | No cumple |
| 2 | ECO: V · TEC: V | Cumple |
| 3 | ECO: V, R · FAB: V | Cumple |
| 4 | USU: V · COACH: V · ECO: V | No cumple |
| 5 | ECO: R · TEC: R · FAB: V | No cumple |
| 6 | ECO: V · TEC: V · FAB: V | Cumple |
| 7 | ECO: V, V, V, V, V · TEC: SE | No cumple |

Leyenda: ECO `Economica`, TEC `Tecnica`, FAB `Fabrica`, USU `Usuario`. V = `Verde`, R = `Rojo`, SE = `SinEvaluar`. Los tests usan estos literales, no `VERDE` ni `SIN_EVALUAR`.

## Fuera de alcance

Otros filtros del embudo, otras etapas y otros módulos. `down` restaura estructura y enum; no revierte valores ni notas descartadas.
