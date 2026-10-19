# RESUMEN-EJECUCION — Recordatorios de OUV

Fecha: 2026-10-17. Rama `EP-Feature-Remember`. Sin push.

## Pasos y commits

Los pasos 0 y 1 no tienen commit propio. Sus resúmenes entraron en el commit del Paso 2.

| Paso | Commit | Mensaje |
|---|---|---|
| 0 | (dentro del Paso 2) | Inventario. `RESUMEN-PASO-0.md` |
| 1 | (dentro del Paso 2) | Spec y decisiones. `RESUMEN-PASO-1.md` |
| 2 | `25ae53c1c70a72be38a853a013794eec0f740b07` | `feat(recordatorios-ouv): paso 2 — migracion y modelo de reminders` |
| 3 | `9d0db2b473d1c8b352f9353bf477372998c81e3f` | `feat(recordatorios-ouv): paso 3 — recordatorios en la interaccion de OUV` |
| 4 | `851d430a7c68c8569b7579cb3d313b5898552cd7` | `feat(recordatorios-ouv): paso 4 — listado assigned-ouvs y semaforo` |
| 5 | `7b7406910ca80546f827b65363c477a3a140dd37` | `feat(recordatorios-ouv): paso 5 — campana de recordatorios del usuario` |
| 6 | `00d7544288948d9106b9963df00d6b6feb9aca5e` | `feat(recordatorios-ouv): paso 6 — componentes de presentacion y tokens` |
| 7 | `64f66bfec447d54a7384f37ea82e735b043c3f6f` | `feat(recordatorios-ouv): paso 7 — tab OUVs Asignadas` |
| 8 | `a9434e2223249f6268324b118ee0afd1a19b3ea4` | `feat(recordatorios-ouv): paso 8 — recordatorio en interacción y tab del detalle` |
| 9 | `6bed18ec74d247e606e687d46e19942d595b138d` | `feat(recordatorios-ouv): paso 9 — recordatorios en la campana` |
| 10 | `5e5bf1ed89d8875850c0f043544391aeea312749` | `feat(recordatorios-ouv): paso 10 — sincronización con Outlook` |
| 11 | este commit | `docs(recordatorios-ouv): paso 11 — QA, despliegue y cierre` |

El Paso 11 también lleva AJ12: la alarma de Outlook queda en `min(días × 1440, 40320)`.

## Archivos por paso

- Paso 2. Migración `20261017100000-extend-reminders-ouv-source.js`, enum `outlook-sync-status`, `reminder.model.ts` y su spec, `ouv-interaction.model.ts`, resúmenes 0, 1 y 2.
- Paso 3. DTO de respuesta, controlador y servicio de interacciones de OUV, `ouv-recordatorios.controller.ts`, DTOs de interacción y respuesta, specs, `package.json` (`@nestjs/mapped-types`), resumen 3.
- Paso 4. `bogota-day.ts`, `follow-up-status.ts`, `assigned-ouvs` (controller, service, query, DTOs, specs), variables de ejemplo, resumen 4.
- Paso 5. `reminders.controller.ts`, DTOs y SQL de `GET /reminders`, `reminder-group.ts`, `reminders.service.ts`, resumen 5.
- Paso 6. `frontend/src/components/reminders/`, `ReminderFields`, `FollowUpDot`, tablas y filtros de asignadas, tokens, spec y decisión, resumen 6.
- Paso 7. `AssignedOuvsPage`, API, `QualificationNav`, ruta, resumen 7.
- Paso 8. API de interacción y de recordatorios, `OuvRecordatoriosPanel`, tab del detalle, `reminders-api.ts`, resumen 8.
- Paso 9. `useBellReminders`, `reminder-errors.ts`, campana y `NotificationsProvider`, resumen 9.
- Paso 10. `OutlookReminderSyncService`, `outlook-sync.ts`, export de `GraphClientService`, `completed_at` en el DTO de lead, variables `OUTLOOK_SYNC_*` y `CRM_PUBLIC_URL`, resumen 10.
- Paso 11. AJ12 en `outlook-sync.ts` y su spec, spec REQ-16, decisión AJ12, `AGENTS.md`, `QA-CHECKLIST.md`, `DESPLIEGUE.md`, `PR.md`, este archivo.

## Pruebas

- Por paso: los jest citados en cada `RESUMEN-PASO-N.md`. El Paso 4 midió el listado en 329 ms como máximo con 2.000 OUVs y 10.000 recordatorios.
- Paso 10, buzón de Evilio: alta y alarma OK, cancelar elimina el evento OK, realizado no lo modifica OK. Usuario fuera del grupo: no probado.
- Paso 11, backend, `npx jest --no-coverage --forceExit`: `Test Suites: 1 failed, 69 passed, 70 total`. `Tests: 20 failed, 453 passed, 473 total`. Los 20 rojos son `mep-contract-wiring.spec.ts`.
- Paso 11, frontend, `npm run build`: `tsc -b && vite build`, 403 módulos, en verde.
- AJ12: `buildOutlookEvent` con 30 días envía `reminderMinutesBeforeStart` 40320. Ese test entra en los 453 verdes.

## Deuda

- `npm run lint` del frontend falla en archivos que esta funcionalidad no toca (`DatePickerField`, modales de cuentas y otros).
- `reminder-errors.ts` trata todo `VALIDATION_ERROR` como un error de fecha.
- La subconsulta del semáforo recorre `ouv_interactions` con `type ALL`.
- Un recordatorio abierto de una OUV Ganada, Perdida o Descartada sigue notificando. `dispatchDue` no mira el resultado de la OUV.
- `POST` de recordatorio de lead y de SQL exige `read`, no `update`.
- `dispatchDue` no usa `SKIP LOCKED`. Con más de una instancia puede duplicar notificaciones.
- `OuvInteraction` carga `Reminder` con un `require` diferido, por el ciclo de módulos de Sequelize.
- `mep-contract-wiring.spec.ts` no arranca en esta suite: `AuthModule` pide `JWT_SECRET` y el doble de `ConfigService` del test no lo cubre. No es de esta rama.

## Mejoras futuras

- Sincronizar con Outlook los recordatorios de lead y de SQL.
- Editar un recordatorio.
- Cancelar los recordatorios abiertos cuando la OUV se cierra.
- Refrescar en vivo el tab Recordatorios de una OUV que ya está abierta.
