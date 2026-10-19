# QA — Recordatorios de OUV

Fecha: 2026-10-17. Una fila por REQ-01 a REQ-29.

«Manual Evilio» es lo que pide la UI o un buzón real. El Paso 7 se cerró con revisión visual. Los pasos 8 y 9 se cerraron con «APROBADO» después de la prueba manual pedida en cada resumen. El Paso 10 trae el detalle del buzón.

| Req | Cómo se probó | Evidencia | Resultado |
|---|---|---|---|
| REQ-01 | Test automático | `reminder.model.spec.ts`: una sola fuente. `SHOW CREATE TABLE` del Paso 2, `chk_reminders_single_source` | OK |
| REQ-02 | Test automático | El mismo spec rechaza las dos fuentes y ninguna. El Paso 2 probó el INSERT inválido contra MySQL | OK |
| REQ-03 | Test automático | `reminders.service.spec.ts`: el alta de lead acepta `event_at` pasado y no escribe `ouv_interaction_id`. El POST de SQL sigue delegando sin esa validación | OK |
| REQ-04 | Test automático y manual Evilio | `ouv-interacciones.service.spec.ts`: interacción y recordatorio en la misma transacción. Paso 8: alta con «Recordarme» en el detalle | OK |
| REQ-05 | Test automático y manual Evilio | El spec hace rollback si `event_at` no es futuro y acepta `remind_at` pasado. Paso 8: fecha pasada, el modal no se cierra | OK |
| REQ-06 | Test automático | DTO `remind_days_before` 0–365, default 1. El alta deja `Pendiente` y `remind_at` con `remindAtFromEvent` | OK |
| REQ-07 | Test automático | `reminder.model.spec.ts`: `afterCreate` y `afterUpdate` pasan por `AuditHooksService`. No hay escritura manual de auditoría | OK |
| REQ-08 | API y manual Evilio | Paso 7: `GET /qualification/assigned-ouvs` del ejecutivo solo devolvió sus `ZP7`. Revisión visual del tab | OK |
| REQ-09 | API y manual Evilio | Paso 7: SoporteComercial con búsqueda `ZP7` vio las 5, incluido el otro comercial, y filtró por `comercial_id` | OK |
| REQ-10 | Test automático y API | `assigned-ouvs.service.spec.ts` ignora el `comercial_id` ajeno. En el Paso 7 el ejecutivo no recibió `ZP7-OTH` | OK |
| REQ-11 | API y manual Evilio | Paso 7: `limit=1` devolvió total 5 y páginas distintas. La página usa draft/applied. Revisión visual del Paso 7 | OK |
| REQ-12 | Test automático y manual Evilio | Listado por `event_at`. Paso 8: tab Recordatorios, realizado y cancelado. Cancelar solo en `Pendiente` | OK |
| REQ-13 | Test automático, API y manual Evilio | `reminders.service.spec.ts` y el script del Paso 9: lead, SQL y OUV con `source_type`. Paso 9: la campana navega a cada fuente | OK |
| REQ-14 | Test automático y manual Evilio | `bogota-day.spec.ts` y `reminder-group.spec.ts`. Paso 9: Vencidos, Hoy y Próximos salen de `event_at` | OK |
| REQ-15 | Test automático | Alta de OUV con el flag distinto de `true` guarda `NOT_REQUIRED`. Con el flag apagado el job no hace `setInterval` | OK |
| REQ-16 | Test automático y manual Evilio | Crear deja `SYNCED` y no hace un segundo `POST`. 30 días envía `reminderMinutesBeforeStart` 40320; el CRM no cambia `remind_days_before`. Paso 10: el evento y la alarma aparecieron en el calendario | OK |
| REQ-17 | Test automático y manual Evilio | Cancelar un `SYNCED` deja `PENDING` y conserva `outlook_event_id`. El job borra el evento; un 404 cuenta como éxito. Paso 10: cancelar en el CRM lo quitó de Outlook | OK |
| REQ-18 | Test automático. Manual del grupo: no probado | 403 y correo fuera de `grupoverytel.com` quedan `FAILED` con intentos en el máximo, sin revertir el recordatorio. Un 5xx suma un intento. Evilio no probó un usuario fuera del grupo | OK automático. Manual del grupo pendiente |
| REQ-19 | API | Paso 4: 2.000 OUVs y 10.000 recordatorios. Cinco corridas, máximo 329 ms. No es el stack HTTP ni un volumen de pre-producción. La subconsulta de interacciones sigue en `type ALL` | OK en esa medición. Deuda de plan anotada |
| REQ-20 | Test automático y manual Evilio | Completar escribe `completed_at` y no toca `status` ni Outlook. Otro usuario recibe 403. Paso 8 en la UI. Paso 10: realizado no modificó el evento | OK |
| REQ-21 | Test automático y API | Cancelado, eliminado o ya realizado responden 409 `CONFLICT`. Paso 8: completar de nuevo dio 409 | OK |
| REQ-22 | Test automático | `dispatchDue` no envía ni marca `Enviado` si `completed_at` tiene valor | OK |
| REQ-23 | Test automático y API | La fila trae `next_reminder_at` y `follow_up_status`. Paso 7: el rojo devolvió la fecha y el punto arma el tooltip en Bogotá | OK |
| REQ-24 | Test automático y API | `follow-up-status.spec.ts`. Paso 7: `ZP7-RED` quedó primero y con estado vencido | OK |
| REQ-25 | Test automático y API | El mismo spec, ventana inclusive de `FOLLOW_UP_YELLOW_DAYS`. Paso 7: filtro `YELLOW` devolvió `ZP7-YEL` | OK |
| REQ-26 | Test automático y API | Fecha posterior al fin del día Bogotá → `GREEN`. Paso 7: `ZP7-GRN` en el orden del ejecutivo | OK |
| REQ-27 | Test automático, API y manual Evilio | Sin recordatorios abiertos → `NONE`. Paso 7: círculo gris y «Sin seguimiento» | OK |
| REQ-28 | API y manual Evilio | Paso 7: orden RED, YELLOW, GREEN, NONE. En soporte, el rojo más antiguo va antes. Filtro por `follow_up_status` | OK |
| REQ-29 | API | Paso 4: un solo `SELECT` con la derivada agrupada por OUV. `EXPLAIN` citado en el resumen de ese paso | OK. La derivada recorre `ouv_interactions` con `type ALL` |
