# PROMPT — Implementación demand-generation v2.5 (TO-BE)

**Copia/pega este bloque completo en Cursor Agent.**  
**Spec:** `docs/specs/spec-demand-generation.md` v2.5 (APROBADO + parche analyze)  
**Gate previo:** `speckit-analyze` → *Sin inconsistencias — listo para generar prompt*.  
**Alcance:** delta sobre el módulo **ya existente** `demand-generation` + seeds de roles + tablas `segments`/`subsegments`.  
**Incluye:** `person_id` en `lead_contacts` (reestructura), truncate EARS-43, `business_referrer_id`, `segment_id`/`subsegment_id`, `sqls.origen_creacion`, seed `ProductManager` / `TraductorDeNegocio`, rutas directas EARS-24…30, UI de contactos vía `accounts`/`people`.

**Fuera de este prompt:**
- Reestructurar `ouv_contactos` con `person_id` (solo **truncate**; el schema de OUV contactos queda para el prompt de discovery / `spec-ouv-funnel`).
- `ouvs.account_id` / GC-12 / GC-13.
- Ajuste de KPIs `MQL Rate`/`SQL Rate` por `origen_creacion` (pendiente en `spec-calificacion.md`).
- Taller T1 (checklist 3 vs 4, SECOP, catálogo campaigns).
- Scoring numérico Wave 2.
- Commit / PR (solo si el usuario lo pide).

---

## Rol

Eres el implementador backend→frontend del CRM Frisson (`crm-e2e`). Stack fijo: NestJS 11 + Sequelize + MySQL + React 19 + Vite + Tailwind 4 + lucide-react. Sin TanStack Query/Table, SWR, Zustand, Redux, CVA, clsx, tailwind-merge, Radix, shadcn.

Lee antes de tocar código:
- `CONSTITUTION.md`, `AGENTS.md`
- `docs/specs/spec-demand-generation.md` **v2.5**
- `docs/specs/spec-gestion-cuentas.md` v0.4 (consumo de `AccountsService`)
- Decision records:  
  `2026-08-DR-unificacion-contactos-cuentas-wave1.md`,  
  `2026-08-DR-accounts-por-lead.md`,  
  `2026-08-DR-subsegmentos.md`,  
  `2026-08-DR-lead-directo-sql.md`,  
  `2026-08-DR-rol-product-manager.md`,  
  `2026-08-DR-rol-traductor-negocio.md`,  
  `2026-08-DR-convencion-nombres-ingles.md`
- `.cursor/rules/100-backend-nestjs.mdc`, `200-frontend-react.mdc`, `300-sequelize-audit.mdc`, `600-ui-design.mdc`, `700-modules.mdc`
- Código AS-IS: `backend/src/modules/demand-generation/**`, `backend/src/modules/accounts/**`, `frontend/src/modules/demand-generation/**`

**Artículo II:** el código actual aún tiene `lead_contacts` denormalizado y sin `person_id`. El spec v2.5 es el TO-BE: actualiza el código para coincidir con el spec, no “preserves” el modelo viejo.

## Objetivo

Cerrar el delta v2.3–v2.5 del módulo Generación de Demanda:
1. Contactos de lead vía `people`/`accounts` (`person_id`).
2. Segmentación parametrizable (`segments`/`subsegments`) coexistiendo con ENUM `segmento`.
3. Rutas directas `ProductManager` → `MQL_PENDING` y `EjecutivoComercial` → `SQL` (+ MQL automático EARS-29).
4. Campo condicional `business_referrer_id` + rol `TraductorDeNegocio` (solo lectura filtrada).
5. `sqls.origen_creacion` en creación de SQL (DG-06 / EARS-29).
6. Seed de roles `ProductManager` y `TraductorDeNegocio` + permisos CASL.

## Orden de trabajo (gates internos)

1. **Migraciones** (orden estricto):  
   a) Truncate `lead_contacts` + `ouv_contactos` (EARS-43).  
   b) Reestructurar `lead_contacts` (`person_id`, drop denormalizados).  
   c) Alter `leads` (drop copia denormalizada de contacto; add `business_referrer_id`, `segment_id`, `subsegment_id`).  
   d) Crear `segments` + `subsegments` + seed de los 4 segmentos.  
   e) Alter `sqls` add `origen_creacion`.  
   f) Seed/migración de roles `ProductManager` / `TraductorDeNegocio` + permisos.  
2. Models → DTOs → services → controllers (backend `demand-generation`).  
3. Inyectar **solo** el servicio público de `accounts` (`AccountsService`); nunca deep-import de modelos de `accounts`.  
4. Actualizar chequeo GC-11 en `accounts` (ahora sí hay `lead_contacts.person_id`).  
5. Frontend demand-generation (formularios, listas, roles, CSV).  
6. Higiene menor: en `AGENTS.md` §4, reemplazar el hecho obsoleto `ouvs.cuenta_id` por `ouvs.account_id` (columna nueva pendiente de GC-13; no implementar la columna aquí).  
7. Al cerrar: escribir `RESUMEN-PASO-DEMAND-GENERATION-V25.md` en la raíz.

No saltes a frontend antes de que el backend compile y las migraciones corran en local.

---

## Backend

### A. Migración — EARS-43 + schema

**Antes de ALTER que introduce `person_id`:**

```sql
-- En up(): desactivar FKs si hace falta, luego:
TRUNCATE TABLE lead_contacts;
TRUNCATE TABLE ouv_contactos;
```

- **No** script de migración/deduplicación histórica.
- Si el entorno parece productivo (heurística: variable de entorno `NODE_ENV=production` o flag `ALLOW_CONTACT_TRUNCATE!=='true'`), **STOP R1** — no truncar a ciegas.

**`lead_contacts` (reestructura):**
- ADD `person_id` CHAR(36) NOT NULL FK → `people.person_id`
- DROP columnas denormalizadas: `empresa_nombre`, `nombre`, `cargo`, `email`, `telefono`
- Mantener: `contact_id`, `lead_id`, `position` (1..3 unique por lead), timestamps, `deleted_at`
- Índice en `person_id`

**`ouv_contactos`:** solo truncate en este prompt. **No** agregar `person_id` ni drop de columnas aquí.

**`leads`:**
- DROP si existen: `empresa_nombre`, `contacto_nombre`, `cargo`, `email`, `telefono` (copia temporal del contacto principal — spec §3.1 nota v2.3)
- ADD nullable `business_referrer_id` CHAR(36) FK → `users` (o PK real de users en el repo)
- ADD nullable `segment_id` CHAR(36) FK → `segments.id`
- ADD nullable `subsegment_id` CHAR(36) FK → `subsegments.id`
- Conservar ENUM `segmento` (obligatorio) durante coexistencia (EARS-34 / DR-subsegmentos)

**`segments` / `subsegments`** (DR-subsegmentos — PK `id` como dice el DR):

| Tabla | Columnas |
|---|---|
| `segments` | `id` CHAR(36) PK, `name` VARCHAR, `active` BOOLEAN DEFAULT true, timestamps + `deleted_at` |
| `subsegments` | `id` CHAR(36) PK, `segment_id` FK, `name` VARCHAR, `active` BOOLEAN DEFAULT true, timestamps + `deleted_at` |

Seed inicial `segments` (nombres unificados): `Gobierno`, `D&S`, `Proyectos Especiales`, `B2B`.  
`subsegments`: seed vacío o mínimo documentado; sin UI de admin.

**`sqls`:**
- ADD `origen_creacion` ENUM(`enrutamiento_normal`,`directo_comercial`) NOT NULL DEFAULT `enrutamiento_normal`
- Columna canónica de asignación: **`comercial_asignado_id`** (ya existe en el repo). No inventar `comercial_id`.

### B. Roles y CASL (`role-permissions.js` + migración de permisos)

Añadir a `BASE_ROLES` / `MATRIX`:

| Role.name | UI label | leads/campaigns | accounts | Notas |
|---|---|---|---|---|
| `ProductManager` | “Product Manager” | `CRU` (sin approve de MQL) | `CRU` | Crear leads ruta directa EARS-24…26 |
| `TraductorDeNegocio` | “Traductor de Negocio” | `R` | `R` (mínimo) | **Sin** C/U de Lead/Campaign; filtro en service EARS-33b |

Ajustes a roles existentes:
- `EjecutivoComercial`: hoy suele ser solo `R` en leads — **subir a `CRU`** (o al menos create) para EARS-27…29. No dar `approve` de MQL.
- Mantener `DirectorMercadeo` / `GestorMercadeo` / `SoporteComercial` como están (labels UI distintos del `Role.name`).

Subjects nuevos opcionales: `Segment` / `Subsegment` con `read` para autenticados (listados para selects). Si prefieres endpoints internos sin subject nuevo, documenta en el resumen.

Actualizar constantes en `demand-generation.constants.ts`:
`PRODUCT_MANAGER: 'ProductManager'`, `TRADUCTOR_DE_NEGOCIO: 'TraductorDeNegocio'`.

### C. Models / DTOs

Actualizar:
- `LeadContact`: solo `personId` (+ relations a `Person` vía módulo accounts **sin** importar el model si el patrón del repo exige DTO/join vía service; si Sequelize necesita el model, importa el model **exportado por AccountsModule** solo si ya se exporta — si no, registra association mínima o usa raw query/include acordado. Preferir: AccountsModule exporta models necesarios O expone métodos `findPeopleByIds` / `resolvePerson`. No duplicar tablas.)
- `Lead`: quitar campos denormalizados; add `businessReferrerId`, `segmentId`, `subsegmentId`
- `Sql`: add `origenCreacion`
- Models `Segment`, `Subsegment` (pueden vivir en `demand-generation/models` o carpeta shared de catálogo — **dentro** de demand-generation está bien si solo leads los usan en Wave 1; ouvs los reutilizarán después)

DTOs:
- `LeadContactInputDto`: `person_id` UUID obligatorio (o payload `{ person_id }` / create-inline vía AccountsService — ver abajo).
- `CreateLeadDto` / update: contacts 1..3; `business_referrer_id` condicional; `segment_id` / `subsegment_id` opcionales; checklist embebido obligatorio en rutas directas.
- Validar EARS-40/41: todos los `person.account_id` del lead iguales.

### D. Services — reglas de negocio clave

**Contactos (DG-19, DG-20, EARS-37…42):**
- Create/update lead exige 1..3 contactos con `person_id` válido.
- Resolver persona: reutilizar existente o crear vía `AccountsService` (account + person) en la misma transacción.
- Rechazar person sin `account_id`.
- Un lead = una account (DR accounts-por-lead).
- Principal = `position = 1`.
- Respuestas API: enriquecer contactos con datos de `people`/`accounts` (name, email, phone, job_title, account name/tax_id) — **no** devolver columnas denormalizadas eliminadas.
- Listados/Kanban: empresa/nombre visibles vienen del contacto principal (`position=1`) → people → accounts.

**DG-08 CSV:**
- Match duplicado: email (`people`) + NIT (`accounts.tax_id`) informados → si ya hay lead activo con ese par vía `lead_contacts`→`people`→`accounts`, **rechazar fila** y seguir el lote.
- Email o NIT vacío: ese eje no participa.

**Ruta `ProductManager` (EARS-24…26):**
- Solo canales `BTL` | `FABRICA`.
- Checklist completo (4 criterios) en el mismo acto.
- Al guardar: `estado = MQL_PENDING`, crear `mqls` `Activo`, notificar DirectorMercadeo.
- `responsable_id` = creador (o regla existente si ya hay una; documenta).

**Ruta `EjecutivoComercial` (EARS-27…29):**
- Canales `BTL` | `FABRICA` | `TRADUCTOR_NEGOCIO`.
- Checklist completo en el mismo acto.
- Transacción única:
  1. Lead `estado = SQL`
  2. `mql` automático: `ConvertidoSQL`, `calificado_por` = KAM, `motivo_calificacion = "Auto-calificado — creación directa comercial"`, `checklist_id` = checklist creado
  3. `sql`: `mql_id` del anterior, `en_backlog = false`, `comercial_asignado_id` = KAM, `origen_creacion = directo_comercial`, `estado = Asignado` (si el ENUM de sqls ya lo tiene; si no, alinear con lo que usa calificación hoy sin inventar estados nuevos — STOP R4 si el ENUM no tiene `Asignado`)
- EARS-30: visible en bandeja KAM = responsabilidad de calificación; aquí basta crear el SQL asignado correctamente.

**`business_referrer_id` (EARS-31…33b):**
- Obligatorio solo si `canal_origen = TRADUCTOR_NEGOCIO`; en otro caso forzar `null` / omitir.
- Selector backend: usuarios activos con rol `TraductorDeNegocio`.
- `TraductorDeNegocio` autenticado: list/get leads **solo** donde `business_referrer_id = me`; deny create/update lead y cualquier write de campaign.

**Segments (EARS-34…36):**
- `segment_id` opcional mientras coexistencia; `segmento` ENUM sigue requerido.
- `subsegment_id` opcional; validar pertenencia al `segment_id`.
- Sin subsegments activos → UI/API no exige el campo.

**DG-06 approve MQL:**
- Al crear SQL por enrutamiento normal: `origen_creacion = enrutamiento_normal`, `en_backlog = true` (comportamiento actual + nuevo campo).

**Auditoría:** create/update/delete de contactos de lead y cambios de schema-afectados vía mecanismo `audit` existente (DG-22).

### E. Controllers / endpoints (mínimo)

Reutilizar rutas existentes de leads; extender payloads. Añadir si faltan:
- `GET /demand/segments` (+ subsegments por segment) — lectura para selects.
- `GET /demand/traductores` o reutilizar users filtrados por rol — solo activos `TraductorDeNegocio`.
- Endpoint(s) de creación directa pueden ser el mismo `POST /leads` discriminado por rol del actor (preferido) o rutas dedicadas — documenta la elección en el resumen.

Importar `AccountsModule` en `DemandGenerationModule`.

### F. Accounts — GC-11

Con `lead_contacts.person_id` ya presente, el soft-delete de `people` **debe** rechazar si hay filas activas en `lead_contacts` (y en `ouv_contactos` **solo si** la columna `person_id` existe; si no, no bloquear por OUV). Quitar el bypass “columna ausente” para `lead_contacts`.

---

## Frontend — `frontend/src/modules/demand-generation`

Patrones obligatorios: `useState`/`useEffect`/`useCallback`, draft/applied, `Pagination.tsx`, `<table>` nativo, `apiRequest()`, tokens Verytel, UI en español.

### Contactos / empresa
- `LeadFormModal` y pantallas de detalle: dejar de editar `empresa_nombre`/`nombre`/… denormalizados.
- Flujo: buscar/seleccionar o crear `account` + `person` (llamadas al API de `accounts`); guardar lead con `contacts: [{ person_id, position }]`.
- Validar 1..3 contactos; principal position 1; misma account (mensaje EARS-41).
- Listas/Kanban/Agenda/MQL/export: mostrar empresa y contacto desde el enrich del API (principal).

### Rutas directas
- Botón/modal “Nuevo Lead” para `ProductManager` (canales BTL/FABRICA + checklist 4).
- Modal “Nuevo Lead directo” para `EjecutivoComercial` (BTL/FABRICA/TRADUCTOR_NEGOCIO + checklist); al éxito, redirigir a bandeja SQL si la ruta ya existe; si no, a detalle del lead en `SQL` y documentar en resumen.
- Labels UI: “Product Manager”, “Profesional Soporte Comercial” donde corresponda; comparar roles por `ProductManager` / `SoporteComercial` / etc.

### Traductor
- Si `canal_origen = TRADUCTOR_NEGOCIO`: mostrar select `business_referrer_id`.
- Vista “Mis leads referidos” solo lectura para `TraductorDeNegocio` (filtro server-side; no botones create/edit).

### Segments
- Select `segment_id` (+ `subsegment_id` condicional) en create/edit, coexistiendo con select legado `segmento` mientras el API lo exija.
- Filtros de lista: preferir segment nuevo si hay datos; no romper filtro por ENUM.

### CSV import
- Alinear columnas al nuevo modelo (email/NIT → people/accounts); respetar DG-08 (rechazo por fila).

### Nav
- Actualizar `DemandNav` / guards para nuevos roles (agenda sigue `SoporteComercial`; MQL `DirectorMercadeo`; traductor ve solo su vista).

---

## Condiciones de parada (STOP)

Si ocurre cualquiera, detente, escribe `NOTAS-BLOQUEO-DEMAND-GENERATION-V25.md` y espera:

- **R1:** Truncate bloqueado (parece producción / falta flag de seguridad) o `people`/`accounts` no existen aún.
- **R2:** No hay forma segura de seedear `ProductManager`/`TraductorDeNegocio` sin corromper roles existentes.
- **R3:** Sequelize/CASL no permite filtrar `TraductorDeNegocio` a `business_referrer_id = me` sin inventar un patrón nuevo no documentado — propone opciones y para.
- **R4:** ENUM `sqls.estado` no tiene valor compatible con “Asignado” para EARS-29, o `mqls.estado` no tiene `ConvertidoSQL`.
- **R5:** Migración falla en MySQL local y el fix requeriría `sync({ force: true })` o drop de datos fuera de `lead_contacts`/`ouv_contactos`.
- **R6:** El trabajo pide implícitamente `ouvs.account_id`, reestructurar `ouv_contactos`, o KPIs de calificación — rechaza y documenta.
- **R7:** Librería no permitida parece “necesaria” — no la agregues; documenta.
- **R8:** Ambigüedad de contrato API (shape de contacts enrich / create-inline person) que bloquee FE y BE a la vez — pregunta al arquitecto con 2–3 opciones.
- **R9:** Tests e2e/unitarios existentes rompen de forma no relacionada y el fix sale del alcance.

---

## Criterios de hecho (Definition of Done)

- [ ] Migración truncó `lead_contacts` + `ouv_contactos` y reestructuró `lead_contacts` con `person_id` (sin denormalizados).
- [ ] `leads` sin copia denormalizada de contacto; con `business_referrer_id`, `segment_id`, `subsegment_id`.
- [ ] Tablas `segments`/`subsegments` + seed de 4 segmentos; ENUM `segmento` sigue coexistiendo.
- [ ] `sqls.origen_creacion` poblado en DG-06 (`enrutamiento_normal`) y EARS-29 (`directo_comercial`).
- [ ] Roles `ProductManager` y `TraductorDeNegocio` en seed + permisos; UI labels correctos.
- [ ] EARS-24…26 y EARS-27…29 implementados en transacción con auditoría.
- [ ] EARS-31…33b: campo condicional + lectura filtrada del traductor.
- [ ] EARS-37…42 + DG-08 + DG-19/20 en backend; FE usa people/accounts.
- [ ] GC-11 de `accounts` bloquea soft-delete de person referenciado en `lead_contacts`.
- [ ] Sin `ouvs.account_id`; sin reestructurar schema de `ouv_contactos` (solo truncate).
- [ ] `AGENTS.md` ya no afirma `ouvs.cuenta_id` como hecho.
- [ ] `RESUMEN-PASO-DEMAND-GENERATION-V25.md` escrito con archivos tocados y cómo probar.

## Al terminar

No abras PR ni hagas commit a menos que el usuario lo pida. Entrega el resumen y la lista de archivos tocados.
