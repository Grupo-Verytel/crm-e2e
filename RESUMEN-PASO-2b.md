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

`PATCH :id/cita` no acepta `contactos`, email ni teléfono. En Reagendar esos campos se muestran en solo lectura; el nombre del contacto principal sigue editable.

Los tabs ya cumplían la regla y no se tocaron: SoporteComercial ve Enrutamiento y SQL asignados; Ejecutivo Comercial entra a `/qualification/assigned` con el label **Mis SQL**.

Iconos: `icon-btn`, 16px, hover por la clase existente (incluye modo oscuro vía tokens). Tooltip con `title`. `aria-label` `Agendar {lead}` y `Reagendar {lead}`.

## Archivos

- `frontend/src/modules/qualification/pages/RoutingInboxPage.tsx`
- `frontend/src/modules/qualification/pages/AssignedSqlsPage.tsx`
- `frontend/src/modules/qualification/components/SqlCitaScheduleModal.tsx`
- `frontend/src/modules/qualification/components/CitaContactosFields.tsx` (`lockEmailPhone` en Reagendar)
- `frontend/src/modules/qualification/api/sqls-api.ts` (`createAssignedSqlCita`, `vigente`)
- `docs/specs/decisions/2026-09-23-qualification-acciones-cita.md`

`AssignSqlModal.tsx` no se modificó.

Typecheck del frontend (`tsc -b`) en verde en el Paso 2b. El checklist de abajo no se ejecutó contra la UI.

## Ajustes

1. En modo `update`, email, teléfono y contactos adicionales quedan en solo lectura (`readOnly`). No se pueden agregar ni quitar contactos. El nombre del contacto principal, fecha, hora, lugar, duración, cargo y descripción siguen editables. Se quitó el aviso que explicaba el límite del PATCH. El backend y el DTO no se modificaron. Agendar (`create`) sigue editando todos los contactos.
2. Decision record en `docs/specs/decisions/2026-09-23-qualification-acciones-cita.md`. Los DR de este repo están bajo `docs/specs/decisions/`, no en `specs/decisions/` de la raíz. Cubre la matriz de acciones, `POST :id/cita`, la vigencia `vigente` y los pendientes de Cancelar y del permiso de Soporte sobre citas ajenas.

## Checklist E2E

- [ ] SoporteComercial / Enrutamiento: un solo icono Agendar; abre `AssignSqlModal` y asigna como antes.
- [ ] SoporteComercial / SQL asignados, estado `Asignado`, sin cita o `vigente === false`: icono Agendar. La cita pasada sigue visible en la columna Cita.
- [ ] SoporteComercial / SQL asignados, `vigente === true`: la celda Acción es "—".
- [ ] Ejecutivo Comercial: no ve Enrutamiento; el tab dice **Mis SQL**.
- [ ] Ejecutivo dueño, sin cita vigente: Agendar. Tras guardar, la fila muestra Reagendar y el link de Teams.
- [ ] Ejecutivo dueño, cita vigente: solo Reagendar. No aparece Cancelar. Email, teléfono y contactos extra están en solo lectura; el nombre del principal sí se edita. Tras guardar, cambian fecha, hora y link de Teams.
- [ ] `ConvertidoOUV`, `Backlog`, `Descartado` y `EnGestion`: Acción en "—".
- [ ] Doble clic en Agendar/Reagendar no dispara dos peticiones: el botón queda deshabilitado mientras guarda.
- [ ] Si el API responde `CITA_VIGENTE_EXISTS`, se ve el mensaje y la fila se refresca.
- [ ] Tooltips y `aria-label` de Agendar y Reagendar. Modo claro y oscuro. Sin errores de consola en el resto de `/qualification`.
