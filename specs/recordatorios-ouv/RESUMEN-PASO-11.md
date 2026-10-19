# RESUMEN-PASO-11 — QA y cierre

Fecha: 2026-10-17. Sin push.

## G5

`5e5bf1ed89d8875850c0f043544391aeea312749` — `feat(recordatorios-ouv): paso 10 — sincronización con Outlook`

## AJ12

`reminderMinutesBeforeStart` queda en `min(remind_days_before × 1440, 40320)`. `remind_days_before` y `remind_at` no cambian. Quedó en la spec (REQ-16), en el registro de decisión y en un test: 30 días envía 40320.

## Este paso

- `QA-CHECKLIST.md` — REQ-01 a REQ-29.
- `DESPLIEGUE.md` — certification y producción.
- `PR.md` — descripción del PR.
- `RESUMEN-EJECUCION.md` — pasos, archivos, pruebas, deuda y mejoras.
- `AGENTS.md` — endpoints, componentes, `bogota-day.ts`, variables, job y semáforo.

## Regresión

Backend: `Test Suites: 1 failed, 69 passed, 70 total`. `Tests: 20 failed, 453 passed, 473 total`. Los 20 rojos son `mep-contract-wiring.spec.ts`, anteriores a esta rama.

Frontend: `npm run build` en verde, 403 módulos.
