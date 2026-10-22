# Decisiones autónomas — Metas comerciales

Modo autónomo (R2). Cada ítem: contexto, opciones, elegida, por qué, cómo revertirla. Evilio debe mirar en especial **DA-01**, **DA-02** y **DA-14**.

## DA-01 — No existe la ruta `/dashboard`

**Contexto.** El prompt pone el engranaje en `/dashboard` y la pantalla en `/dashboard/metas-comerciales`. En el repo no hay ruta `/dashboard`. El Dashboard comercial está en `/opportunities/dashboard` (`AppRoutes.tsx:131`, pestaña en `DiscoveryNav.tsx:30-31`, encabezado en `OuvDashboardPage.tsx:96-107`). También existen `/demand/dashboard` y `/qualification/dashboard`.

**Opciones.** (A) Crear un `/dashboard` nuevo que duplique el tablero de OUVs. (B) Poner el engranaje en el tablero de OUVs y la pantalla en `/dashboard/metas-comerciales`, con «← Dashboard» hacia `/opportunities/dashboard`. (C) Poner ambas rutas bajo `/opportunities/dashboard`.

**Elegida.** B.

**Por qué.** R3 y R4: el dashboard que ya existe solo recibe el ícono; no se duplica una pantalla. La URL de la pantalla nueva queda como la pidió el prompt.

**Revertir.** Mover el `Link` del engranaje y cambiar el `to` de regreso y el `path` en `AppRoutes.tsx`.

## DA-02 — Catálogo = tabla `segments`, incluido «Otros»

**Contexto.** Las OUVs tienen dos sitios de segmento: el ENUM obligatorio `ouvs.segmento` (`ouv.enums.ts:20-25`: Ciudades y gobernaciones, Gobierno central, Defensa y seguridad, Industria) y la FK opcional `ouvs.segment_id` (`ouv.model.ts:122-127`). Los formularios de OUV cargan `GET /segments` (`CrearOuvDirectaModal.tsx`). La migración `20260810190000-create-segments-subsegments.js:4` sembró nombres viejos (Gobierno, D&S, Proyectos Especiales, B2B). En la base de `backend/.env` las filas vivas y activas hoy son: Ciudades y gobernaciones, Defensa y seguridad, Gobierno central, Industria y **Otros**. «Otros» no está en el ENUM.

**Opciones.** (A) FK a `segments` y aceptar todo segmento activo, incluido Otros. (B) Limitar la meta a los cuatro valores del ENUM. (C) Guardar el texto del ENUM y no la FK.

**Elegida.** A.

**Por qué.** D6 pide el catálogo que ya usan los formularios de OUV, no un catálogo nuevo ni el ENUM legado. «Otros» ya es seleccionable al crear una OUV.

**Revertir.** Validar el nombre contra `OuvSegmento` y rechazar «Otros». No exige migración si aún no hay filas con ese `segment_id`.

## DA-03 — `DECIMAL(18,0)` y tope de entero seguro

**Contexto.** Los montos del repo son `DECIMAL(18,2)` (`ouv.model.ts:179`). D5 pide entero y sugiere `BIGINT UNSIGNED` o `DECIMAL(18,0)`. Un `DECIMAL(18,0)` no cabe exacto en un número JSON.

**Opciones.** (A) `DECIMAL(18,0)`, API en string de dígitos, máximo `Number.MAX_SAFE_INTEGER`. (B) `BIGINT UNSIGNED` sin tope. (C) `DECIMAL(18,2)` y rechazar la parte decimal.

**Elegida.** A.

**Por qué.** Sigue la convención DECIMAL de montos, cumple el entero de D5 y evita perder precisión en JSON.

**Revertir.** Cambiar el tipo de columna y el validador. Si ya hay datos, hace falta una migración de alter.

## DA-04 — Unicidad con `active_marker`

**Contexto.** En MySQL un único que incluye `deleted_at` no sirve: varios NULL no chocan entre sí, pero un NULL y un valor sí se tratan de forma que no garantiza una sola fila viva. El repo ya usa columna generada en `kickoffs` (`20260905120000-create-kickoff-tables.js:175-196`).

**Opciones.** (A) `active_marker TINYINT GENERATED ALWAYS AS (IF(deleted_at IS NULL, 1, NULL)) STORED` dentro del único `(user_id, fiscal_year, quarter, segment_id, active_marker)`. (B) Un `active_key` concatenado. (C) Unicidad solo en el servicio, sin índice.

**Elegida.** A.

**Por qué.** Es el patrón del prompt y del repo. El índice, no solo el servicio, impide la carrera.

**Revertir.** Quitar la columna generada y el índice en una migración nueva.

## DA-05 — Sin columna `created_by`

**Contexto.** El prompt la pide solo si los hooks no guardan al autor. `AuditWriterService` (`audit-writer.service.ts:19-38`) escribe `usuario_id` desde `AuditContextService`. La fecha de alta es `created_at`.

**Elegida.** No agregar `created_by`.

**Por qué.** Evita un dato duplicado que el hook ya cubre (D7).

**Revertir.** Agregar la columna y poblarla en el servicio.

## DA-06 — Selector nativo, sin búsqueda

**Contexto.** El prompt pide búsqueda en el selector de comercial si el repo ya tiene ese componente. No hay combobox ni typeahead en `frontend/src`.

**Elegida.** `<select>` nativo. La etiqueta del comercial reutiliza `commercialOptionLabel` (`catalogos-api.ts:12-19`), que ya agrega « (Gerente Comercial)».

**Por qué.** R5 prohíbe una librería nueva. Un input de filtro casero sería otra UI, no el componente existente.

**Revertir.** Sustituir el `<select>` cuando exista un componente de búsqueda aprobado.

## DA-07 — Acceso denegado = redirección a `/opportunities`

**Contexto.** El prompt habla de «la pantalla de acceso denegado del repo». No hay una pantalla con ese texto. `RoleRoute.tsx:29` y `AdminRoute.tsx:16` hacen `<Navigate to="/opportunities" />`.

**Elegida.** Si falta `read` sobre `CommercialGoal`, la ruta redirige a `/opportunities`. El engranaje no se renderiza. La comparación es sobre `user.permissions`, igual que `canManageHighValue`.

**Por qué.** Es el mecanismo real del repo. No se inventa una pantalla nueva.

**Revertir.** Cambiar el componente de ruta por un mensaje propio.

## DA-08 — Soporte no recibe Auditoría

**Contexto.** `role-permissions.js:49` da `audit-log: R` solo a Admin. Soporte (`role-permissions.js:86-100`) no tiene `AuditLog`. La ruta `/admin/audit` pasa por `AdminRoute` (`AppRoutes.tsx:375-376`). El menú exige el subject `AuditLog` (`navigation.ts:33`). La sección 3.7 deja el historial en pantalla como mejora futura si Soporte no entra a Auditoría.

**Elegida.** No se agrega `AuditLog` a Soporte. La prueba manual del cambio anterior → nuevo la hace Admin, que tendrá `CommercialGoal` y ya tiene Auditoría.

**Por qué.** Ampliar Auditoría no está en D4 y abre un módulo que hoy es solo de Admin.

**Revertir.** Añadir `audit-log: R` a Soporte en la matriz y en una migración, y sacar esa ruta de `AdminRoute`.

## DA-09 — Módulo nuevo `commercial-goals`, sin ítem de menú

**Contexto.** Las reglas listan 10 módulos de negocio. Esta función no es una fase del embudo. `accounts` ya vive como módulo aparte del mismo modo.

**Opciones.** (A) Módulo Nest y carpeta frontend `commercial-goals`. (B) Meterlo dentro de discovery.

**Elegida.** A. Sin entrada en `NAV_ITEMS`. La única entrada es el engranaje.

**Por qué.** El subject, la tabla y la pantalla son propios. Discovery no importa sus internals. El servicio de metas llama a `UsersService` y a `DemandGenerationService`, que ya se exportan.

**Revertir.** Mover archivos bajo discovery y registrar el controller ahí.

## DA-10 — Texto del 409

**Contexto.** El paso 1 pide «Ya existe una meta para este comercial, año, Q y segmento.» La UX pide «Ya existe una meta para este comercial en {Q} {año} · {segmento}.» y el id para editarla.

**Elegida.** HTTP 409 con cuerpo `{ code: "CONFLICT", message, existing_goal_id }`. `message` es la frase de la UX, con el trimestre, el año y el nombre del segmento. El cliente muestra `message` y no `code`.

**Por qué.** Un solo texto sirve al modal sin armar la frase en el cliente. Sigue siendo 409 `CONFLICT`.

**Revertir.** Devolver la frase genérica y componer la específica en el cliente.

## DA-11 — Dos vacíos distintos

**Contexto.** La UX define el vacío del año: «Aún no hay metas para {año}.» Si el año tiene metas pero el filtro no, ese texto sería falso.

**Elegida.** Sin filas para el año y sin filtros de comercial, Q ni segmento: el vacío del año, con «Crear la primera meta». Con filtros aplicados y cero filas: «Ninguna meta coincide con los filtros.»

**Por qué.** Conserva la frase pedida en el caso real y no miente cuando el filtro está activo.

**Revertir.** Usar siempre la frase del año.

## DA-12 — Cifra abreviada en millones

**Contexto.** El ejemplo «1.200 millones» bajo el input corresponde a `$ 1.200.000.000` (el punto es separador de miles es-CO, no decimal). El objetivo es que Soporte cuente ceros.

**Elegida.** Si el valor es ≥ 1.000.000, se divide entre 1.000.000 y se muestra con `es-CO` más « millón» o « millones» (1.200.000.000 → «1.200 millones»; 1.000.000 → «1 millón»). Entre 1.000 y 999.999, se divide entre 1.000 y se usa « mil». Por debajo, el entero. No se cambia a «mil millones» ni a «billones».

**Por qué.** Coincide con el único ejemplo del prompt y mantiene la misma unidad para revisar ceros.

**Revertir.** Cambiar el helper `abbreviateCop`.

## DA-13 — Los casos de trimestre se prueban en el backend

**Contexto.** El frontend no tiene script de tests (`frontend/package.json` solo tiene `dev`, `build`, `lint`, `preview`). R5 prohíbe agregar Vitest o Jest ahí.

**Elegida.** `verytel-quarter.spec.ts` en el backend cubre los bordes de D1. El helper de frontend repite la misma regla y los mismos meses. No se comparte un runtime.

**Por qué.** Es la única forma de tener tests sin dependencia nueva.

**Revertir.** Cuando el frontend tenga runner, mover los casos a un JSON compartido.

## DA-14 — No se corre la migración en esta base

**Contexto.** R9 prohíbe migrar contra una base que no sea la local de `backend/.env`. `DB_HOST` de ese archivo no es `localhost` ni `127.0.0.1` (es una instancia remota). El Paso 1 pide el ciclo `migration:run → undo → run`.

**Opciones.** (A) Ejecutar el ciclo contra esa base. (B) No ejecutarlo y dejarlo documentado. (C) Detener el paso.

**Elegida.** B. No es bloqueo duro: el código, los tests de unidad y el build no necesitan aplicarla. Aplicarla sí violaría R9.

**Por qué.** La prohibición es explícita. Evilio corre el ciclo cuando tenga una base local.

**Revertir.** Con una base local, `npm run migration:run` en `backend/`. El `down` de cada migración deshace solo su cambio.
