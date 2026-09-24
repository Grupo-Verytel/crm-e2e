# 2026-09-24 — Influencias multi-contacto en OUV

## Contexto

Hoy `ouv_influencias` tiene una fila por (`ouv_id`, `tipo`), índice único `uq_ouv_influencias_ouv_tipo`. Cada tipo tiene un solo `contacto_ouv_id` (nullable), una calificación (`Verde | Rojo | Amarillo | SinEvaluar`) y una `notas`. El filtro de avance a `EN_FUNNEL` y `MAYOR_PROBABILIDAD` cuenta filas en `Verde` con contacto, de cualquier tipo.

El contacto de la influencia es `ouv_contactos.contacto_ouv_id`, que apunta a `people`. No se renombran tablas ni columnas en español.

## Decisión

- **D1.** De 1 a 5 contactos por (OUV, tipo de influencia). No se repite el mismo contacto dentro del mismo tipo. El mismo contacto sí puede estar en tipos distintos. Un tipo sin contactos es cero filas.
- **D2.** Calificación por contacto: `SinEvaluar | Verde | Rojo`. Default: `SinEvaluar`. Se elimina `Amarillo`.
- **D3.** El filtro se cumple cuando al menos 2 tipos distintos entre `{Economica, Tecnica, Fabrica}` tienen cada uno 1 o más contactos en `Verde`.
  - 2 contactos en `Verde` del mismo tipo cuentan como 1 solo tipo, así que no cumple.
  - Un `Rojo` no bloquea: si el tipo tiene al menos 1 `Verde`, ese tipo cuenta.
  - `Usuario` y `Coach` no cuentan para el filtro.
- **D4.** Migración `Amarillo` → `SinEvaluar`. Literales reales del enum en migración, auditoría y tests: `Verde`, `Rojo`, `Amarillo`, `SinEvaluar`. Cada registro afectado queda en `audit_log` con:
  - actor: usuario sistema `00000000-0000-4000-8000-000000000001` (no existe `system-migration`)
  - valor anterior: `"Amarillo"`; valor nuevo: `"SinEvaluar"`
  - `audit_log.contexto` = `"migration:2026-09-24-influencias-multi-contacto"`
- **D5.** Cada alta, baja, cambio de calificación y cambio de nota de un contacto se audita con la skill `registrar-auditoria`.
- **D6.** La nota pasa a ser por contacto (por fila).
  - Si el tipo tiene contacto, su nota se conserva en ese contacto.
  - Si el tipo no tiene contacto, la migración elimina la fila completa (nota, calificación y fila). El texto no se conserva en `audit_log` ni en otra tabla.
  - Antes de eliminar, la migración escribe en consola solo números e ids: (a) conteo total de filas con `contacto_ouv_id` NULL, (b) cuántas de esas estaban en `Verde`, (c) la lista de `ouv_id` de (b). Sin texto de notas.
  - Si (b) es mayor que 0, se anota en el RESUMEN y no se ejecuta la migración en ningún ambiente hasta nueva orden.
- **D7.** El único pasa de `(ouv_id, tipo)` a `(ouv_id, tipo, contacto_ouv_id)`. No hay índice parcial. Hoy la tabla no tiene `deleted_at`; la migración lo agrega y el modelo queda `paranoid: true`. El índice único incluye filas borradas. Al agregar un contacto, el servicio busca primero una fila soft-deleted con la misma terna y la restaura (`restore`, `estado` = `SinEvaluar`, `notas` = null) en lugar de insertar.

La función pura `evaluateInfluenceFilter` vive en el servicio. No hay motor de reglas ni tabla de configuración. El `down` de la migración restaura la estructura y el enum. No revierte los valores ya migrados (`Amarillo` no vuelve).

## Trade-offs aceptados

- La migración de `Amarillo` pierde el matiz de la calificación anterior.
- El `Rojo` no bloquea el filtro.
- El límite es de 5 contactos por tipo.
- Las notas escritas en tipos de influencia sin contacto se pierden de forma irreversible. Decisión explícita del arquitecto.
- El `down` no restaura `Amarillo` ni las notas descartadas.
