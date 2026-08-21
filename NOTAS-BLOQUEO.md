# NOTAS-BLOQUEO — EARS-10..14 (SQL→OUV)

> **RESUELTO 2026-08-06** — Evilio respondió las 4 decisiones; PASO 2 y 3 ejecutados.
> Ver `RESUMEN-EJECUCION.md`. Este archivo se conserva solo como histórico del stop.

---

## Bloqueo 1 — Ruta de módulos (R6 vs constitución del repo)

**Resolución:** usar `discovery` + `qualification` + `Sql.ouv_id` en demand-generation (AGENTS.md prevalece).

---

## Bloqueo 2 — `guardEntidadEnEstado('SQL', …)` vs `transition('OUV', …)`

**Resolución:** opción 1 con matiz — `entityIdResolver` opcional en `guard-entidad-en-estado.ts`.

---

## Bloqueo 3 — Tabla `secuenciadores`

**Resolución:** MAX sobre `ouvs` con `FOR UPDATE` (temporal). Sin crear `secuenciadores`.

---

## EARS-14

**Resolución:** diferido; requiere DR de catálogo de motivos.
