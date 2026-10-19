# RESUMEN-PASO-1 — Spec EARS y registro de decisión

Fecha: 2026-10-17. Se aplicaron las respuestas del Paso 0. Prevalecen sobre el prompt maestro.

## Archivos creados

| Archivo | Contenido |
|---|---|
| `specs/decisions/2026-10-17-recordatorios-ouv.md` | D1–D10, alternativas descartadas y trade-offs. A1–A12 recogen la aprobación del Paso 0 (FK real, diseño, tab, transacción solo OUV, hooks de auditoría, CASL `Opportunity`, UTC, `dispatchDue`). |
| `specs/recordatorios-ouv/spec.md` | Objetivo, alcance, DDL con `ouv_interaction_id`, contratos HTTP, EARS REQ-01 a REQ-29. |
| `specs/recordatorios-ouv/RESUMEN-PASO-1.md` | Este archivo. |

No se tocó código de aplicación ni `crm-e2e-DesignJD`.

## Qué cambió respecto del prompt maestro

- Se eliminó el requisito de varios roles. La numeración siguiente se corrió uno: el antiguo REQ-13 es el REQ-12, y así hasta el antiguo REQ-30, que queda REQ-29.
- La FK referencia `ouv_interactions(ouv_interaction_id)` con charset `utf8mb4` y collation `utf8mb4_0900_ai_ci`.
- El semáforo en pantalla es el círculo del diseño, no un badge de texto. El color lo manda `follow_up_status`.
- La X del diseño cancela (`status = Cancelado`) solo si está `Pendiente` y no realizado.
- El listado nuevo es `GET /api/v1/qualification/assigned-ouvs`. `GET /discovery/ouvs` no se modifica.
- Graph reutiliza `AZURE_*` y `GraphClientService`. El job es `setInterval` con `FOR UPDATE SKIP LOCKED`.
- `event_at` futuro se valida solo en el alta de OUV.
- Auditoría por los hooks existentes. Sin subject `Reminder`.
- Deuda anotada y fuera de alcance: los POST de recordatorio de lead y de SQL piden `read`, no `update`.

## Trazabilidad

| REQ | Qué exige | Paso |
|---|---|---|
| REQ-01 | Exactamente una fuente | 2 (CHECK y FK), 3 (validador y alta) |
| REQ-02 | Rechazo 400 si hay dos fuentes o ninguna | 2 (tests del validador), 3 |
| REQ-03 | Leads/SQL sin cambio de comportamiento | 3 (regresión), 11 |
| REQ-04 | Interacción de OUV + recordatorio en la transacción ya existente | 3, 8 |
| REQ-05 | Recordatorio inválido o `event_at` no futuro aborta toda la operación de OUV | 3, 8 |
| REQ-06 | `event_at`, `remind_days_before` default 1, `note`, mismo `remind_at` y responsable | 3, 8 |
| REQ-07 | `audit_log` vía hooks, sin escrituras manuales | 3 |
| REQ-08 | Ejecutivo: solo sus OUVs, filtro en el servidor | 4, 7 |
| REQ-09 | Soporte: todas, con filtro por comercial | 4, 7 |
| REQ-10 | `comercial_id` de un ejecutivo se ignora | 4 |
| REQ-11 | `page` / `limit` / `total` y draft/applied | 4, 7 |
| REQ-12 | Tab del detalle: lista por `event_at` y cancelar si `Pendiente` no realizado | 3, 8 |
| REQ-13 | Campana: recordatorios propios de las dos fuentes, con enlace | 5, 9 |
| REQ-14 | Vencidos / hoy / próximos en Bogotá; los realizados no entran | 5, 9 |
| REQ-15 | Flag apagado → `NOT_REQUIRED` | 3 (valor al crear), 10 |
| REQ-16 | Flag encendido → `PENDING` y job crea el evento, con `SKIP LOCKED` | 3 (marca `PENDING`), 10 |
| REQ-17 | Editar o cancelar un `SYNCED` actualiza o borra el evento | 3 (dispara el estado), 10 |
| REQ-18 | Fallo o 403 de Graph no revierte el recordatorio | 10 |
| REQ-19 | Listados de REQ-08, 09, 12 y 13 en menos de 2 s | 4 (índice y `EXPLAIN`), 11 |
| REQ-20 | Marcar realizado: `completed_at`, sin tocar `status` ni Outlook | 3, 8, 9 |
| REQ-21 | Rechazo si está cancelado, eliminado o ya realizado | 3 |
| REQ-22 | `dispatchDue` exige `completed_at IS NULL` | 3 |
| REQ-23 | El listado trae `next_reminder_at` y `follow_up_status` | 4, 6, 7 |
| REQ-24 | Fecha anterior a ahora → `RED` | 4, 7 |
| REQ-25 | Entre ahora y el fin del día (hoy + N) → `YELLOW` | 4, 7 |
| REQ-26 | Posterior a ese fin de día → `GREEN` | 4, 7 |
| REQ-27 | Sin recordatorios no realizados → `NONE`, círculo gris | 4, 6, 7 |
| REQ-28 | Filtro y orden SQL: RED, YELLOW, GREEN, NONE | 4, 7 |
| REQ-29 | Una sola consulta agrupada por OUV | 4 |

## Cómo probar este paso

Lectura de los tres archivos. No hay migración ni servidor que levantar. Comprobar que la spec no menciona `ouv_interactions.id`, ni subject `Reminder`, ni `MS_GRAPH_*`, ni `@nestjs/schedule`, y que REQ-12 (varios roles) no aparece.

## Riesgos

- `GET /api/v1/reminders` cruza lead y OUV. En el paso 5 hay que respetar el límite de módulos: `Reminder` vive en demand-generation y la OUV en discovery, que ya exporta `OuvsService` y `OuvInteraccionesService`.
- El 403 y el 404 de interacciones de OUV hoy son texto plano. La spec no los unifica con `{ code, message }` para no cambiar errores que el cliente ya recibe.
- `--semaphore-amarillo` necesita variante oscura que el diseño no trae. Si se copia el `tokens.css` de diseño, se pierden `--estado-*` de `crm-e2e`.

## Preguntas abiertas

Ninguna.
