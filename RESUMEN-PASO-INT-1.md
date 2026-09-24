# RESUMEN-PASO-INT-1 — Interacciones en el detalle de SQL

Análisis de solo lectura. Cadena 1:1 verificada en la base conectada (`crm_e2e`): 17 SQL activos, 0 sin lead, unicidad de `mqls.lead_id` y `sqls.mql_id` intacta. No hay `NOTAS-BLOQUEO-INT-1.md`.

## 1. Interacciones de Leads (lo que se reutiliza)

| Pieza | Ubicación |
|---|---|
| Tabla | `interactions` (migración `20250703120000-create-demand-generation-checklist-mql-sql.js`) |
| Modelo | `backend/src/modules/demand-generation/models/interaction.model.ts` |
| Servicio | `InteractionsService` → expuesto por `DemandGenerationService.registerInteraction` / `listInteractions` |
| Endpoints | `POST/GET /leads/:id/interactions` (`LeadsController`) |
| UI | `InteractionTimeline` + `QuickInteractionModal` |
| Conteo | `InteractionsService.countByLead` solo en la máquina de estados del lead (umbral ≥ 1 para MOFU). La bandeja de Leads no tiene columna de conteo. |

Columnas relevantes: `lead_id` NOT NULL, `responsable_id` CHAR(36) NOT NULL FK a `users.user_id` (índice), `fecha`, soft-delete `deleted_at`. No existe `sql_id`, `created_by`, `user_id` ni `usuario_id`.

Autor: el controller toma `user.userId` del JWT y lo guarda en `responsable_id`. `CreateInteractionDto` no declara autor; `forbidNonWhitelisted` rechaza un campo extra. No hay endpoint de edición. En datos reales: 12 interacciones, 0 con `responsable_id` nulo, 0 huérfanas de usuario. No hace falta backfill ni columna nueva.

El listado devuelve solo `responsable_id`. No hace join a `users`/`roles`, así que la UI no muestra nombre ni rol.

Auditoría: `AuditHooksService` registra `afterCreate` / `afterUpdate` / `afterDestroy` de todo modelo, incluida `interactions`. No se escribe `audit_log` a mano.

`commercial-interactions` (MEP) es otra tabla y otro módulo. No se toca.

## 2. Ruta `/qualification/sqls/:id` hoy

Existe. `SqlDetailPage` carga `GET /qualification/sqls/:id` y muestra estado, origen, contacto, email, fechas, cita y enlace a OUV. No hay tabs ni botón de registrar.

`SqlDetailDto.interactions` se llena en `SqlsService.toDetailResponse` con `listInteractions(mql.leadId)` (interacciones del lead, sin `sql_id` ni etapa). La página no las pinta.

Por qué falla el flujo del diseño: `crm-e2e-design` llama `GET/POST /qualification/sqls/:id/interactions` contra la tabla `sql_interactions`. Esos endpoints no existen en este repo (404). El diseño, además, muestra el error y el estado vacío a la vez.

`findById` ya responde 403 si un Ejecutivo no es `comercial_asignado_id` (`assertCanViewSql`). La UI muestra “No se pudo cargar el SQL.” y no redirige a Mis SQL.

## 3. Referencia visual (`crm-e2e-design`)

- Cabecera: etiqueta `SQL-` + 6 hex del UUID, empresa, contacto · email. `sqls` no tiene consecutivo; no se inventa uno.
- Tabs Detalle / Interacciones y botón “Registrar interacción”.
- Columna Interacciones en Enrutamiento: fecha de la última interacción (`RoutingLeadInteractionsCell`), no el conteo. El pedido manda el conteo.
- El diseño crea `sql_interactions` aparte. Este repo no lo replica: se reutiliza `interactions`.

## 4. Propuesta (pendiente de aprobación)

**Migración** (reversible), solo `sql_id`:

- `interactions.sql_id` CHAR(36) NULL, FK a `sqls.sql_id`, índice `idx_interactions_sql_id`, `ON UPDATE CASCADE` / `ON DELETE RESTRICT`.
- No se agrega `created_by`. El autor sigue siendo `responsable_id`.
- Filas históricas quedan con `sql_id` NULL → etapa “Previa”.

**Endpoints** (qualification llama al servicio público de demand-generation; no importa el modelo):

- `GET /qualification/sqls/:id/interactions` — deriva `lead_id` por `sqls → mqls → leads` y lista todas las interacciones de ese lead, más recientes primero. `sql_id` presente → etapa `SQL`; ausente → `Previa`. Join a `users` + `roles` en la misma consulta: `responsable_nombre`, `responsable_rol`.
- `POST /qualification/sqls/:id/interactions` — body = el DTO actual de Leads (tipo, canal, subtipo, descripción, resultado, campana_id, fecha). El cliente no envía `lead_id` ni autor. El servicio deriva el lead, guarda `sql_id` + `lead_id`, y pone `responsable_id` desde el JWT. Actualiza `leads.fecha_ultima_interaccion` como hoy.
- El `GET/POST /leads/:id/interactions` sigue igual, y su listado también pasa a incluir nombre y rol (mismo componente).

**Permisos.** El guard CASL del repo usa subject `Opportunity` (el diseño usa `Sql`; aquí manda el repo): `read` para listar, `update` para registrar, igual que el detalle y la asignación. La regla de negocio queda en el servicio, no solo en la UI:

- SoporteComercial: SQL de enrutamiento y de SQL asignados.
- EjecutivoComercial: solo si `comercial_asignado_id` es él. Si no, 403.
- Registro solo en `PendienteAsignacion` y `Asignado`. `ConvertidoOUV`, `Backlog`, `Descartado` y también `EnGestion` (existe en el enum, 0 filas hoy) rechazan el POST. El tab queda en solo lectura.

**Conteo.** Una sola consulta agregada por página de bandeja: `COUNT` de `interactions` agrupado por los `lead_id` de esa página. No se reutiliza el `listInteractions` por fila que hoy hace `toDetailResponse` (N+1). La columna muestra el número y navega a `/qualification/sqls/:id?tab=interacciones&from=routing|assigned`.

**UI a extraer, no a reescribir.**

- `QuickInteractionModal` hoy llama fijo a `registerInteraction(leadId)`. Extracción mínima: recibir un `submit` inyectado. Leads sigue pasando el API de leads; el detalle de SQL pasa el POST anidado.
- `InteractionTimeline` hoy asume `leadId` y pinta error y vacío juntos. Extracción mínima: loader inyectado, estados excluyentes (carga / error con reintento / vacío / lista) y línea “Registrada por {nombre} · {rol}” o “Sin registro de autor”, más la etiqueta de etapa cuando el item la traiga. El mismo componente sirve en Leads y en SQL.
- “Volver a …” lee `from`. Sin origen: Soporte → enrutamiento; Ejecutivo → Mis SQL.

**Brechas del tab Detalle** (no se crean endpoints):

- `cita_planificada`, estado de reunión y módulos de agenda del diseño no están en `SqlDetailDto` de este repo.
- No hay selector de contacto ni columna de contacto en `interactions`. El formulario actual es tipo, canal y descripción. `fecha` existe en el DTO y, si no se envía, el backend usa ahora; el modal no la muestra.
- No hay consecutivo SQL. La cabecera usa la etiqueta visual `SQL-` + 6 hex, más empresa y contacto · email, que sí vienen en `lead`.

## 5. Spec EARS

- WHEN SoporteComercial registra una interacción en el detalle de un SQL en `PendienteAsignacion` o `Asignado`, THE SYSTEM SHALL guardarla con el `sql_id` recibido y el `lead_id` derivado por `sqls.mql_id` → `mqls.lead_id`, y SHALL fijar `responsable_id` con el usuario del JWT.
- WHEN un usuario autorizado abre el tab Interacciones, THE SYSTEM SHALL listar todas las interacciones del lead de ese SQL, más recientes primero, con etapa `SQL` si tienen `sql_id` y `Previa` si no, e incluir nombre y rol del `responsable_id`.
- IF el cliente envía `lead_id` o `responsable_id` en el body, THE SYSTEM SHALL rechazar la petición (`forbidNonWhitelisted`).
- IF el Ejecutivo Comercial no es el `comercial_asignado_id` del SQL, THE SYSTEM SHALL responder 403 y la UI SHALL redirigirlo a Mis SQL.
- WHILE el SQL esté en `ConvertidoOUV`, `Backlog`, `Descartado` o `EnGestion`, THE SYSTEM SHALL rechazar el registro y la UI SHALL ocultar “Registrar interacción”.
- WHEN la bandeja de Enrutamiento, SQL asignados o Mis SQL lista una página, THE SYSTEM SHALL calcular el conteo de interacciones con una consulta agregada de esa página.
- IF la carga del tab Interacciones falla, THE SYSTEM SHALL mostrar el error con reintento y SHALL NOT mostrar el estado vacío en la misma vista.
- WHEN la misma interacción se abre desde el lead, THE SYSTEM SHALL mostrar el mismo autor.

## 6. Tests previstos (Paso 2)

- El `lead_id` guardado es el del `sql_id`.
- Autor = usuario del token; un autor enviado por el cliente se rechaza.
- El listado trae nombre y rol en la misma consulta.
- 403 si el Ejecutivo no es el asignado.
- POST rechazado fuera de `PendienteAsignacion` / `Asignado`.
- Listado marca `Previa` y `SQL`.

**STOP.** Sin migración, sin código de producto, sin cambios en base de datos.
