# PROMPT — Implementación discovery / OUV Funnel v1.4 (TO-BE)

**Copia/pega este bloque completo en Cursor Agent.**  
**Spec:** `docs/specs/spec-ouv-funnel.md` v1.4 (APROBADO)  
**Gate previo:** `speckit-analyze` → *Sin inconsistencias — listo para generar prompt*.  
**Alcance:** delta sobre el módulo **ya existente** `discovery` (+ higiene GC-11 en `accounts`).  
**Incluye (obligatorio):**
- ALTER `ouv_contactos` (`ADD person_id`, DROP denormalizados) + `ouvs.account_id` (+ `segment_id`/`subsegment_id` si aún no existen), truncate **defensivo** + guarda de producción (**5A**).
- Renombrar/reescribir `crearDesdeLead` → `reutilizarDesdeLead` (deja de copiar; reutiliza `person_id`).
- Corregir `crearDesdeSql`: hoy cae a `lead.empresa_nombre` (retirado en demand-gen v2.5) → leer `accounts.name` vía `person_id` del contacto principal (`position = 1`).
- Auto-poblar `ouvs.account_id` en Vía 1 (**GC-13**, EARS-01).
- Validación **un account por OUV** (EARS-08b / Hallazgo 3A).
- Servicio público que calificación ya consume / seguirá consumiendo (**Hallazgo 1A**): `OuvsService.crearDesdeSql` + `OuvContactosService.reutilizarDesdeLead` exportados; **no** endpoint de conversión en discovery.

**Fuera de este prompt:**
- Orquestación completa / criterios nuevos de `spec-calificacion.md` EARS-12 (calificación ya llama `crearDesdeSql` — aquí solo se endurece el contrato discovery; no reescribir el módulo `qualification` salvo tipado mínimo si el signature cambia).
- KPI por `origen_creacion`, Override Ganada, reapertura, vista Marketing (Wave 2).
- Reestructurar de nuevo `lead_contacts` (ya hecho en demand-gen v2.5).
- Jerarquía de cuentas / salud (resto Módulo 12).
- Commit / PR (solo si el usuario lo pide).

---

## Rol

Eres el implementador backend→frontend del CRM Frisson (`crm-e2e`). Stack fijo: NestJS 11 + Sequelize + MySQL + React 19 + Vite + Tailwind 4 + lucide-react. Sin TanStack Query/Table, SWR, Zustand, Redux, CVA, clsx, tailwind-merge, Radix, shadcn.

Lee antes de tocar código:
- `CONSTITUTION.md`, `AGENTS.md`
- `docs/specs/spec-ouv-funnel.md` **v1.4**
- `docs/specs/spec-calificacion.md` v2.3 (frontera: calificación orquesta; discovery = schema + servicios)
- `docs/specs/spec-gestion-cuentas.md` v0.4 (consumo de `AccountsService`)
- `docs/specs/spec-demand-generation.md` v2.5 (lead_contacts ya con `person_id`)
- Decision records:  
  `2026-08-DR-unificacion-contactos-cuentas-wave1.md`,  
  `2026-08-DR-auto-poblar-ouv-account-id.md`,  
  `2026-08-DR-accounts-por-lead.md`,  
  `2026-08-DR-convencion-nombres-ingles.md`,  
  `2026-08-DR-subsegmentos.md` (si agregas FKs a `segments`/`subsegments`)
- `.cursor/rules/100-backend-nestjs.mdc`, `200-frontend-react.mdc`, `300-sequelize-audit.mdc`, `600-ui-design.mdc`, `700-modules.mdc`
- Código AS-IS:  
  `backend/src/modules/discovery/**`,  
  `backend/src/modules/accounts/**`,  
  `backend/src/modules/qualification/services/sqls.service.ts` (`convertirEnOuv` → `ouvsService.crearDesdeSql`),  
  `frontend/src/modules/discovery/**`  
  (especialmente `ContactoFormModal.tsx`, `ContactosSidePanel.tsx`, `ouvs-api.ts`)

**Artículo II:** el código actual aún tiene `ouv_contactos` denormalizado (`nombre`/`cargo`/`email`/`telefono`), `crearDesdeLead` que **copia**, y `crearDesdeSql` con fallback a `lead.empresa_nombre`. El spec v1.4 es el TO-BE: actualiza el código para coincidir con el spec, no “preserves” el modelo viejo.

**Frontera de módulo (Hallazgo 1A):**  
- **Calificación** orquesta la txn SQL→OUV (`convertirEnOuv` / EARS-12).  
- **Discovery** implementa schema + lógica de inicialización OUV y contactos.  
- EARS-01/02 **no** son un endpoint `POST /discovery/ouvs/from-sql` nuevo.

## Objetivo

Cerrar el delta v1.3–v1.4 del embudo OUV en `discovery`:
1. Schema: `ouv_contactos.person_id` + drop denormalizados; `ouvs.account_id` (GC-13); opcional `ouvs.segment_id`/`subsegment_id` si faltan.
2. Contrato Vía 1: `crearDesdeSql` + `reutilizarDesdeLead` (público, misma txn).
3. Contactos OUV vía `people`/`accounts` (EARS-08…11 + EARS-08b).
4. UI detalle OUV: panel de contactos alineado (selector/crear person; editar solo `notas`).
5. GC-11: soft-delete de `people` bloquea si hay `ouv_contactos.person_id` activo.

## Orden de trabajo (gates internos)

1. **Migración** (5A): guarda producción → truncate defensivo de `ouv_contactos` si hace falta → ALTER `ouv_contactos` + `ouvs`.  
2. Models → DTOs → services → controllers (backend `discovery`).  
3. Importar `AccountsModule`; inyectar **solo** el servicio público `AccountsService` (nunca deep-import de internals no exportados).  
4. Actualizar GC-11 en `accounts` (ahora sí existe `ouv_contactos.person_id`).  
5. Verificar que `DiscoveryModule` **exporta** `OuvsService` y `OuvContactosService` (ya lo hace AS-IS — mantener).  
6. Ajuste mínimo en `qualification` solo si cambia la firma de `crearDesdeSql` (tipos/imports); **no** mover orquestación.  
7. Frontend discovery: contactos + create directa opcional `account_id` / segments si el DTO lo expone.  
8. Al cerrar: escribir `RESUMEN-PASO-OUV-FUNNEL-V14.md` en la raíz.

No saltes a frontend antes de que el backend compile y las migraciones corran en local.

---

## Backend

### A. Migración — clarify 5A

**Guarda (igual que demand-gen EARS-43):**
- Si `NODE_ENV === 'production'` **y** `ALLOW_CONTACT_TRUNCATE !== 'true'` → **STOP R1** (no truncar a ciegas).
- En local/dev: truncar solo si es necesario para aplicar `person_id` NOT NULL (p. ej. quedan filas residuales denormalizadas). Demand-gen ya truncó `ouv_contactos` en oleada previa; el truncate aquí es **defensivo**, no un migrador histórico.

```js
// Pseudocódigo up():
if (production && !allowTruncate) throw new Error('... R1 ...');
// Si hay filas en ouv_contactos O siempre de forma defensiva documentada:
await queryInterface.sequelize.query('TRUNCATE TABLE `ouv_contactos`');
// ALTER ouv_contactos:
//   ADD person_id CHAR(36) NOT NULL + FK → people.person_id + índice
//   DROP nombre, cargo, email, telefono
// ALTER ouvs:
//   ADD account_id CHAR(36) NULL + FK → accounts.account_id + índice
//   ADD segment_id / subsegment_id NULL + FK → segments.id / subsegments.id (si aún no existen)
```

**Mantener en `ouv_contactos`:** `contacto_ouv_id` (PK — **no renombrar**; `ouv_influencias.contacto_ouv_id` no cambia), `ouv_id`, `notas`, timestamps, `deleted_at`.

**No** truncar `ouvs`, `lead_contacts`, `people`, `accounts` ni otras tablas.

### B. Models / DTOs

**`OuvContacto`:**
- Quitar `nombre`, `cargo`, `email`, `telefono`.
- Add `personId` (`field: 'person_id'`).
- Responses enriquecidos vía `AccountsService` (name, job_title, email, phone, account_id, account_name) — no devolver columnas eliminadas.

**`Ouv`:**
- Add `accountId` nullable.
- Add `segmentId` / `subsegmentId` nullable si se migraron.
- `empresaNombre` sigue siendo snapshot VARCHAR (no FK).

**DTOs contactos:**
- Create: `{ person_id }` **o** `{ person: { name, job_title?, email?, phone?, account_id | account: {...} }, notas? }` — crear person vía `AccountsService` en la misma txn cuando venga inline.
- Update: **solo** `{ notas }` → renombrar método service `actualizar` → `actualizarNotas` (EARS-09).
- Eliminar: soft-delete relación; si hay influencias con ese `contacto_ouv_id`, setear `NULL` + audit (EARS-10).

**DTOs OUV directa (`CrearOuvDirectaDto`):**
- Mantener `titulo`, `empresa_nombre`, `segmento`/`vertical`, `descripcion`.
- Add opcional `account_id`; opcional `segment_id`/`subsegment_id` (validar pertenencia subsegment→segment).
- Si viene `account_id`, PUEDE alinear `empresa_nombre` al `accounts.name` (spec §2.1); no inventar sync posterior.

### C. Services — contrato Vía 1 (Hallazgo 1A + EARS-01/02)

#### `OuvsService.crearDesdeSql(input, transaction)` — **API pública**

Ya existe y es llamada desde `qualification.sqls.service.convertirEnOuv`. Reescribir la lógica interna:

1. Resolver lead vía API pública de demand-gen (`findLeadById` o equivalente).
2. Contacto principal = `lead_contacts` con `position = 1` (fallback documentado solo si el API ya ordena así — preferir `position === 1` explícito).
3. Con `person_id` del principal → `AccountsService` → obtener `account_id` + `accounts.name`.
4. Crear `ouvs` en la txn:
   - `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = desde_sql`, `sql_id_origen`, `comercial_id`
   - **`account_id`** = account del person principal (**GC-13 / EARS-01**)
   - **`empresa_nombre`** = `accounts.name` de esa account (snapshot) — **prohibido** usar `lead.empresa_nombre` (campo retirado)
   - Consecutivo `OUV-####`; seed 3 influencias; checklist UNIVERSO
5. Llamar `reutilizarDesdeLead(ouvId, leadId, transaction)`.
6. Emitir / dejar listo el evento `ouv.creada_desde_sql` según el patrón AS-IS del workflow (EARS-04; suele dispararse desde la txn de calificación o desde este service — **no dupliques** el evento; conserva el comportamiento actual de emisión y documenta en el resumen).

Si el principal no tiene `person_id` / account resoluble → **STOP R4** o `BadRequestException` clara (no inventar empresa `PENDIENTE` silenciosa salvo que el AS-IS ya lo documente; preferir fail-fast alineado al TO-BE).

#### `OuvContactosService.reutilizarDesdeLead(ouvId, leadId, transaction)` — **API pública**

- **Eliminar** `crearDesdeLead` (o dejar alias deprecated de un release que llame al nuevo y falle tests si se usa mal — preferir rename limpio + actualizar call sites).
- Consultar contactos del lead (API pública demand-gen) → por cada `person_id` **único**, crear fila `ouv_contactos` `{ ouv_id, person_id, notas: null }`.
- **No** copiar nombre/cargo/email/teléfono.
- **No** auto-asignar a influencias (`contacto_ouv_id` sigue NULL) — EARS-03.
- Sin sync posterior con el lead — EARS-11.

#### `OuvContactosService.crear` — EARS-08 + **EARS-08b**

1. Resolver `person` (existente o crear vía AccountsService).
2. Si `ouv.account_id` informado y `person.account_id !== ouv.account_id` → rechazar (mensaje claro: empresa distinta a la de la OUV).
3. Si `ouv.account_id` es NULL y es el **primer** contacto activo → setear `ouv.account_id = person.account_id` y PUEDE setear/alinear `empresa_nombre` al `accounts.name`.
4. Contactos posteriores: misma regla de coincidencia.
5. Solo dueño `EjecutivoComercial` (patrón AS-IS de ownership).

#### `OuvsService.crear` (directa) — EARS-05…07

- `account_id` nullable; **no** crear `ouv_contactos` al alta.
- Resto del flujo AS-IS (influencias, checklist, evento `ouv.creada_directa`).

### D. Controllers

- Reutilizar `POST/PATCH/DELETE /discovery/ouvs/:id/contactos` con nuevos payloads.
- Enrich en GET detalle/list contactos.
- Roles PascalCase en checks/CASL: `EjecutivoComercial`, `SoporteComercial` (UI: “Ejecutivo Comercial” / “Profesional Soporte Comercial”).

### E. Accounts — GC-11

Con `ouv_contactos.person_id` presente, el soft-delete de `people` **debe** rechazar si hay filas activas en `ouv_contactos` (además de `lead_contacts`). Quitar bypass “columna ausente” para `ouv_contactos`.

### F. Módulo / boundaries

- `DiscoveryModule` importa `AccountsModule` + sigue exportando `OuvsService` / `OuvContactosService`.
- `QualificationModule` sigue inyectando `OuvsService` — no deep-import de contactos desde calificación salvo que ya exista y sea necesario; preferir que `crearDesdeSql` encapsule `reutilizarDesdeLead`.
- No importar internals de `demand-generation` fuera de su servicio público.

### G. Zonas / influencias / checklist / cierre

Sin rediseño: el funnel EARS-12…34 ya implementado permanece. Solo adapta lo que rompa por el cambio de shape de contactos (p. ej. labels en eventos/payloads que enviaban `nombre` denormalizado → usar enrich de person).

---

## Frontend — `frontend/src/modules/discovery`

Patrones: `useState`/`useEffect`/`useCallback`, `apiRequest()`, tokens Verytel, UI en español.

### Panel de contactos (EARS-08…10, UX §8.3 / §8.5)

- `ContactosSidePanel` / `ContactoFormModal`: **dejar** de editar nombre/cargo/email/teléfono denormalizados.
- **Agregar:** buscar/seleccionar `person` existente (API accounts) **o** crear person+account inline (mismo patrón que demand-generation leads).
- Payload create: `{ person_id }` o create-inline acordado con el backend; `notas` opcional.
- **Editar:** solo campo `notas` (si el modal sirve para edit, ocultar resto).
- Eliminar: soft-delete de la relación (mensaje claro).
- Listar: mostrar datos desde enrich del API (`people`/`accounts`).
- Mostrar error de EARS-08b si el backend rechaza por account distinta.

### Crear OUV directa

- Campo opcional de `account_id` (selector empresas) si el API lo acepta.
- `empresa_nombre` sigue capturable por el comercial.
- Selects `segment_id`/`subsegment_id` opcionales si el backend los expone; coexistir con `segmento` ENUM mientras el API lo exija.

### Detalle / board

- Mostrar `account` / empresa desde snapshot `empresa_nombre` y/o enrich de `account_id` si el response lo incluye.
- No romper avance/retroceso/cierre/influencias existentes.

---

## Condiciones de parada (STOP)

Si ocurre cualquiera, detente, escribe `NOTAS-BLOQUEO-OUV-FUNNEL-V14.md` y espera:

- **R1:** Truncate bloqueado (producción sin `ALLOW_CONTACT_TRUNCATE=true`) o tablas `people`/`accounts`/`lead_contacts.person_id` no existen.
- **R2:** `ouv_influencias.contacto_ouv_id` o PK `contacto_ouv_id` forzarían rename/migración incompatible — no inventes; documenta.
- **R3:** No hay API pública en demand-gen para listar `person_id` de un lead sin deep-import — propone 2–3 opciones y para.
- **R4:** No se puede resolver `accounts.name` / `account_id` del contacto principal (datos inconsistentes post v2.5) y el fail-fast no está definido en spec de forma operable.
- **R5:** Migración falla en MySQL local y el fix requeriría `sync({ force: true })` o drop de datos fuera de `ouv_contactos`.
- **R6:** El trabajo pide implícitamente reescribir calificación EARS-12 completo, KPIs, Wave 2 (reapertura/override), o reestructurar `lead_contacts` otra vez — rechaza y documenta.
- **R7:** Librería no permitida parece “necesaria” — no la agregues; documenta.
- **R8:** Ambigüedad de contrato API (shape enrich contactos / create-inline person) que bloquee FE y BE a la vez — pregunta al arquitecto con 2–3 opciones.
- **R9:** Tests e2e/unitarios existentes rompen de forma no relacionada y el fix sale del alcance.

---

## Criterios de hecho (Definition of Done)

- [ ] Migración: guarda prod + truncate defensivo `ouv_contactos`; `person_id` NOT NULL FK; drop `nombre`/`cargo`/`email`/`telefono`.
- [ ] `ouvs.account_id` nullable FK → `accounts`; (si aplica) `segment_id`/`subsegment_id`.
- [ ] `crearDesdeLead` eliminado/reemplazado por `reutilizarDesdeLead` (reutiliza `person_id`, no copia).
- [ ] `crearDesdeSql` setea `account_id` (GC-13) y `empresa_nombre` desde `accounts.name` del principal — **sin** `lead.empresa_nombre`.
- [ ] `OuvsService.crearDesdeSql` + `OuvContactosService.reutilizarDesdeLead` públicos/exportados; calificación sigue orquestando (sin endpoint de conversión en discovery).
- [ ] EARS-08b: rechazo por account distinta; auto-set `account_id` en el primer contacto si OUV sin account.
- [ ] EARS-09: update solo `notas`; EARS-10: soft-delete relación + limpia FK influencias.
- [ ] GC-11 bloquea soft-delete de person referenciado en `ouv_contactos`.
- [ ] FE: panel contactos vía accounts/people; sin formularios denormalizados.
- [ ] Zonas/influencias/checklist/cierre existentes siguen compilando y operando.
- [ ] `RESUMEN-PASO-OUV-FUNNEL-V14.md` con archivos tocados y cómo probar (incl. flag `ALLOW_CONTACT_TRUNCATE` si hizo falta).

## Al terminar

No abras PR ni hagas commit a menos que el usuario lo pida. Entrega el resumen y la lista de archivos tocados.
