# RESUMEN-PASO-8 — Recordatorio en la interacción y tab del detalle

Fecha: 2026-10-17. Sin push. Este paso queda sin commit.

## AJ9

Evilio aprobó el paso 7 con revisión visual propia y no listó ajustes. No hubo corrección AJ9.

## G2

`64f66bfec447d54a7384f37ea82e735b043c3f6f` — `feat(recordatorios-ouv): paso 7 — tab OUVs Asignadas`

## Archivos

- `frontend/src/modules/discovery/api/ouv-interacciones-api.ts` — `recordatorio` opcional en el alta. El hilo usa un payload sin ese campo.
- `frontend/src/modules/discovery/api/ouv-recordatorios-api.ts` — `fetchOuvRecordatorios`
- `frontend/src/components/reminders/reminders-api.ts` — `completeReminder` y `cancelReminder`
- `frontend/src/modules/discovery/components/ReminderFields.tsx` — fecha y hora con los pickers de la app
- `frontend/src/modules/discovery/components/InteraccionesPreventaPanel.tsx` — el bloque solo en el alta
- `frontend/src/modules/discovery/components/OuvDetailNav.tsx` — tab Recordatorios
- `frontend/src/modules/discovery/lib/ouv-detail-tab.ts` — `?tab=recordatorios`
- `frontend/src/modules/discovery/components/OuvRecordatoriosPanel.tsx`
- `frontend/src/modules/discovery/pages/OuvDetailPage.tsx` — el tab y el refresco
- `frontend/src/components/reminders/ReminderTrayList.tsx` y `types.ts` — nombre del responsable

## Decisiones

`DatePickerField` y `TimePickerField` existen. `ReminderFields` los usa en lugar de `datetime-local`. No se copió la validación del diseño: la fecha futura, los días y la nota se validan en el modal antes de enviar. El picker de hora de esta app no tiene el prop `editable` del diseño; queda el desplegable de pasos de 30 minutos.

La fecha se manda con `new Date(valorLocal).toISOString()`, igual que `InteractionReminderModal` de leads. Se asume el navegador en hora de Colombia. Un navegador en otra zona enviaría otra hora UTC.

Con el checkbox apagado el body no lleva `recordatorio`. El padre calcula `remindsImmediately` como `event_at − días × 24 h < ahora` y se lo pasa al bloque. Si el servidor responde `{ code, message }`, el modal muestra `code: message`, no se cierra y no borra lo escrito. El botón queda deshabilitado mientras se envía.

Al guardar, se vuelve a pedir la lista de interacciones. Si hubo recordatorio, sube `remindersTick`. El tab Recordatorios, al abrirse, pide `GET /discovery/ouvs/:ouvId/recordatorios` otra vez. No hay recarga de página.

`canAct` compara `item.user_id` con `usuarioActual.user_id`. Soporte ve el nombre del responsable y no ve las acciones ajenas. Cancelar sigue usando el `window.confirm` del paso 6. Completar o cancelar refresca la lista y, si el servidor responde 403 o 409, muestra ese error.

## Comparación visual

No hay navegador en esta sesión. La comparación es de markup contra `InteraccionesPreventaPanel`, `OuvDetailNav` y `OuvRecordatoriosPanel` del diseño, en claro, oscuro y móvil.

Igual al diseño: checkbox «Recordarme» con la campana, Fecha y Hora en grilla de dos columnas que se apila bajo `sm`, tabs con el mismo borde activo e inactivo, tarjeta del panel y lista de ítems con borde. Claro y oscuro salen de los tokens (`bg-bg`, `text-ink`, `border-border`). En móvil el nav hace wrap y la lista no fuerza scroll horizontal de página.

Diferencias intencionales:

- El alta también pide «Avisar días antes» y «Nota». El diseño solo pide fecha y hora, y guarda el recordatorio en `localStorage`.
- Vacío: «Esta OUV no tiene recordatorios». El diseño dice «Aún no hay recordatorios para esta OUV.»
- Cada ítem muestra el título de la interacción, la fecha del evento en hora de Bogotá y el nombre del responsable. El diseño recalcula vencido/programado en el cliente y no muestra al responsable.
- El estado es el del servidor (Pendiente, Enviado, Cancelado, Realizado). No hay intervalo de 15 s.
- Solo el dueño del recordatorio ve completar y cancelar.

## Verificación

`npm run build` del frontend en verde (400 módulos). `eslint` sin errores en los archivos tocados. En `OuvDetailPage` e `InteraccionesPreventaPanel` quedaron comentarios de eslint sobre efectos que ya estaban; no se reescribieron.

No existe `seed-datos-demo`. Se usó `backend/scripts/tmp-paso8-check.js`: clonó una OUV `EnCurso` con consecutivo `ZP8-OUV`, llamó el API y borró la OUV, las interacciones y los recordatorios. `leftover` de `ZP8-%` quedó en 0. El script se eliminó.

| Caso | Resultado |
|---|---|
| Alta sin recordatorio | 201, `recordatorio` null |
| Alta con `event_at` a +1 día y 30 días de aviso | 201, `event_at` futuro y `remind_at` ya pasado |
| `event_at` pasado | 400 `VALIDATION_ERROR`. El título no quedó en la bitácora |
| Listado | `ZP8 con recordatorio` y después `ZP8 event_at lejano` (`event_at` ascendente) |
| Completar el del responsable | 200 |
| Cancelar ese mismo, ya realizado | 409 `CONFLICT` |
| Otro usuario (SoporteComercial) completa el otro | 403 `FORBIDDEN` |
| El responsable cancela el que sigue pendiente | 200 |

## Prueba manual para Evilio

1. Entra como EjecutivoComercial dueño de una OUV en curso. Abre `/opportunities/:id?tab=interacciones`.
2. Registra una interacción con «Recordarme» apagado. Debe aparecer en la lista y el tab Recordatorios debe decir que no hay recordatorios.
3. Registra otra con el checkbox activo, fecha futura, 0 días y una nota. El modal debe avisar que el aviso sale de inmediato. Al guardar, la interacción queda y el tab Recordatorios muestra el ítem con tu nombre, la fecha en hora de Bogotá y las acciones.
4. Prueba una fecha pasada: el modal no se cierra y no se pierde el título.
5. Marca como realizado. El estado pasa a Realizado y desaparece Cancelar.
6. Crea otro pendiente y cancélalo. El `window.confirm` debe salir antes, y el estado queda Cancelado.
7. Entra como SoporteComercial en la misma OUV. Ves los recordatorios y el nombre del comercial, sin botones de completar o cancelar.
8. Revisa el mismo flujo en tema oscuro y con el ancho de un móvil: la fecha y la hora se apilan, y la página no se desplaza de lado.

## Fuera de este paso

No se cableó la campana ni el refetch del paso 9.
