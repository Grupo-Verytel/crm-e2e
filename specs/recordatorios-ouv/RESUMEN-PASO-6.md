# RESUMEN-PASO-6 — Componentes presentacionales

Fecha: 2026-10-17. Solo frontend. No se conectaron `QualificationNav`, `NotificationBell`, `OuvDetailNav` ni `InteraccionesPreventaPanel`. No se empezó el paso 7.

## AJ8 — Índice `idx_reminders_user_due`

La migración `20261017100000-extend-reminders-ouv-source.js` sigue sin commit (`git status` la marca `??`) y no está en `origin`. El repo no tiene base de certification, pre-prod ni producción. No se aplicó en ningún ambiente distinto del local, así que el cambio quedó en esa misma migración.

`idx_reminders_user_due` pasa a `(user_id, completed_at, status, event_at)`. Si el índice ya existe con otras columnas, el `up` lo suelta y lo vuelve a crear. `migration:undo` tardó 3.371 s y `migration:run` 4.266 s. `COUNT(*)` de `reminders` siguió en 1. Las columnas quedaron `user_id`, `completed_at`, `status`, `event_at`.

`EXPLAIN` de la consulta de `GET /reminders` (página de 20, sin filtro de grupo). `possible_keys` incluye el índice nuevo. MySQL sigue eligiendo `idx_reminders_user_id` (`type ref`, `rows` 1, filesort). No se forzó el índice.

```json
[
  {"id":1,"select_type":"PRIMARY","table":"r","type":"ref","possible_keys":"idx_reminders_user_id,idx_reminders_interaction_id,idx_reminders_status_remind_at,idx_reminders_ouv_followup,idx_reminders_user_due","key":"idx_reminders_user_id","rows":1,"Extra":"Using index condition; Using where; Using filesort"},
  {"id":3,"select_type":"DEPENDENT SUBQUERY","table":"ouv_interactions","type":"unique_subquery","key":"PRIMARY","rows":1},
  {"id":2,"select_type":"DEPENDENT SUBQUERY","table":"interactions","type":"unique_subquery","key":"PRIMARY","rows":1}
]
```

## Nota para el Paso 9

No se implementó. La pestaña Recordatorios de la campana debe volver a pedir `GET /reminders` cuando llegue el evento de socket `notification` con `eventType = 'interaction.reminder'`.

## Del diseño al archivo

| Componente de diseño | Archivo creado | Qué se eliminó |
|---|---|---|
| Círculo de `SupportAssignedOuvsPage` + `sql-seguimiento.ts` / `ouv-seguimiento.ts` | `frontend/src/modules/qualification/components/FollowUpDot.tsx` | Cálculo de 7/14 días, `localStorage`, tono por días. El color sale de `follow_up_status`. La fecha solo se formatea. |
| Tabla de `SupportAssignedOuvsPage` | `frontend/src/modules/qualification/components/AssignedOuvsTable.tsx` | `fetchOuvs`, orden en el cliente, `navigate`, escucha de `storage` |
| `AssignedCommercialFiltersPanel` | `frontend/src/modules/qualification/components/AssignedCommercialFiltersPanel.tsx` | Import de `sqls-api`. El selector de Seguimiento es nuevo y vive en el draft hasta Aplicar |
| Bloque «Recordarme» de `InteraccionesPreventaPanel` | `frontend/src/modules/discovery/components/ReminderFields.tsx` | Estado interno, `DatePickerField` con validación de fecha, cálculo de «aviso inmediato» |
| `ReminderTrayList` + filas de `NotificationBell` | `frontend/src/components/reminders/ReminderTrayList.tsx` | `store.ts`, `resolveOuvReminder`, `localStorage`, intervalo que recalcula vencido |
| Tabs de la campana (vencidos / hoy / próximos no existían como tres grupos) | `frontend/src/components/reminders/ReminderGroupTabs.tsx` | Conteos de `RemindersProvider`. Los números llegan por props |

No se portaron `store.ts`, `RemindersProvider.tsx`, `sync-ouv-reminders.ts`, `ouv-seguimiento.ts` ni `sql-seguimiento.ts`.

Tipos: `FollowUpStatus` y `AssignedOuvItem` en `qualification/types/assigned-ouvs.types.ts`. `OuvReminderItem` en `discovery/types/ouv-reminder.types.ts`. `ReminderGroup`, `BellReminderItem` y `RemindersCounts` en `frontend/src/components/reminders/types.ts`.

## Props

`FollowUpDot`: `status: FollowUpStatus`, `nextReminderAt: string | null`. Tonos: RED `bg-danger`, YELLOW `bg-semaphore-amarillo`, GREEN `bg-semaphore-verde`, NONE `bg-muted`. Etiquetas: Vencido / Próximo / Al día / Sin seguimiento. `title` y `aria-label` son «Vencido — 15/10/2026 10:00» (`Intl` en America/Bogota). NONE es solo «Sin seguimiento».

`AssignedOuvsTable`: `items`, `loading`, `onRowClick(ouvId)`, `emptyLabel?`. Columnas: OUV, Título, Empresa, Etapa, Comercial, Seguimiento.

`AssignedCommercialFiltersPanel`: `panelId`, `commercials` (`user_id`, `full_name`), `applied`, `onApply`. El draft incluye `comercial_id` y `follow_up_status`. Aplicar y Limpiar emiten el valor; no hay fetch.

`ReminderFields`: `value` (`enabled`, `event_at` como `datetime-local`, `remind_days_before`, `note`), `onChange`, `errors?`, `remindsImmediately`. Días 0–365, nota máx. 500. La frase «El aviso se enviará de inmediato» solo si `remindsImmediately` es true.

`ReminderTrayList`: `items`, `loading`, `emptyLabel`, `onComplete(id)`, `onCancel(id)`, `onNavigate?(item)`, `canAct(item)`. Muestra Pendiente / Enviado / Cancelado, o Realizado si `completed_at` tiene valor, más la fecha del evento, la nota y `source_label`. «Marcar como realizado» si `canAct` y no está realizado ni cancelado. La X «Cancelar» solo si `canAct`, `status` es `Pendiente` y no está realizado. Cancelar pide `window.confirm`, el mismo patrón que los borrados irreversibles del repo. `aria-label` en los dos botones.

`ReminderGroupTabs`: `counts`, `active: ReminderGroup[]`, `onToggle(group)`. Etiquetas Vencidos / Hoy / Próximos con el número recibido.

## Tokens

`--semaphore-amarillo` en `:root` es `#B8860B` (3.25:1 sobre `--surface` `#FFFFFF`). El mix del diseño (`#edc86b`) quedaba en 1.61:1. En los dos bloques de tema oscuro que usa la app — `:root[data-theme='dark']` en `tokens.css` y `html[data-theme='dark']` en `global.css` — es `#F0B429` (7.70:1 sobre `#2A2A2A`). La clase Tailwind es `bg-semaphore-amarillo` / `text-semaphore-amarillo`. `.bell-reminder-active` está en `global.css` y la animación se apaga con `prefers-reduced-motion: reduce`. `index.css` no entra al tema: `main.tsx` importa `global.css`.

## Verificación

```
rg -n "apiRequest|localStorage|crm-e2e-DesignJD|fetch\(" src/components/reminders src/modules/qualification/components/FollowUpDot.tsx src/modules/qualification/components/AssignedOuvsTable.tsx src/modules/qualification/components/AssignedCommercialFiltersPanel.tsx src/modules/discovery/components/ReminderFields.tsx src/modules/qualification/types/assigned-ouvs.types.ts src/modules/discovery/types/ouv-reminder.types.ts
```

Sin coincidencias.

`npx eslint` sobre esos archivos: sin errores. `npm run lint` del frontend completo sigue fallando en archivos que este paso no tocó (`DatePickerField`, modales de cuentas, y otros). `npm run build` (`tsc -b && vite build`) terminó en verde, 388 módulos, 775 ms.
