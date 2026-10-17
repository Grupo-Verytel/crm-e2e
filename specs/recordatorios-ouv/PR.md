# PR — Recordatorios en interacciones de OUV

## Resumen

Un recordatorio de OUV vive en la tabla `reminders`, con `ouv_interaction_id` en lugar de una tabla nueva. Se crea en la misma transacción que la interacción, se lista en la campana y en el tab de la OUV, y pinta el semáforo de OUVs asignadas. Outlook crea y borra el evento solo si `OUTLOOK_SYNC_ENABLED=true`. Completar no toca el calendario. Lead y SQL siguen como estaban.

## Decisiones

- D1. Una fila en `reminders` y dos FK opcionales, con un `CHECK` de exactamente una fuente.
- D2. Outlook va detrás de `OUTLOOK_SYNC_ENABLED` (default `false`); apagado, el alta queda `NOT_REQUIRED`.
- D3. Se reutiliza `GraphClientService` y `AZURE_*`. El evento va al calendario de `users.email`, no a un buzón de grupo.
- D4. Solo el dominio `grupoverytel.com`. Fuera de ese dominio, o del grupo de Exchange, no hay evento y el recordatorio se conserva.
- D5. Si Graph falla, el CRM no revierte el recordatorio.
- D6. Del diseño solo entra la presentación. No hay store, `localStorage` ni cálculo de color en el cliente.
- D7. Realizado es `completed_at`, no un valor nuevo del enum `status`.
- D8. El amarillo cubre hoy y `FOLLOW_UP_YELLOW_DAYS` días de calendario en America/Bogota (default 2).
- D9. Sin recordatorios abiertos el semáforo es `NONE`: círculo gris y «Sin seguimiento».
- D10. Una interacción nueva no cierra recordatorios. Solo «Marcar como realizado» escribe `completed_at`.

AJ12. La alarma de Outlook es `min(remind_days_before × 1440, 40320)`. El CRM guarda los días reales.

## Cambios por capa

- Backend. Modelo y migración de `reminders`. Alta transaccional en discovery. `GET /qualification/assigned-ouvs` con semáforo. `GET /reminders`, `complete` y `cancel`. Job `OutlookReminderSyncService`.
- Frontend. `components/reminders/`, `FollowUpDot`, `ReminderFields`, tab OUVs asignadas, tab Recordatorios de la OUV y la campana.
- Specs. `specs/recordatorios-ouv/` y `specs/decisions/2026-10-17-recordatorios-ouv.md`.

## Migración

`20261017100000-extend-reminders-ouv-source.js`. Re-ejecutable. Antes exige `interaction_id IS NULL = 0`. El despliegue está en `DESPLIEGUE.md`.

## Variables

`FOLLOW_UP_YELLOW_DAYS`, `OUTLOOK_SYNC_ENABLED`, `OUTLOOK_SYNC_MAX_ATTEMPTS`, `OUTLOOK_SYNC_INTERVAL_MS`, `CRM_PUBLIC_URL`. Graph sigue con `AZURE_TENANT_ID`, `AZURE_CLIENT_ID` y `AZURE_CLIENT_SECRET`.

## Cómo probar

Checklist por requisito: `QA-CHECKLIST.md`.

Backend: `npx jest` en `backend`. En el Paso 11: 70 suites, 473 tests, 453 en verde y 20 en rojo, todos en `mep-contract-wiring.spec.ts` (deuda previa).

Frontend: `npm run build`. En el Paso 11: `tsc -b && vite build`, 403 módulos.

Buzón, ya hecho por Evilio: crear el evento y ver la alarma, cancelar y ver que desaparece, marcar realizado y ver que el evento no cambia. Un usuario fuera del grupo no se probó en el buzón; lo cubre el spec del job.

## Deuda

Lint del frontend en archivos ajenos. `VALIDATION_ERROR` del mapa de errores siempre habla de la fecha. La subconsulta del semáforo hace `type ALL` sobre `ouv_interactions`. Los recordatorios de una OUV cerrada siguen notificando. Los POST de recordatorio de lead y SQL piden `read`, no `update`. `dispatchDue` no está protegido entre instancias. `OuvInteraction` sigue cargando `Reminder` con un `require` diferido. El spec de cableado MEP falla al arrancar sin `JWT_SECRET` en el `ConfigService` real.
