# RESUMEN-PASO-3 — Frontend de invitados por defecto de la cita SQL

Fecha: 2026-10-29. Rama: `EP-Feature-InvitadosCita`. Sin cambios de código de backend.

## Qué quedó

El tipo `SqlCita` incluye `attendees` (`email`, `name | null`, `user_id | null`, `source`, `sort_order`). El cliente `default-meeting-attendees-api.ts` lista, crea, actualiza (`name` / `is_active`) y elimina con `apiRequest()`. `canManageDefaultAttendees` mira `user.permissions`, no el nombre del rol.

La card «Cita» de `SqlDetailPage` muestra «Invitados (N)» con el ícono `Users` después de los contactos, solo cuando hay cita. Orden por `sort_order`. Si hay nombre, es el título y el correo va debajo; si no, el título es el correo y no se repite. Lista vacía o ausente: «Sin invitados». «Sin cita agendada.» no incluye el bloque.

`QualificationNav` muestra el engranaje `Settings` (36 px, `aria-label` «Invitados por defecto») solo con el permiso. El nav está en SQL asignados, en el dashboard de calificación y en el detalle. Abre `ModalShell` «Invitados por defecto» con el texto de ayuda, el alta (correo requerido, nombre opcional, máximo 120), badges Activo/Inactivo, editar nombre, activar/desactivar y eliminar con `window.confirm`. Vacío: «No hay invitados por defecto. Las citas se agendarán sin invitados adicionales.»

Los errores de class-validator (`message` como `string[]`) se listan uno por uno. Los del servicio (`message` string, por ejemplo el 409) muestran ese texto y no el `code`. `ApiError` guarda el arreglo en `messages`; el `message` unido se conserva para el resto de la app.

No hay tests de frontend en el módulo. No se creó infraestructura de tests.

## Archivos

Nuevos:

- `frontend/src/modules/qualification/api/default-meeting-attendees-api.ts`
- `frontend/src/modules/qualification/lib/can-manage-default-attendees.ts`
- `frontend/src/modules/qualification/components/DefaultMeetingAttendeesModal.tsx`

Modificados:

- `frontend/src/modules/qualification/api/sqls-api.ts`
- `frontend/src/modules/qualification/components/QualificationNav.tsx`
- `frontend/src/modules/qualification/pages/SqlDetailPage.tsx`
- `frontend/src/lib/api/http-client.ts` — conserva cada mensaje de `message: string[]`
- `frontend/src/modules/auth/types.ts` — `ApiError.messages`

## Build y lint

`npm run build` (`tsc -b` y Vite) terminó en verde.

`npm run lint` del frontend no está en verde: 56 problemas (50 errores, 6 warnings) que ya estaban en otras pantallas (`set-state-in-effect`, `preserve-caught-error`, etc.). Los archivos nuevos de esta feature no aportan hallazgos. `SqlDetailPage.tsx` sigue con los tres errores previos (`loadSql` en el efecto y dos `throw new Error` sin `cause`); no se tocaron.

## Comprobación en el navegador

El proceso de backend que escuchaba en el puerto 3000 era anterior a esta feature y respondía `Cannot GET /api/v1/qualification/default-meeting-attendees`. Se reinició con `npm run start` para cargar el código del Paso 2. La sesión de Admin que ya estaba abierta se usó para probar. El correo de prueba `paso3-check@grupoverytel.com` se creó, editó, desactivó, eliminó, volvió a crearse y se eliminó otra vez. Los tres correos del seed quedaron activos.

Hecho:

1. Admin ve el engranaje en `/qualification/assigned` y en `/qualification/dashboard`. Agrega, edita el nombre, desactiva (badge Inactivo y botón Activar), elimina y vuelve a crear el mismo correo. El duplicado muestra «Ese correo ya está en la lista.»
2. En el detalle de un SQL que ya tenía cita (`dbc0bf2f-3585-4f42-b0f0-d68b13924ab2`) la card muestra «Invitados (0)» y «Sin invitados». Esa cita es anterior al snapshot, así que no trae filas.

No se agendó una cita nueva ni se canceló una existente, para no crear un evento de Outlook ni borrar datos de la base. Esos pasos quedan para la prueba manual de abajo. Tampoco se entró con Soporte Comercial, Gerente Comercial ni Ejecutivo Comercial.

## Prueba manual que cierra el paso

Reinicia el backend si el proceso en marcha es anterior a este código. Admin cierra sesión y vuelve a entrar para que el JWT traiga `manage_default_attendees`.

1. Admin: engranaje en SQL asignados y en el dashboard. Agregar, editar nombre, desactivar, eliminar, volver a crear el mismo correo. Un segundo alta del mismo correo muestra «Ese correo ya está en la lista.»
2. Agendar una cita desde Asignar SQL. En la card, «Invitados (N)» lista el snapshot (los activos en el momento del alta). En Outlook, el evento del organizador (`graph_organizer_upn` / `graph_event_id`) incluye esos correos más contactos y Soporte, sin poner al organizador como attendee.
3. Desactivar o borrar un invitado de la lista. La cita del paso 2 conserva los mismos invitados en la card.
4. Reagendar con `PATCH` (cambiar fecha u hora). Outlook sigue invitando los correos del snapshot, no la lista viva.
5. Cancelar la cita y comprobar:

```sql
SELECT * FROM sql_cita_attendees WHERE cita_id = '<cita_id>';
```

Tiene que devolver cero filas.

6. Con Soporte Comercial, Gerente Comercial y Ejecutivo Comercial el engranaje no aparece. Esos roles no tienen la regla en `permissions`.
