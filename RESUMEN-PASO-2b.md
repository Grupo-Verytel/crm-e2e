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

Agendar usa el wizard de 4 pasos de `AssignSqlModal` (Asignación y cita, Disponibilidad, Contactos, Confirmación), el mismo en Enrutamiento y en SQL asignados (`scheduleOnly`). La disponibilidad consulta el calendario real de Teams. En SQL asignados el comercial queda en solo lectura y el guardado es `POST /qualification/sqls/:id/cita`. Si el API responde `CITA_VIGENTE_EXISTS`, el modal muestra el mensaje y la bandeja se vuelve a cargar.

Reagendar abre `RescheduleSqlCitaModal` (la vista corta del diseño, sin wizard). Precarga fecha y hora. El Ejecutivo Comercial se muestra en solo lectura: el diseño lo edita, pero `PATCH /qualification/sqls/:id/cita` no acepta `comercial_asignado_id`. Lugar, duración, contactos, cargo y descripción no están en esa vista; el PATCH parcial los deja igual. Al guardar se envían `fecha` y `hora`, y la fila se recarga.

Los tabs ya cumplían la regla y no se tocaron: SoporteComercial ve Enrutamiento y SQL asignados; Ejecutivo Comercial entra a `/qualification/assigned` con el label **Mis SQL**.

Iconos: `icon-btn`, 16px, hover por la clase existente (incluye modo oscuro vía tokens). Tooltip con `title`. `aria-label` `Agendar {lead}` y `Reagendar {lead}`.

## Archivos

- `frontend/src/modules/qualification/pages/RoutingInboxPage.tsx`
- `frontend/src/modules/qualification/pages/AssignedSqlsPage.tsx`
- `frontend/src/modules/qualification/components/AssignSqlModal.tsx` (wizard de Agendar)
- `frontend/src/modules/qualification/components/SqlMeetingContactsEditor.tsx`
- `frontend/src/modules/qualification/components/RescheduleSqlCitaModal.tsx`
- `frontend/src/modules/qualification/api/sqls-api.ts` (`createAssignedSqlCita`, `vigente`)
- `docs/specs/decisions/2026-09-23-qualification-acciones-cita.md`

`AssignSqlModal.tsx` no se modificó.

Typecheck del frontend (`tsc -b`) en verde en el Paso 2b. El checklist de abajo no se ejecutó contra la UI.

## Ajustes

1. Reagendar dejó de usar el modo `update` de `SqlCitaScheduleModal`. Ese modo se eliminó. La vista propia es `RescheduleSqlCitaModal`. El DTO de `PATCH :id/cita` no se modificó. Brecha: el diseño permite cambiar el Ejecutivo Comercial; aquí el campo es solo lectura.
2. Decision record en `docs/specs/decisions/2026-09-23-qualification-acciones-cita.md`. Los DR de este repo están bajo `docs/specs/decisions/`, no en `specs/decisions/` de la raíz. Cubre la matriz de acciones, `POST :id/cita`, la vigencia `vigente` y los pendientes de Cancelar y del permiso de Soporte sobre citas ajenas.

## Checklist E2E

- [ ] SoporteComercial / Enrutamiento: un solo icono Agendar; abre `AssignSqlModal` y asigna como antes.
- [ ] SoporteComercial / SQL asignados, estado `Asignado`, sin cita o `vigente === false`: icono Agendar. La cita pasada sigue visible en la columna Cita.
- [ ] SoporteComercial / SQL asignados, `vigente === true`: la celda Acción es "—".
- [ ] Ejecutivo Comercial: no ve Enrutamiento; el tab dice **Mis SQL**.
- [ ] Ejecutivo dueño, sin cita vigente: Agendar. Tras guardar, la fila muestra Reagendar y el link de Teams.
- [ ] Reagendar abre la vista propia del diseño (no el wizard), con datos precargados; al guardar cambian fecha, hora y link de Teams, y la fila se refresca.
- [ ] `ConvertidoOUV`, `Backlog`, `Descartado` y `EnGestion`: Acción en "—".
- [ ] Doble clic en Agendar/Reagendar no dispara dos peticiones: el botón queda deshabilitado mientras guarda.
- [ ] Si el API responde `CITA_VIGENTE_EXISTS`, se ve el mensaje y la fila se refresca.
- [ ] Tooltips y `aria-label` de Agendar y Reagendar. Modo claro y oscuro. Sin errores de consola en el resto de `/qualification`.
