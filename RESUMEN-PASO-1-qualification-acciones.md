# RESUMEN-PASO-1 — Acciones en /qualification (Enrutamiento y SQL asignados)

**Fecha:** 2026-09-23
**Estado:** spec cerrada con la aprobación de `POST /qualification/sqls/:id/cita` (A1–A5). Backend en `RESUMEN-PASO-2a.md`. Frontend (Paso 2b) no iniciado.
**Nota de archivo:** no se sobrescribió `RESUMEN-PASO-1.md` (gate de modelos OUV v1.2, 2026-08-07).

Guía visual: `crm-e2e-DesignJD`. La disposición de acciones la manda el prompt más estas respuestas. Nombres de archivos, campos, endpoints y roles los manda el repo `crm-e2e`.

---

## Decisiones cerradas

1. En Enrutamiento, Agendar es el Asignar actual. Conserva `AssignSqlModal` y `POST /qualification/sqls/:id/assign`: asigna el SQL al comercial y, si el modal lleva cita, agenda la reunión. No se cambia esa lógica.
2. Cita vigente = la fila `sql_citas` existe, no está cancelada, y su fecha/hora en `America/Bogota` es mayor o igual que ahora. Una cita pasada no es vigente: la acción pasa a Agendar. La columna Cita sigue mostrando esa cita pasada (fecha, hora y link de Teams).
3. La columna Acción solo pinta iconos si `sql.estado === 'Asignado'`. En `EnGestion`, `ConvertidoOUV`, `Backlog` y `Descartado` la celda es "—" y no hay acciones.
4. No se abren permisos. En SQL asignados, SoporteComercial ve Agendar si no hay cita vigente, y "—" si la hay. Reagendar y Cancelar quedan solo para el Ejecutivo Comercial dueño (`comercial_asignado_id` = usuario autenticado). El permiso de Soporte para reagendar o cancelar citas de otro comercial queda pendiente de decisión de negocio.
5. El tab del Ejecutivo Comercial sigue llamándose **Mis SQL**. No se cambian labels.
6. Cancelar queda fuera de alcance. No se muestra ni se implementa. Requiere, en un cambio aparte, `DELETE` y el enum `sql_citas.estado`. Cuando exista, la confirmación será `window.confirm`, sin un componente nuevo.

Zona horaria de la vigencia: `America/Bogota`, calculada en backend (`isCitaVigente`). La respuesta de cita incluye `vigente`. El frontend no reimplementa la comparación.

En este repo `sql_citas` no tiene columna `estado` ni `deleted_at`. "No cancelada" es verdadero para toda fila existente.

Agendar en un SQL ya asignado es `POST /qualification/sqls/:id/cita` (`createCitaForAssignedSql`). No usa `AssignSqlModal` ni `POST :id/assign`. No cambia `comercial_asignado_id`, `estado` ni `fecha_asignacion`. Lo llaman SoporteComercial o el Ejecutivo dueño. Si ya hay cita vigente, responde 400 `CITA_VIGENTE_EXISTS`. Si la cita ya pasó, crea un evento de Teams nuevo y sobrescribe la fila (`graph_event_id`, link, fecha, hora, contactos); el evento anterior no se modifica. `PATCH :id/cita` no se amplía a Soporte.

---

## Spec EARS

- WHEN el usuario con rol SoporteComercial visualiza el tab Enrutamiento, THE SYSTEM SHALL ofrecer por fila la acción Asignar actual, mediante `AssignSqlModal` y `POST /qualification/sqls/:id/assign`, sin Reagendar ni Cancelar en esa columna.
- WHEN el usuario con rol EjecutivoComercial abre `/qualification`, THE SYSTEM SHALL mostrar solo el tab **Mis SQL** (`/qualification/assigned`) y SHALL ocultar Enrutamiento.
- WHILE `sql.estado` no sea `Asignado`, WHEN el SQL se visualiza en SQL asignados, THE SYSTEM SHALL mostrar "—" en Acción y SHALL NOT mostrar Agendar, Reagendar ni Cancelar.
- WHILE `sql.estado` sea `Asignado` y no haya cita vigente, WHEN SoporteComercial o el Ejecutivo Comercial dueño agenda, THE SYSTEM SHALL llamar a `POST /qualification/sqls/:id/cita` sin cambiar `comercial_asignado_id`, `estado` ni `fecha_asignacion`.
- IF ya existe una cita vigente, THEN THE SYSTEM SHALL responder 400 con código `CITA_VIGENTE_EXISTS` y SHALL NOT crear ni modificar un evento de Teams.
- IF la cita existente ya pasó, WHEN se agenda de nuevo, THE SYSTEM SHALL crear un evento de Teams nuevo, SHALL actualizar la fila `sql_citas` (fecha, hora, contactos, link, `graph_event_id`) y SHALL NOT modificar el evento de Teams anterior.
- WHEN esa fila se sobrescribe, THE SYSTEM SHALL auditar valor anterior y nuevo de fecha, hora, link y `graph_event_id`, con usuario y timestamp.
- WHERE se devuelve una cita, THE SYSTEM SHALL incluir `vigente`, calculado en backend en `America/Bogota`.
- WHILE `sql.estado` sea `Asignado` y haya cita vigente, WHEN el usuario es SoporteComercial, THE SYSTEM SHALL mostrar "—" en Acción.
- WHILE `sql.estado` sea `Asignado` y haya cita vigente, WHEN el usuario es el Ejecutivo Comercial dueño, THE SYSTEM SHALL mostrar Reagendar mediante `PATCH /qualification/sqls/:id/cita` y SHALL NOT mostrar Cancelar.
- WHILE exista una fila en `sql_citas`, WHEN se visualiza la columna Cita, THE SYSTEM SHALL mostrar esa cita aunque `vigente` sea false.
- WHEN Reagendar termina con éxito, THE SYSTEM SHALL recargar la fila para que fecha, hora, link y `vigente` salgan del detalle actualizado.
- Cancelar está fuera de alcance: THE SYSTEM SHALL NOT mostrar ni implementar esa acción hasta que existan `DELETE` y `sql_citas.estado`.

---

## Qué queda para el Paso 2b

| Pieza | Estado |
|---|---|
| Enrutamiento: dejar solo Asignar / Agendar con `AssignSqlModal` | La bandeja de este repo ya no tiene Reagendar ni Cancelar. El handler se conserva. |
| Tab Enrutamiento oculto para Ejecutivo Comercial y label **Mis SQL** | Ya está así. No se toca. |
| Celda "—" si el estado no es `Asignado` | Frontend, cuando se agregue la columna. |
| Soporte con cita vigente → "—" | Frontend. No llama a `PATCH :id/cita`. |
| Reagendar solo para el Ejecutivo dueño con cita vigente | `PATCH /qualification/sqls/:id/cita` ya existe. La pantalla es Paso 2b. |
| Icono Cancelar | Fuera de alcance. Requiere `DELETE` y enum `sql_citas.estado`. |
| Icono Agendar en SQL asignados | Backend aprobado e implementado en el Paso 2a. La columna y el modal son Paso 2b. |

---

## Pendiente de negocio

SoporteComercial no puede reagendar ni cancelar la cita de un SQL cuyo `comercial_asignado_id` es otro usuario. `PATCH /qualification/sqls/:id/cita` sigue respondiendo 403 en ese caso. Habilitar a Soporte sobre citas ajenas queda pendiente de decisión de negocio.

Cancelar está fuera de alcance de este cambio. Hace falta un `DELETE` y el enum `sql_citas.estado` (en el diseño, `Cancelada`). Hasta entonces el icono no se muestra.
