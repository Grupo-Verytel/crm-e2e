# RESUMEN-PASO-9 — Pestaña Recordatorios de la campana

Fecha: 2026-10-17. Sin push. Este paso queda sin commit.

## G3

`a9434e2223249f6268324b118ee0afd1a19b3ea4` — `feat(recordatorios-ouv): paso 8 — recordatorio en interacción y tab del detalle`

## AJ10

`frontend/src/components/reminders/reminder-errors.ts` traduce el `code` del servidor:

| Código | Texto |
|---|---|
| `VALIDATION_ERROR` | La fecha del recordatorio debe ser futura. |
| `FORBIDDEN` | Solo el responsable puede gestionar este recordatorio. |
| `CONFLICT` | Este recordatorio ya fue realizado o cancelado. |
| `NOT_FOUND` | El recordatorio ya no existe. |
| Cualquier otro | No se pudo completar la acción. Intenta de nuevo. |

El `message` en inglés solo va a `console.error`. Lo usan el modal de interacción, `OuvRecordatoriosPanel` y la campana. La validación del formulario, antes de enviar, sigue en español y no pasa por el mapa.

## Archivos

- `frontend/src/components/reminders/reminder-errors.ts`
- `frontend/src/components/reminders/reminders-api.ts` — `fetchMyReminders`
- `frontend/src/components/reminders/useBellReminders.ts`
- `frontend/src/modules/auth/components/NotificationBell.tsx`
- `frontend/src/modules/auth/context/NotificationsProvider.tsx` — solo `reminderSignal`
- `frontend/src/modules/discovery/components/InteraccionesPreventaPanel.tsx`
- `frontend/src/modules/discovery/components/OuvRecordatoriosPanel.tsx`

## Decisiones

La lista y los conteos viven en `useBellReminders` (`useState`, `useEffect`, `useCallback`). No hay contexto nuevo. `NotificationsProvider` solo suma `reminderSignal` cuando el socket `notification` trae `event_type` o `eventType` igual a `interaction.reminder`. La pestaña Notificaciones sigue metiendo ese aviso en la bandeja, como ya lo hacía el servidor.

`GET /reminders` pide solo `counts` (página de 1, sin grupos) con la campana cerrada. Con la campana abierta pide la lista de los grupos activos. Se vuelve a pedir al montar el header autenticado, al abrir la campana, al subir la señal del socket, al volver la pestaña del navegador (`visibilitychange`) y después de completar o cancelar. No hay intervalo en el cliente. El ciclo del servidor que marca `Enviado` sigue en 60 segundos.

Por defecto están activos Vencidos y Hoy. Próximos entra al pulsarlo. «Ver más» pide la página siguiente y la acumula. En la campana `canAct` es siempre verdadero.

Navegación, y se cierra la campana:

- `LEAD` → `/demand/leads/:id`
- `SQL` → `/qualification/sqls/:id`
- `OUV` → `/opportunities/:id?tab=recordatorios`

El tab Recordatorios de una OUV abierta en otra vista no se refresca en vivo. Se actualiza al volver a abrirlo.

## Comparación visual

No hay navegador en esta sesión. La comparación es de markup contra `NotificationBell` del diseño, en claro, oscuro y móvil.

Igual al diseño: dos pestañas con borde activo `border-accent font-bold text-accent`, campana con `.bell-reminder-active` cuando hay vencidos u hoy (la animación ya se apaga con `prefers-reduced-motion`), panel `w-80` anclado a la derecha. Claro y oscuro salen de los tokens.

Diferencias intencionales:

- El contador turquesa de no leídas no se reemplaza por el de recordatorios. El diseño usa un solo badge. Aquí la campana solo se anima, y el número de vencidos más hoy va en la pestaña Recordatorios.
- La X es Cancelar, con el `window.confirm` del paso 6. El diseño dice Descartar y lo resuelve en `localStorage`.
- Vencidos, Hoy y Próximos salen de `ReminderGroupTabs` y de `counts`. El diseño mezcla vencidos y programados en una sola lista calculada en el cliente.
- Si `total` supera lo cargado, aparece «Ver más». El diseño no pagina.
- El panel usa `max-w-[calc(100vw-1.5rem)]` y `max-h-[calc(100vh-5rem)]` para no salirse de la pantalla.
- Los errores se muestran en español, sin el `code` ni el texto inglés.

## Verificación

`npm run build` del frontend en verde (403 módulos). `eslint` sin errores en los archivos tocados. En `NotificationsProvider` quedaron comentarios sobre el fetch y el hook que ya estaban en ese archivo.

Se usó `backend/scripts/tmp-paso9-check.js` y se borró al terminar. `leftover` de `ZP9-%` quedó en 0. Contra el `GET /reminders` del ejecutivo de prueba:

| Caso | Resultado |
|---|---|
| Lead vencido, SQL de hoy, OUV próxima | `counts` 1, 1 y 1. `source_type` LEAD, SQL y OUV. `group` OVERDUE, TODAY y UPCOMING |
| Filtro `group` | `total` 1 en cada grupo |
| Uno realizado y uno cancelado | No aparecen en la lista |
| Completar el vencido | 200. `OVERDUE` pasa de 1 a 0 |
| Cancelar el de hoy | 200. `TODAY` pasa de 1 a 0 |

## Prueba manual para Evilio

1. Entra con un usuario que tenga un recordatorio vencido o de hoy. La campana debe animarse. El número turquesa de notificaciones no leídas no cambia por eso. En tema oscuro y en un móvil, el panel no debe salirse de la pantalla.
2. Abre la campana. Notificaciones se ve igual que antes. Recordatorios abre en Vencidos y Hoy, con los conteos. Activa Próximos y comprueba que entra esa lista.
3. Pulsa el título de un lead, un SQL y una OUV. Deben ir al detalle del lead, a `/qualification/sqls/:id` y a la OUV en `?tab=recordatorios`, y la campana se cierra.
4. Completa un recordatorio de lead desde la campana. Desaparece de la lista y baja el conteo. Cancela otro: primero sale la confirmación y el texto es Cancelar.
5. Crea una interacción de OUV con «Recordarme», 0 días y fecha a unos 2 minutos. Deja la campana cerrada. El aviso en vivo puede tardar hasta un minuto después de esa hora, que es el ciclo de `dispatchDue`. No recargues la página: la campana debe actualizar el conteo y, si está abierta, la lista. En Notificaciones también entra el aviso «Recordatorio».
6. Cambia de pestaña del navegador y vuelve. Los conteos se vuelven a pedir, sin un temporizador en la página.
7. Provoca un error (por ejemplo, cancelar un recordatorio ya realizado en otra ventana). Debe verse el texto en español, no el código ni el mensaje en inglés. El detalle queda en la consola.

## Fuera de este paso

No se sincroniza en vivo el tab Recordatorios de una OUV que ya esté abierta.
