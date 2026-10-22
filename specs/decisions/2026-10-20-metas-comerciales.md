# 2026-10-20 — Metas comerciales por trimestre Verytel

Estado: cerrada en el Paso 0 autónomo. No cambia el stack, no agrega dependencias y no crea un rol.

Las decisiones D1–D7 vienen del prompt. Las preguntas que el repo no cerraba están en `specs/metas-comerciales/DECISIONES-AUTONOMAS.md` (DA-01 a DA-14). Evilio debe validar sobre todo DA-01 (ruta del dashboard), DA-02 (catálogo `segments`, incluye «Otros») y DA-14 (no se ejecutó la migración: `DB_HOST` no es local).

## D1 — Calendario Verytel

Q1 = 1 feb–30 abr, Q2 = 1 may–31 jul, Q3 = 1 ago–31 oct, Q4 = 1 nov–31 ene del año siguiente. El año fiscal es el año en que empieza el trimestre: enero pertenece al Q4 del año anterior. Los rangos no se persisten. Un solo helper de backend, `backend/src/common/time/verytel-quarter.ts`, calcula el trimestre y los límites con `bogota-day.ts` (America/Bogota, UTC−5, sin horario de verano). El tablero de OUVs sigue con sus trimestres de calendario (`ouv-dashboard-metrics.ts`); este helper no lo reemplaza.

## D2 — Unicidad con soft-delete

Una fila viva por `user_id + fiscal_year + quarter + segment_id`. El índice único incluye una columna generada `active_marker = IF(deleted_at IS NULL, 1, NULL)`, el mismo recurso que `kickoffs.active_ouv_id`. Una meta eliminada deja el marcador en NULL y no bloquea volver a crear la combinación.

## D3 — Alcance

Solo alta, edición, eliminación lógica, listado filtrado y resumen por trimestre. El avance contra ventas queda fuera.

## D4 — Permiso, no nombre de rol

Subject nuevo `CommercialGoal` con `create`, `read`, `update` y `delete`. Lo reciben `SoporteComercial` y `Admin` en `buildPermissions` y en una migración de datos re-ejecutable. Los endpoints usan `@CheckAbility`. El engranaje y la ruta miran `user.permissions`. Ningún guard nuevo compara `role_name`.

## D5 — Valor en COP entero

Columna `amount_cop DECIMAL(18,0) NOT NULL`, alineada a los montos del repo (`DECIMAL(18,2)` en OUVs) sin decimales. El API transporta el valor como string de dígitos. El máximo aceptado es `Number.MAX_SAFE_INTEGER`. La UI formatea con separador de miles `es-CO`.

## D6 — Segmento del catálogo existente

La meta guarda `segment_id` (FK a `segments.id`). No se crea catálogo ni se usa el ENUM `ouvs.segmento`. El detalle está en DA-02.

## D7 — Auditoría por los hooks ya existentes

`AuditHooksService` escribe `audit_log` en create (snapshot), update (una fila por campo, valor anterior y nuevo) y destroy (soft-delete). `AuditWriterService` toma `usuario_id` del contexto de la petición. No se agrega `created_by`: el autor ya queda en `audit_log`. Soporte Comercial no ve hoy el módulo de Auditoría (DA-08); no se le otorga `AuditLog`.
