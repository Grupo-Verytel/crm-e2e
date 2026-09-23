# NOTAS-BLOQUEO-1 — Agendar en SQL asignados y Cancelar

**Fecha:** 2026-09-23
**Agendar:** aprobado (A1–A5) e implementado en el Paso 2a. Ver `RESUMEN-PASO-2a.md`.
**Cancelar:** fuera de alcance. No se muestra ni se implementa.

## Agendar — resuelto

`POST /qualification/sqls/:id/cita` → `SqlsService.createCitaForAssignedSql`.

`AssignSqlModal` no se modificó. Sigue usando `POST /qualification/sqls/:id/assign`.

Ajustes aplicados: la cita pasada crea un evento de Teams nuevo y no mueve el anterior; el 400 de cita vigente usa `CITA_VIGENTE_EXISTS`; `vigente` sale en la respuesta de la cita, calculado en `America/Bogota`.

## Cancelar — fuera de alcance

No hay `DELETE /qualification/sqls/:id/cita` ni columna `sql_citas.estado`. El icono no se implementa. Queda pendiente de negocio. Cuando se autorice, la UI usaría `window.confirm`, sin un componente de confirmación nuevo.
