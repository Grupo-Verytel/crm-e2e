# AGENTS.md — CRM Frisson / Grupo Verytel

**Versión:** 1.0 — inventario técnico vigente
**Última verificación contra repo:** 2026-10-20 (Metas comerciales, pasos 0 a 3)
**Relación con `CONSTITUTION.md`:** este documento contiene el *dato*, la constitución contiene la *regla*. Si un dato aquí cambia (se sube una versión, se agrega una librería aprobada), se actualiza este archivo — no requiere enmienda de constitución salvo que rompa una regla de gobierno.

---

## 1. Stack backend (verificado)

- **Framework:** NestJS 11
- **ORM:** Sequelize vía `@nestjs/sequelize` + `sequelize-typescript`
- **Lenguaje:** TypeScript
- **Base de datos:** MySQL
- **Eventos/tiempo real:** `@nestjs/event-emitter` + `@nestjs/websockets` (Socket.io) — push asíncrono post-commit, **no polling**
- **Autorización:** CASL
- **Autenticación:** JWT
- **Validación global:** `ValidationPipe` con `transform: true`, `whitelist: true`, `forbidNonWhitelisted: true`
- **Orden de implementación backend por módulo:** Models → migración → DTOs → services → controllers

## 2. Stack frontend (verificado — no asumir otras librerías)

- **Presentes:** React 19, React Router 7, Tailwind CSS 4, lucide-react
- **Explícitamente ausentes** (no agregar sin decision record): TanStack Query/Table, SWR, Zustand, Redux, class-variance-authority (CVA), clsx, tailwind-merge, Radix, shadcn
- **Fetching:** `fetch` nativo envuelto en `apiRequest()` (`frontend/src/lib/api/http-client.ts`), con funciones por módulo en carpetas `api/`
- **Estado de listas:** `useState` + `useEffect` + `useCallback` por página
- **Filtros:** patrón draft/applied — el usuario edita estado draft, se copia a applied al presionar "Aplicar", eso dispara el fetch
- **Paginación:** componente compartido `Pagination.tsx`, recibe `page`/`limit`/`total` del backend
- **Tablas:** `<table>` HTML nativo con Tailwind, sin librería de tablas (ver `LeadsTableView`)
- **Estado global:** React Context solo para auth. Regla `.cursor/rules/200-frontend-react.mdc`: estado local + Context, sin store global salvo justificación

## 3. Design system (verificado)

- **Patrón:** `frontend/src/styles/tokens.css` (variables CSS marca Verytel) → `tailwind.config.js` mapea tokens a clases utilitarias (`bg-brand`, `text-ink`, `bg-surface`) → constantes de clase exportadas por módulo (ej. `frontend/src/modules/demand-generation/components/ui.ts`: `primaryButtonClass`, `ghostButtonClass`, `cardClass`) → componentes React simples con mapas `Record<string, string>` para variantes de badge (ej. `StatusBadge.tsx` con `ESTADO_TONE`/`TONE_CLASS`/`LABELS`)
- **Compartidos:** `Pagination.tsx`, `LoadingScreen`, `frontend/src/components/HighValueBadge.tsx` y `frontend/src/components/reminders/` (`ReminderTrayList`, `ReminderGroupTabs`, `useBellReminders`, `reminders-api.ts`, `reminder-errors.ts`). `FollowUpDot` vive en calificación (`frontend/src/modules/qualification/components/FollowUpDot.tsx`) y `ReminderFields` en discovery (`frontend/src/modules/discovery/components/ReminderFields.tsx`). El resto sigue por módulo
- **Token `--high-value`:** `#4C3BCF` en claro y `#C4B5FD` en oscuro. Está en `:root` y en `:root[data-theme='dark']` de `tokens.css`, y otra vez en `html[data-theme='dark']` de `global.css`. Tailwind lo expone como `text-high-value`
- Regla `.cursor/rules/600-ui-design.mdc`: CSS tokens + Tailwind 4, sin kits de UI externos

## 4. Modelo de dominio (hechos verificados)

- **Espina de IDs consecutivos:** OUV → PRE → PRI → SER (Oportunidad → Preventa → Pricing → Servicio)
- **Segmentos/verticales:** Gobierno, Defensa y Seguridad, Proyectos Especiales, B2B — Colombia
- **Embudo comercial de 4 zonas:** UNIVERSO → ENCIMA_FUNNEL → EN_FUNNEL → MAYOR_PROBABILIDAD (patrón MEDDIC/Miller Heiman), definido en `FILTROS_EMBUDO_COMERCIAL_v5.pdf`
- **Convención de nomenclatura (`specs/decisions/2026-08-DR-convencion-nombres-ingles.md`):** toda tabla/columna nueva desde 2026-08-10 va en **inglés**. El esquema ya implementado o ya especificado antes de esa fecha se mantiene en español (no se retro-traduce sin DR). Los valores de datos/ENUM siempre en español, en ambos regímenes.
- **Segments y subsegments (`specs/decisions/2026-08-DR-subsegmentos.md`):** `segmento` deja de ser ENUM — se crean tablas nuevas `segments` (id, name, active) y `subsegments` (id, segment_id FK, name, active), ninguna administrable por UI todavía. `leads.segment_id` + `leads.subsegment_id` y `ouvs.segment_id` + `ouvs.subsegment_id` — FK nuevas en inglés, subsegment opcional e independiente entre leads/ouvs. Coexisten con el ENUM viejo `segmento` (español) hasta ejecutar la migración de datos. Resuelve de raíz la inconsistencia `PymesEspeciales` (leads) vs `ProyectosEspeciales` (ouvs). `campaigns.segmento_objetivo` sigue como ENUM, fuera de este cambio por ahora.
- **Modelo de contactos/cuentas (`specs/decisions/2026-08-DR-unificacion-contactos-cuentas-wave1.md` — supersede a los dos DRs de contactos anteriores, que asumían `organizations`/`people` inexistentes):** tablas nuevas `accounts` (adelanto mínimo de Módulo 12; columna `ouvs.account_id` implementada en discovery v1.4 / GC-13 — ver `2026-08-DR-auto-poblar-ouv-account-id.md`) y `people` (maestro de persona, `account_id` obligatorio). Las tablas existentes `lead_contacts` y `ouv_contactos` **se reestructuran, no se renombran** (siguen en español/mixto por ser preexistentes) para llevar la columna nueva `person_id` (inglés) en vez de datos denormalizados — minimiza cambios sobre código ya escrito, `ouv_influencias.contacto_ouv_id` no requiere cambio. La copia de contactos en creación de OUV Vía 1 (`spec-ouv-funnel.md` EARS-02) queda obsoleta: ahora se reutiliza el mismo `person_id`. **Esta unificación mueve alcance de Wave 2/Módulo 12 a Wave 1** — enmienda explícita registrada en el DR, no es un cambio silencioso.
- **Nombre real de tabla de contactos de lead:** `lead_contacts` (confirmado contra `spec-demand-generation.md` v2.2 — `spec-ouv-funnel.md` v1.2 la nombra `contactos` por inconsistencia entre specs, pendiente de corregir ahí).
- **Soft-delete estándar:** columna `deleted_at` + `paranoid: true` en Sequelize, en todas las entidades
- **Roles vigentes (nombre en código, PascalCase sin espacios — la UI puede mostrar label largo):** `EjecutivoComercial`, `SoporteComercial` (Blueprint V2 lo describe también como "Profesional Soporte Comercial" — **es el mismo rol**, ese es solo el label de UI, no un rol aparte — confirmado 2026-08-10), `ProductManager` (`specs/decisions/2026-08-DR-rol-product-manager.md`, seed en PascalCase sin espacio; UI muestra "Product Manager"), `TraductorDeNegocio` (`specs/decisions/2026-08-DR-rol-traductor-negocio.md`, campo nuevo `leads.business_referrer_id` en inglés, login + lectura limitada) — ninguno de los dos últimos está aún en Blueprint V2 formalmente — **no existe `DirectorComercial`**. `Gerente Comercial` (con espacio) existe en la tabla `roles` y no está en `BASE_ROLES` (`specs/decisions/2026-10-20-gerente-comercial-rol-existente.md`, propuesta de catálogo en `specs/decisions/2026-10-20-propuesta-gerente-comercial-base-roles.md`)
- **OUVs sin origen lead/SQL:** ~10% de casos (upsell, outbound, licitaciones)

## 5. Estructura de repo

```
crm-e2e/
├── backend/
├── frontend/
├── specs/
│   ├── spec-<módulo>.md          # specs ejecutables en EARS
│   └── decisions/
│       └── YYYY-MM-DR-<tema>.md  # decision records
├── AGENTS.md                     # este documento
├── CONSTITUTION.md               # reglas de gobierno
└── .cursor/
    ├── rules/*.mdc                # convenciones siempre activas
    │   ├── 200-frontend-react.mdc
    │   └── 600-ui-design.mdc
    └── skills/<nombre>/SKILL.md  # playbooks on-demand (Cursor 2.4+)
```

## 6. Artefactos de proceso Cursor (formato exacto)

- **Prompt de Cursor:** siempre texto completo listo para copiar/pegar — nunca una descripción de qué debería contener el prompt.
- **Condiciones de parada:** rotuladas R1–R9 dentro del prompt.
- **`NOTAS-BLOQUEO-N.md`:** obligatorio cuando Cursor se detiene por un STOP CONDITION.
- **`RESUMEN-PASO-N.md`:** obligatorio al cerrar cada gate (spec, backend, frontend).
- **`RESUMEN-EJECUCION.md`:** obligatorio para corridas autónomas nocturnas.

## 7. Skills de Cursor — inventario

**Ya construidas / en uso:**
- (ninguna terminada aún — proceso SDD en formalización)

**Pendientes de construir:**
`speckit-clarify`, `speckit-analyze`, `semaforo-sla`, `badge-estado-por-entidad`, `kanban-drag-validado`, `formulario-stepper`, `workflow-engine-pattern`, `api-contract-endpoint`, `transacciones-sequelize`, `test-ears-criteria`, `pr-checklist-crm`, `seed-datos-demo`

## 8. Documentos de referencia clave

- `Frisson_CRM_Blueprint_V2_19062026.pdf` — blueprint funcional/roles
- `FILTROS_EMBUDO_COMERCIAL_v5.pdf` — lógica de embudo de 4 zonas
- `DIAGRAMA_PROCESO_COMERCIAL_END_TO_END.pdf` — proceso end-to-end
- `spec-<módulo>.md` por módulo, en `specs/`

## 9. Fechas de referencia (dato, no regla)

- **Go-Live Wave 1:** 9 de octubre de 2026
- **Wave 2:** integración ERP/facturación (Siigo/WorldOffice), dashboards ejecutivos, migración Pipedrive, scoring engine numérico

## 10. Herramientas

- **IDE:** Cursor (pagado), `.cursor/rules/` + `.cursor/skills/`
- **Diagramación:** draw.io, Lucidchart

## 11. Recordatorios de OUV (2026-10-17)

Spec: `specs/recordatorios-ouv/spec.md`. Decisiones: `specs/decisions/2026-10-17-recordatorios-ouv.md`.

**Endpoints** (prefijo `api/v1`):

- `GET /qualification/assigned-ouvs` — OUVs en curso con semáforo. `EjecutivoComercial` solo ve las suyas. Quien puede leer todas (`canReadAllOuvs`) ve el universo y puede filtrar `comercial_id`.
- `GET /discovery/ouvs/:ouvId/recordatorios` — recordatorios de las interacciones de esa OUV.
- `GET /reminders` — campana del usuario (`user_id` = actor): lead, SQL y OUV, con conteos vencidos / hoy / próximos.
- `PATCH /reminders/:reminderId/complete` y `PATCH /reminders/:reminderId/cancel` — solo el responsable. No hay sujeto CASL `Reminder`.

**Tiempo y semáforo.** `backend/src/common/time/bogota-day.ts` calcula el fin del día en America/Bogota (UTC−5, sin horario de verano). El semáforo usa `event_at`, nunca `remind_at`, y lo calcula el servidor: `RED` si la fecha ya pasó, `YELLOW` desde ahora hasta el fin del día Bogotá de hoy + `FOLLOW_UP_YELLOW_DAYS` (default 2, inclusive), `GREEN` si es posterior, `NONE` si no hay recordatorios abiertos. Abierto = `completed_at` nulo, `status` distinto de `Cancelado`, sin `deleted_at`, y la interacción de OUV no está eliminada. Orden por defecto: RED, YELLOW, GREEN, NONE y, dentro, `next_reminder_at` ascendente. La UI no recalcula el color.

**Variables.** `FOLLOW_UP_YELLOW_DAYS`. Outlook: `OUTLOOK_SYNC_ENABLED` (default `false`), `OUTLOOK_SYNC_MAX_ATTEMPTS` (default 5), `OUTLOOK_SYNC_INTERVAL_MS` (default 60000), `CRM_PUBLIC_URL` (origen del enlace del evento; obligatoria solo con el flag encendido). Se reutilizan `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` y `GraphClientService`.

**Jobs.** `RemindersService.dispatchDue` corre cada 60 s con `setInterval` y marca `Enviado` los recordatorios vencidos de aviso. No usa `SKIP LOCKED`: con más de una instancia del backend puede duplicar notificaciones. `OutlookReminderSyncService` solo arranca si `OUTLOOK_SYNC_ENABLED=true`, solo toca recordatorios de OUV y reclama cada fila con `FOR UPDATE SKIP LOCKED`. La alarma del evento es `min(remind_days_before × 1440, 40320)`; el CRM conserva los días reales. Con el flag apagado el alta queda `NOT_REQUIRED` y no se sincroniza al encenderlo.

## 12. Cuenta de alto valor (2026-10-18)

Spec: `specs/cuenta-alto-valor/spec.md`. Decisiones: `specs/decisions/2026-10-18-cuenta-alto-valor.md`.

**Dato.** `accounts.is_high_value` es `BOOLEAN NOT NULL DEFAULT false`. No tiene índice y no se hereda: no hay cuenta padre. `OuvResponseDto.account_is_high_value` sale de esa columna. `account_id` nulo, o una cuenta ausente o con `deleted_at`, responden `false`. La lista de OUVs lo resuelve con una sola consulta `WHERE account_id IN (...)` en `AccountsService.findHighValueByAccountIds`. `empresa_nombre` no se usa para inferir la marca.

**Permiso.** Acción CASL `manage_high_value` sobre el sujeto `Account`. La tienen `SoporteComercial` y `Admin`, en `buildPermissions` y en la migración `20261018120100-account-high-value-permission.js`. Desde 2026-10-20 también la tiene la fila `Gerente Comercial`, solo por la migración `20261020120000-gerente-comercial-manage-high-value.js` (no entra a `buildPermissions`). `EjecutivoComercial` sigue pudiendo crear y editar la cuenta, pero un `true` en el alta o un valor distinto al guardado responde 403 y no persiste ningún campo de ese request. Omitir el campo en la edición no cambia la columna. En el alta, omitirlo o enviar `false` no exige el permiso. El tooltip del checkbox dice: «Solo Soporte Comercial, Administrador o Gerente Comercial pueden cambiar esta marca.»

**UI.** `canManageHighValue` (`frontend/src/modules/accounts/lib/can-manage-high-value.ts`) mira `user.permissions` y no nombres de rol. El checkbox vive en `AccountFormModal` (también el alta de empresa desde el lead). `HighValueBadge` es el ícono `Gem` con `text-high-value`: `sm` en la lista de cuentas, la tarjeta kanban y la fila del tablero; `md` en la cabecera del modal y junto a la organización en el detalle de la OUV. Los permisos del cliente se cargan al entrar; después de la migración hay que cerrar sesión y volver a entrar para ver el checkbox habilitado. El backend aplica la regla en el siguiente request.

## 13. Gerente Comercial en OUVs (2026-10-20)

Spec: `specs/gerente-comercial-ouvs/spec.md`. Decisiones: `specs/decisions/2026-10-20-gerente-comercial-rol-existente.md`.

**Nombre.** El rol en `roles.name` es `Gerente Comercial`, con espacio. La constante está en `backend/src/modules/auth/constants/commercial-role-names.js`. No está en `BASE_ROLES` ni en los seeders. Si en un ambiente no existe esa fila, o el nombre es otro, no se crea ni se renombra: se detiene el despliegue.

**Bandeja.** `GET /auth/me` devuelve `ouv_board_default` (`own` solo para este rol, `all` para el resto), `can_create_direct_ouv` y `can_act_as_assigned_commercial` (verdaderos para `EjecutivoComercial` y para este rol). El cliente no compara el nombre del rol. En `/opportunities` el Gerente entra viendo sus OUVs. «Todos» lista todas. «Limpiar» vuelve a las suyas. El CSV usa el filtro aplicado; el de Soporte también.

**Acciones.** Los guards de avance y retroceso de zona, alta directa, cita de SQL, conversión y descarte de SQL aceptan al Gerente solo si es el comercial asignado. Puede leer la bitácora de cualquier OUV. Escribir en la de otro sigue en 403. El tab «OUVs Asignadas» y los dos dashboards no cambian de corte y no arrancan en «mis OUVs».

**Catálogos.** `GET /discovery/ouvs/ejecutivos-comerciales` y `GET /leads/appointment-commercials` listan activos de `EjecutivoComercial` y de `Gerente Comercial`. El duplicado `GET /discovery/ejecutivos-comerciales` no se tocó.

## 14. Metas comerciales (2026-10-20)

Spec: `specs/metas-comerciales/spec.md`. Decisiones: `specs/decisions/2026-10-20-metas-comerciales.md` y `specs/metas-comerciales/DECISIONES-AUTONOMAS.md`.

**Dato.** Tabla `commercial_goals`: `commercial_goal_id`, `user_id`, `fiscal_year`, `quarter` (1–4), `segment_id` (FK a `segments`), `amount_cop DECIMAL(18,0)`, timestamps y `deleted_at`. Unicidad de la fila viva: columna generada `active_marker` dentro de `uq_commercial_goals_active_natural`. El calendario Verytel no se persiste.

**Calendario.** `backend/src/common/time/verytel-quarter.ts` (y la copia de UI en `frontend/src/modules/commercial-goals/lib/verytel-quarter.ts`). Q1 feb–abr, Q2 may–jul, Q3 ago–oct, Q4 nov–ene del año siguiente. El año fiscal es el año en que empieza el trimestre. Los límites de día salen de `bogota-day.ts`. Los tableros de OUVs, calificación y mercadeo usan este mismo calendario fiscal.

**Permiso.** Subject `CommercialGoal` con `create`, `read`, `update` y `delete`. Lo tienen `SoporteComercial` y `Admin` en `buildPermissions` y en la migración `20261020231100-commercial-goal-permissions.js`. Ni el API ni el engranaje comparan nombres de rol. Tras la migración, Soporte y Admin cierran sesión y vuelven a entrar.

**Endpoints** (prefijo `api/v1`, todos con `CheckAbility` sobre `CommercialGoal`):

- `GET /commercial-goals` — listado paginado. Filtros `fiscal_year`, `quarter`, `user_id`, `segment_id`. Orden: año desc, Q desc, comercial asc.
- `GET /commercial-goals/summary?fiscal_year=` — cuatro trimestres: suma COP y comerciales distintos. Respeta `user_id` y `segment_id`.
- `GET /commercial-goals/:id`
- `POST /commercial-goals` — 201. Duplicado vivo: 409 `{ code: "CONFLICT", message, existing_goal_id }`.
- `PATCH /commercial-goals/:id`
- `DELETE /commercial-goals/:id` — soft-delete. La misma combinación se puede crear de nuevo.

**UI.** Engranaje en `/opportunities/dashboard` (no hay ruta `/dashboard`). Pantalla `/dashboard/metas-comerciales`. El segmento sale de `GET /segments`. El comercial, de `GET /discovery/ouvs/ejecutivos-comerciales`. Soporte no tiene `AuditLog`; la comprobación visual de auditoría la hace Admin.

---

*Estado de módulos funcionales (avance de specs/implementación) se mantiene en los propios `spec-<módulo>.md`, no se duplica aquí para evitar desincronización.*
