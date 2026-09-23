# RESUMEN-PASO-2b — Columna Acción en /qualification

**Fecha:** 2026-09-23
**Estado:** frontend listo. Paso 3 (ejecución E2E) no iniciado.

V1–V3 no cambiaron la lógica del backend. El detalle está en `RESUMEN-PASO-2a.md`.

## Qué quedó

Enrutamiento sigue abriendo `AssignSqlModal` (sin cambios en ese archivo). La columna Acción muestra solo el icono Agendar (`UserPlus`).

SQL asignados usa `sql.cita.vigente` del API. El cliente no compara fechas.

| Rol | Estado | Sin cita vigente | Con cita vigente |
|---|---|---|---|
| SoporteComercial | `Asignado` | Agendar | — |
| Ejecutivo Comercial dueño | `Asignado` | Agendar | Reagendar |
| Cualquier rol | otro estado | — | — |

Cancelar no se muestra.

`SqlCitaScheduleModal` tiene modo `create` (`POST /qualification/sqls/:id/cita`) y `update` (`PATCH /qualification/sqls/:id/cita`). Usa `CitaContactosFields` y `CitaAvailabilityGrid`. El comercial sale del SQL; no hay selector de reasignación. El submit queda deshabilitado mientras la petición está en curso. Si el API responde `CITA_VIGENTE_EXISTS`, el modal muestra el mensaje y la bandeja se vuelve a cargar. Tras un guardado correcto también se recarga la fila.

`PATCH :id/cita` no acepta `contactos`, email ni teléfono (`forbidNonWhitelisted`). En Reagendar el formulario de contactos se muestra, y al guardar solo viajan fecha, hora, lugar, duración, nombre del contacto principal, cargo y descripción. El modal lo dice en pantalla.

Los tabs ya cumplían la regla y no se tocaron: SoporteComercial ve Enrutamiento y SQL asignados; Ejecutivo Comercial entra a `/qualification/assigned` con el label **Mis SQL**.

Iconos: `icon-btn`, 16px, hover por la clase existente (incluye modo oscuro vía tokens). Tooltip con `title`. `aria-label` `Agendar {lead}` y `Reagendar {lead}`.

## Archivos

- `frontend/src/modules/qualification/pages/RoutingInboxPage.tsx`
- `frontend/src/modules/qualification/pages/AssignedSqlsPage.tsx`
- `frontend/src/modules/qualification/components/SqlCitaScheduleModal.tsx`
- `frontend/src/modules/qualification/api/sqls-api.ts` (`createAssignedSqlCita`, `vigente`)

`AssignSqlModal.tsx` no se modificó.

Typecheck del frontend (`tsc -b`) en verde. No hay herramienta de navegador en esta sesión: el checklist de abajo no se ejecutó contra la UI.

## Checklist E2E

- [ ] SoporteComercial / Enrutamiento: un solo icono Agendar; abre `AssignSqlModal` y asigna como antes.
- [ ] SoporteComercial / SQL asignados, estado `Asignado`, sin cita o `vigente === false`: icono Agendar. La cita pasada sigue visible en la columna Cita.
- [ ] SoporteComercial / SQL asignados, `vigente === true`: la celda Acción es "—".
- [ ] Ejecutivo Comercial: no ve Enrutamiento; el tab dice **Mis SQL**.
- [ ] Ejecutivo dueño, sin cita vigente: Agendar. Tras guardar, la fila muestra Reagendar y el link de Teams.
- [ ] Ejecutivo dueño, cita vigente: solo Reagendar. No aparece Cancelar. Tras guardar, cambian fecha, hora y link de Teams.
- [ ] `ConvertidoOUV`, `Backlog`, `Descartado` y `EnGestion`: Acción en "—".
- [ ] Doble clic en Agendar/Reagendar no dispara dos peticiones: el botón queda deshabilitado mientras guarda.
- [ ] Si el API responde `CITA_VIGENTE_EXISTS`, se ve el mensaje y la fila se refresca.
- [ ] Tooltips y `aria-label` de Agendar y Reagendar. Modo claro y oscuro. Sin errores de consola en el resto de `/qualification`.
