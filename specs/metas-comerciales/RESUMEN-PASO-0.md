# RESUMEN-PASO-0 — Metas comerciales

Fecha: 2026-10-20. Rama: `EP-Feature-MetasComerciales`. Sin código de producto. Sin bloqueo duro.

## Hallazgos

1. **Dashboard.** No existe `/dashboard`. El Dashboard de oportunidades es `/opportunities/dashboard` (`frontend/src/routing/AppRoutes.tsx:131`), pestaña «Dashboard» en `frontend/src/modules/discovery/components/DiscoveryNav.tsx:30-31`. El encabezado está en `frontend/src/modules/discovery/pages/OuvDashboardPage.tsx:96-107`: título a la izquierda y filtros a la derecha. El engranaje entra al final de ese grupo, sin tocar la lógica del tablero. Hay otros dashboards (`/demand/dashboard`, `/qualification/dashboard`); no son el de dirección comercial. Decisión DA-01.

2. **Segmentos.** Catálogo reutilizable: tabla `segments` (`backend/src/modules/demand-generation/models/segment.model.ts:15-32`), expuesta por `GET /segments` con `read Lead` (`backend/src/modules/demand-generation/controllers/segments.controller.ts:6-16`). Los formularios de OUV ya lo consumen. El ENUM `ouvs.segmento` (`backend/src/modules/discovery/models/enums/ouv.enums.ts:20-25`) sigue obligatorio en la OUV (`ouv.model.ts:116-127`) y no es el catálogo de los formularios. La migración `backend/database/migrations/20260810190000-create-segments-subsegments.js:4` sembró nombres viejos. En la base de `backend/.env` las filas activas hoy son Ciudades y gobernaciones, Defensa y seguridad, Gobierno central, Industria y Otros. Se usa la FK `segment_id`. DA-02. No hay bloqueo.

3. **Comerciales.** `GET /discovery/ouvs/ejecutivos-comerciales` (`ouvs.controller.ts:86-91`) llama a `listEjecutivosComerciales` (`ouvs.service.ts:906-916`), que usa `ASSIGNABLE_COMMERCIAL_ROLE_NAMES` (`commercial-role-names.js:9-12`): `EjecutivoComercial` y `Gerente Comercial`. La fila `Gerente Comercial` existe en `roles`. No hay bloqueo. El duplicado `GET /discovery/ejecutivos-comerciales` no se toca.

4. **Montos.** Convención del repo: `DECIMAL(18,2)` (`ouv.model.ts:179`). Para un entero se adopta `DECIMAL(18,0)` y el API lo devuelve como string. Tope `Number.MAX_SAFE_INTEGER`. DA-03. Paginación de referencia: `page` default 1, `limit` default 20 y máximo 100 (`accounts.dto.ts:20-31`).

5. **CASL.** No hay un enum de subjects: `AppAbility` es `MongoAbility<[string, string]>` y `buildPermissions` arma `{ action, subject }` desde `role-permissions.js`. El permiso extra de alto valor está en `role-permissions.js:211-214` y en la migración `20261018120100-account-high-value-permission.js`. El frontend lee `user.permissions` (`can-manage-high-value.ts:5-12`). Se sigue ese doble camino (matriz + migración) con el subject `CommercialGoal`.

6. **Auditoría.** `AuditHooksService` (`audit-hooks.service.ts:36-77`) escribe INSERT con el registro completo, una fila UPDATE por campo cambiado (`valor_anterior` / `valor_nuevo`, omite `updated_at`) y DELETE en el destroy. `AuditWriterService` (`audit-writer.service.ts:19-38`) guarda `usuario_id` del contexto. Soporte no ve Auditoría: la matriz solo se la da a Admin (`role-permissions.js:49`), el menú exige `AuditLog` (`navigation.ts:33`) y la ruta es `AdminRoute` (`AppRoutes.tsx:375-376`). DA-08. No se agrega `created_by` (DA-05).

7. **Unicidad y soft-delete.** El repo ya usa columna generada: `kickoffs.active_ouv_id` (`20260905120000-create-kickoff-tables.js:175-196`). La meta usa `active_marker` dentro del índice único. DA-04.

8. **UI reutilizable.** Botones `ghostButtonClass` y `primaryButtonClass` en `frontend/src/modules/discovery/components/ui.ts:9-14`. Modal: `ModalShell`. Borrado: `window.confirm` (`AccountsListPage.tsx`). Éxito: `FloatingToast`. Control segmentado con flechas: `EstadoSegmentedControl.tsx` (se copia el patrón, no el componente, porque está atado a estados de influencia). Moneda: `formatAmountEsCo` y `formatAmountInputEsCo` en `frontend/src/lib/format.ts`. Paginación: `Pagination.tsx`. No hay selector con búsqueda (DA-06). No hay pantalla de acceso denegado; hay redirección a `/opportunities` (DA-07). El tablero de OUVs etiqueta «año fiscal» pero calcula trimestres de calendario (`ouv-dashboard-metrics.ts:193`). Esa cuenta no se cambia.

## Decisiones autónomas

Quedan en `DECISIONES-AUTONOMAS.md`. Las que Evilio debe validar: DA-01 (engranaje en `/opportunities/dashboard`, pantalla en `/dashboard/metas-comerciales`), DA-02 (incluye el segmento Otros) y DA-14 (migración no ejecutada porque `DB_HOST` no es local).

## Cómo revisar este paso

- Leer `spec.md` REQ-01 a REQ-10 y la sección UX.
- Confirmar que no se pidió código de producto en el diff.
- Contrastar DA-01 con la ruta que Soporte usa a diario.

## Riesgos

- El engranaje no está en una URL `/dashboard` porque esa ruta no existe. Si Evilio la quería literal, DA-01 se revierte en el Paso 2.
- «Otros» puede no ser un segmento de meta deseado. DA-02 lo deja fuera con un rechazo en el servicio, sin migración, mientras no haya filas.
- La migración queda escrita y sin aplicar en la base remota de `.env`. Hasta que alguien la corra en una base local o en el despliegue, el permiso no aparece en roles ya sembrados.
- El frontend no tiene runner de tests. Los bordes del calendario se aseguran en el backend (DA-13). El helper de UI puede desviarse si se edita solo uno de los dos.
- Soporte no puede abrir Auditoría. La comprobación visual del REQ-08 en la UI de Auditoría es de Admin.

## Pruebas

No aplica en este paso (no hay código). El build no se corrió.
