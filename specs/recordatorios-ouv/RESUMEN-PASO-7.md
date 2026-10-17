# RESUMEN-PASO-7 — Tab OUVs Asignadas

Fecha: 2026-10-17. Frontend de Calificación. No hay push. El paso 7 queda sin commit.

## G1 — commits (sin push)

| Paso | Hash | Mensaje |
|---|---|---|
| 2 | `25ae53c1c70a72be38a853a013794eec0f740b07` | `feat(recordatorios-ouv): paso 2 — migracion y modelo de reminders` |
| 3 | `9d0db2b473d1c8b352f9353bf477372998c81e3f` | `feat(recordatorios-ouv): paso 3 — recordatorios en la interaccion de OUV` |
| 4 | `851d430a7c68c8569b7579cb3d313b5898552cd7` | `feat(recordatorios-ouv): paso 4 — listado assigned-ouvs y semaforo` |
| 5 | `7b7406910ca80546f827b65363c477a3a140dd37` | `feat(recordatorios-ouv): paso 5 — campana de recordatorios del usuario` |
| 6 | `00d7544288948d9106b9963df00d6b6feb9aca5e` | `feat(recordatorios-ouv): paso 6 — componentes de presentacion y tokens` |

`RESUMEN-PASO-0` y `RESUMEN-PASO-1` van en el commit del paso 2. El índice AJ8 vive en la migración de ese mismo commit: el archivo nunca se había publicado y la base local ya lo tiene aplicado. `spec.md` y el registro de decisión van en el commit del paso 6, con la deuda de `npm run lint` anotada ahí.

Archivos que siguieron cambiando entre pasos quedaron en el commit del último paso que los necesita para compilar: `bogota-day.ts` entra en el paso 4 (el semáforo lo importa); completar, cancelar y la campana comparten `reminders.service.ts` y quedan en el paso 5; `@nestjs/mapped-types` entra en el paso 3 junto al DTO que usa `OmitType`.

## Deuda

Anotada en `specs/decisions/2026-10-17-recordatorios-ouv.md`. `npm run lint` del frontend sigue en rojo en archivos ajenos (`DatePickerField`, modales de cuentas y otros). No se corrigió.

## Archivos de este paso

- `frontend/src/modules/qualification/api/assigned-ouvs-api.ts` (nuevo)
- `frontend/src/modules/qualification/pages/AssignedOuvsPage.tsx` (nuevo)
- `frontend/src/modules/qualification/pages/AssignedOuvsPageLazy.tsx` (nuevo)
- `frontend/src/routing/AppRoutes.tsx` — ruta `/qualification/assigned-ouvs` con `ProtectedRoute`
- `frontend/src/modules/qualification/components/QualificationNav.tsx` — tab «OUVs Asignadas» para SoporteComercial y EjecutivoComercial
- `frontend/src/modules/qualification/components/AssignedCommercialFiltersPanel.tsx` — prop `showCommercial`
- `frontend/src/layout/ModuleSearchProvider.tsx` — buscador del header en esa ruta

El selector de comerciales reutiliza `fetchEjecutivosComerciales()` de `discovery/api/catalogos-api.ts`. El filtro se muestra y esa lista se pide solo cuando `canReadAllOuvs` es verdadero (cualquier rol distinto de EjecutivoComercial). El servidor sigue ignorando `comercial_id` para el ejecutivo.

## Comparación visual

No hay herramienta de navegador en esta sesión. La comparación es de markup y tokens contra `SupportAssignedOuvsPage` del diseño, en claro, oscuro y ancho de móvil. No hay capturas.

Igual al diseño: nav con borde inferior, tab activo `border-accent font-bold text-accent` e inactivo `border-transparent text-muted hover:text-accent`, panel de filtros con Aplicar/Limpiar, tabla `min-w-[960px]` dentro de `overflow-x-auto`, punto `h-3.5 w-3.5`, fila con `hover:bg-bg` que abre `/opportunities/:id`. La columna del layout es `min-w-0`, así el scroll horizontal queda en la tabla y no en la página. Claro y oscuro salen de `tokens.css` (`:root` y `:root[data-theme='dark']`).

Diferencias intencionales:

- Amarillo `--semaphore-amarillo`: `#B8860B` en claro y `#F0B429` en oscuro. El mix del diseño queda cerca de `#edc86b` (1.61:1 sobre blanco).
- Sin orden en el cliente. La columna Seguimiento no es un botón. El orden es el del servidor: RED, YELLOW, GREEN, NONE y luego `next_reminder_at`.
- Título `h1` «OUVs Asignadas». El diseño no tiene `h1`.
- El tab dice «OUVs Asignadas». El diseño dice «OUV asignadas» y lo muestra con el permiso `assign` de SQL, que también deja verlo a Admin. Aquí solo SoporteComercial y EjecutivoComercial.
- Vacío: «No hay OUVs en curso asignadas». Si la búsqueda no coincide, el texto pasa a «Ninguna OUV coincide…» y aparece «Limpiar búsqueda», como en SQL asignados.
- El error usa `text-danger`. La página de SQL asignados sigue en `text-red-600`.

## Verificación

`npm run build` del frontend en verde (`tsc -b && vite build`, 394 módulos). `eslint` sin errores en los archivos tocados. El lint de todo el frontend no se corrió como gate: ya falla por la deuda de arriba.

No existe el skill `seed-datos-demo`. Se usó un script temporal `backend/scripts/tmp-paso7-check.js`: clonó una OUV real, insertó ocho filas con consecutivo `ZP7-*` (rojo, amarillo, verde, sin seguimiento, otro comercial, Ganada, Perdida, Descartada), llamó `GET /api/v1/qualification/assigned-ouvs` y borró esas filas. `leftover` de `ZP7-%` quedó en 0. El script se eliminó.

Checklist (la UI no se clicó; lo de lista, alcance y filtros salió del API local):

- EjecutivoComercial: la respuesta solo trae sus `ZP7` (`ZP7-RED`, `ZP7-YEL`, `ZP7-GRN`, `ZP7-NON`). No aparece `ZP7-OTH`. La página no muestra el filtro de comercial ni pide la lista de comerciales cuando el rol es EjecutivoComercial. El filtro de Seguimiento `YELLOW` con búsqueda `ZP7` devolvió total 1 (`ZP7-YEL`).
- SoporteComercial: búsqueda `ZP7` devolvió total 5, incluido `ZP7-OTH`. Comercial del ejecutivo + `follow_up_status=RED,YELLOW` + búsqueda `ZP7` devolvió total 2 (`ZP7-RED`, `ZP7-YEL`). Paginación `limit=1`: página 1 `ZP7-OTH`, página 2 `ZP7-RED`, total 5 en ambas.
- Búsqueda `ZP7 ganada` devolvió total 0. Ganada, Perdida y Descartada no salieron en el listado del ejecutivo.
- Orden del ejecutivo: RED, YELLOW, GREEN, NONE. En soporte, `ZP7-OTH` (rojo más antiguo) va antes de `ZP7-RED`.
- El punto no se pudo hover. El API devolvió `next_reminder_at` `2026-10-16T15:15:09.000Z` para el rojo. `FollowUpDot` arma el tooltip `Vencido — 16/10/2026 10:15` con `America/Bogota`. NONE queda en «Sin seguimiento».

## Fuera de este paso

No se cablearon `ReminderFields`, la campana ni el refetch del paso 9.
