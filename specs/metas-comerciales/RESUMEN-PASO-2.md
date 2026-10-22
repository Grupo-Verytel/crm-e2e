# RESUMEN-PASO-2 — Metas comerciales (frontend)

Fecha: 2026-10-20. Rama `EP-Feature-MetasComerciales`. El agente no ejecutó la prueba manual: queda el checklist de abajo para Evilio.

## Qué quedó

- Engranaje `Settings` en el encabezado de `/opportunities/dashboard` (`OuvDashboardPage`). Solo con `read` sobre `CommercialGoal`. Área de 40 px, `title` y `aria-label` «Metas comerciales». El resto del tablero no cambia. No existe la ruta `/dashboard` (DA-01): el enlace vuelve a `/opportunities/dashboard` y la pantalla nueva es `/dashboard/metas-comerciales`.
- La ruta está en `ProtectedRoute`. Sin el permiso, redirige a `/opportunities`, igual que `RoleRoute` y `AdminRoute` (DA-07). No compara nombres de rol.
- Pantalla con encabezado, chip del trimestre de hoy, selector de año fiscal, cuatro tarjetas, filtros draft/applied (Aplicar y Limpiar), tabla paginada, modal, confirmación de borrado y `FloatingToast`.
- Componentes sin fetch: `QuarterSummaryCards`, `QuarterSegmentedControl`, `CommercialGoalsTable`, `CommercialGoalFormModal`, `CopAmountInput`.
- Helpers: `frontend/src/modules/commercial-goals/lib/verytel-quarter.ts` (la misma regla que el backend) y `cop-amount.ts` (`$ 1.200.000.000`, «1.200 millones»).
- Un 409 muestra el `message` y «Editar la meta existente» si viene `existing_goal_id`. El modal no se cierra. 403 se traduce a «No tienes permiso para esta acción.» y no se muestra el `code`.
- `ApiError` ahora guarda `existingGoalId` cuando el cuerpo trae `existing_goal_id`.

## Verificación del agente

- `npm run build` en `frontend`: `tsc -b && vite build`, 418 módulos, en verde.
- `npx eslint` sobre los archivos tocados: sin errores.
- No hay runner de tests en el frontend (DA-13). Los bordes del calendario siguen en `verytel-quarter.spec.ts` del backend.
- No se abrió el navegador. La prueba de Soporte, Ejecutivo, Gerente y Admin es el checklist. Además, las migraciones no están aplicadas en la base de `backend/.env` (DA-14): sin eso, ni siquiera Admin ve el engranaje hasta que se corran y se vuelva a iniciar sesión.

## Checklist para Evilio

Cerrar sesión y volver a entrar después de las migraciones de la tabla y de los permisos.

1. Como Soporte: ver el engranaje en `/opportunities/dashboard`, entrar a `/dashboard/metas-comerciales`, crear metas para un Ejecutivo y un Gerente en distintos segmentos del mismo Q.
2. Intentar duplicar esa combinación y leer el mensaje dentro del modal.
3. Editar el valor. Como Admin (Soporte no abre Auditoría, DA-08), verificar en Auditoría el valor anterior y el nuevo de `amount_cop`.
4. Eliminar y volver a crear la misma combinación.
5. Q4 muestra noviembre a enero del año siguiente. Las tarjetas suman el año y, al hacer clic, filtran la tabla. Un segundo clic quita el filtro.
5b. Escribir un valor grande: miles en el input, cifra abreviada debajo (1.200.000.000 → «1.200 millones») y, en la tabla, `$ 1.200.000.000`. Provocar un duplicado y usar «Editar la meta existente».
6. Como Ejecutivo y como Gerente: no ven el engranaje. Abrir `/dashboard/metas-comerciales` los deja en `/opportunities`.
7. Como Admin: acceso completo, incluido el engranaje.
8. Recordatorio: Soporte y Admin deben cerrar sesión y volver a entrar tras la migración de permisos.

## Riesgos

- El engranaje está en el tablero de OUVs, no en una URL `/dashboard`. DA-01.
- El selector de comercial es un `<select>` nativo. No hay búsqueda en el repo (DA-06).
- El año del encabezado ofrece de 2020 al año fiscal actual + 2. El modal incluye también el año de la meta que se edita.
- «1 comercial con meta» en singular cuando el conteo es 1. El resto usa «N comerciales con meta».
