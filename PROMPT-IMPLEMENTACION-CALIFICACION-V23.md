# PROMPT — Implementación calificación v2.3 (TO-BE)

**Copia/pega este bloque completo en Cursor Agent.**  
**Spec:** `docs/specs/spec-calificacion.md` v2.3 (APROBADO)  
**Gate previo:** spec aprobado; prerrequisitos `spec-demand-generation.md` v2.5 + `spec-ouv-funnel.md` v1.4 ya implementados.  
**Alcance:** delta sobre el módulo **ya existente** `qualification` (+ ajuste mínimo en `discovery` solo para pasar `segment_id`/`subsegment_id` en `crearDesdeSql`).  

**Incluye (obligatorio):**
- **EARS-01b (contrato):** SQLs ruta `EjecutivoComercial` nacen en `Asignado` con `comercial_asignado_id` = KAM y `origen_creacion = directo_comercial`. **No crear SQL en este módulo** — verificar que demand-gen ya lo hace y que las bandejas de calificación lo respetan (excluir de inbox de enrutamiento; visibles en bandeja del KAM).
- **EARS-09:** altas en demand-gen DEBEN invocar `workflowEngine.transition(..., 'sql.creado' | 'sql.creado_directo', ...)` en la misma txn. El parche `sql.creado_directo` **ya está** en demand-gen + `workflow.rules.ts` — **verificar, no reimplementar ni duplicar** en calificación.
- **EARS-12:** calificación orquesta la txn SQL→OUV llamando a `OuvsService.crearDesdeSql` (ouv-funnel v1.4). **No reescribir** GC-13 / `reutilizarDesdeLead` / seed influencias-checklist aquí — solo invocar y completar update SQL + evento `ouv.creada_desde_sql`.
- **EARS-15/16/17:** `segment_id` (primario) + `subsegment_id` opcional en conversión; schema ya existe en `ouvs` (v1.4). Extender DTO de conversión + `crearDesdeSql` para persistirlos; validar pertenencia subsegment→segment.
- Roles PascalCase en EARS/CASL/UI: `EjecutivoComercial`, `SoporteComercial`, `DirectorMercadeo` (labels UI: “Ejecutivo Comercial”, “Profesional Soporte Comercial”).
- Columna canónica **`comercial_asignado_id`** (nunca inventar `comercial_id` para asignación SQL; `ouvs.comercial_id` es otra columna).

**Fuera de este prompt:**
- **§7 KPIs** (ajuste `MQL Rate`/`SQL Rate` por `origen_creacion`) — **diferido Hallazgo 6A**. NO implementar sin confirmación explícita de Gerencia/Marketing. Si el trabajo lo pide → **STOP R6**.
- EARS-14 descartar SQL (requiere DR).
- Reasignación de SQL ya `Asignado`.
- Reestructurar `ouv_contactos` / agregar `ouvs.account_id` (ya hecho en ouv-funnel v1.4).
- Re-crear SQLs en demand-gen (solo consumir contrato).
- Commit / PR (solo si el usuario lo pide).

---

## Rol

Eres el implementador backend→frontend del CRM Frisson (`crm-e2e`). Stack fijo: NestJS 11 + Sequelize + MySQL + React 19 + Vite + Tailwind 4 + lucide-react. Sin TanStack Query/Table, SWR, Zustand, Redux, CVA, clsx, tailwind-merge, Radix, shadcn.

Lee antes de tocar código:
- `CONSTITUTION.md`, `AGENTS.md`
- `docs/specs/spec-calificacion.md` **v2.3**
- `docs/specs/spec-demand-generation.md` v2.5 (EARS-27…30, `sql.creado_directo`, `origen_creacion`)
- `docs/specs/spec-ouv-funnel.md` v1.4 (contrato `crearDesdeSql` / `reutilizarDesdeLead`)
- `docs/specs/spec-workflow-engine.md` v1.1
- DRs: `2026-08-DR-lead-directo-sql.md`, `2026-08-DR-auto-poblar-ouv-account-id.md`, `2026-08-DR-subsegmentos.md`, `2026-08-DR-unificacion-contactos-cuentas-wave1.md`
- `.cursor/rules/100-backend-nestjs.mdc`, `200-frontend-react.mdc`, `300-sequelize-audit.mdc`, `600-ui-design.mdc`, `700-modules.mdc`
- Código AS-IS:  
  `backend/src/modules/qualification/**`,  
  `backend/src/modules/discovery/services/ouvs.service.ts` (`crearDesdeSql`),  
  `backend/src/modules/discovery/dtos/crear-ouv.dto.ts`,  
  `backend/src/modules/demand-generation/services/leads.service.ts` (ruta directa + `sql.creado_directo`),  
  `backend/src/modules/workflow-engine/workflow.rules.ts`,  
  `frontend/src/modules/qualification/**`

**Artículo II:** el repo ya tiene calificación (assign / cita / convertir). El TO-BE v2.3 es un **delta**: segmentos en conversión, contrato EARS-01b en bandejas, higiene `comercial_asignado_id` / `origen_creacion`, sin duplicar lógica de discovery ni de demand-gen.

**Fronteras de módulo (no cruzar):**
| Capacidad | Dueño |
|---|---|
| Alta SQL `enrutamiento_normal` + `sql.creado` | demand-generation (approve MQL) |
| Alta SQL `directo_comercial` + `sql.creado_directo` | demand-generation (EARS-29) |
| Schema OUV / `account_id` / `person_id` / `reutilizarDesdeLead` | discovery (v1.4) |
| Orquestación SQL→OUV (txn, update SQL, evento) | **qualification** (`convertirEnOuv`) |
| KPI fórmulas §7 | **nadie en este prompt** |

## Objetivo

1. Asegurar contrato EARS-01b / EARS-09 consumido (no reimplementado).
2. Endurecer EARS-12: `convertirEnOuv` invoca `crearDesdeSql` y pasa `segment_id`/`subsegment_id`.
3. UI conversión + bandejas alineadas a v2.3 (`origen_creacion`, segmentos, roles PascalCase).
4. Documentar verificación del parche `sql.creado_directo` en el resumen.

## Orden de trabajo (gates internos)

1. **Verificar prerrequisitos** (no migrar schema OUV otra vez):  
   - `ouvs.account_id`, `ouv_contactos.person_id`, `ouvs.segment_id`/`subsegment_id` existen.  
   - demand-gen: create ejecutivo llama `sql.creado_directo` en misma txn; campo `comercial_asignado_id` + `origen_creacion`.  
   - Si falta → **STOP R1**.  
2. Extender `CrearOuvDto` + `OuvsService.crearDesdeSql` para persistir `segmentId`/`subsegmentId` (mínimo cambio discovery — **no** tocar contactos/account).  
3. Actualizar `qualification` DTOs/services/controllers (convertir, listados, `origen_creacion` en response).  
4. Frontend qualification: modal conversión + bandejas.  
5. Auditar nombres `comercial_asignado_id` en payloads WF de assign (EARS-04).  
6. Al cerrar: `RESUMEN-PASO-CALIFICACION-V23.md` en la raíz.

No saltes a frontend antes de que el backend compile.

---

## Backend

### A. Verificación EARS-01b / EARS-09 (sin reimplementar)

**En demand-gen (solo lectura + assert en resumen):**
- Ruta `EjecutivoComercial` crea SQL con:
  - `estado = Asignado`
  - `comercial_asignado_id = createdBy` (KAM)
  - `origen_creacion = directo_comercial`
  - `workflowEngine.transition(EntityType.SQL, sqlId, 'sql.creado_directo', ctx, transaction)` en la **misma** txn del `sql.create`
- Regla `sql.creado_directo` existe en `workflow.rules.ts` (destinatarios vacíos / audit).
- Approve MQL sigue usando `sql.creado` + `origen_creacion = enrutamiento_normal` + estado `PendienteAsignacion`.

**Si el `transition('sql.creado_directo')` falta o está fuera de la txn → STOP R2** (arreglar en demand-gen con el parche mínimo; no inventar un segundo alta en calificación).

**En calificación — NO:**
- No agregar `POST` que cree SQL.
- No llamar `sql.creado_directo` otra vez al listar/asignar.
- No copiar la lógica de create de leads.

### B. Bandejas / contrato visible (EARS-01b, EARS-02)

- Inbox `PendienteAsignacion` (`listInbox`): solo enrutamiento normal. Los `directo_comercial` **nunca** deben aparecer (ya nacen `Asignado`; si por bug hubiera uno en pendiente, documenta — no inventes filtro mágico salvo que el AS-IS lo requiera).
- Bandeja del KAM (`listAssigned`): incluir SQLs `Asignado` (y estados posteriores según AS-IS) del `comercial_asignado_id = me`, **incluyendo** `origen_creacion = directo_comercial`.
- Exponer `origen_creacion` en `SqlDetailDto` / list items para UI (badge opcional).

### C. Asignación (EARS-03…08) — higiene

- DTO ya usa `comercial_asignado_id` — mantener.
- Al `assign`: actualizar `sqls.comercial_asignado_id` (no otro nombre); `workflowEngine.transition(..., 'sql.asignado', ...)` con **`payload.comercial_asignado_id`** (si el AS-IS manda `comercial_id` en el payload, alinear al nombre canónico del spec EARS-04 sin romper guards — si un guard lee la clave vieja, actualiza guard + payload juntos o **STOP R8**).
- Cita opcional al asignar + reagendar dueño: conservar AS-IS; roles `SoporteComercial` / `EjecutivoComercial`.

### D. Conversión SQL→OUV (EARS-10…13, 15…17)

#### `CrearOuvDto` (discovery — mínimo)

Extender (coexistencia ENUM):
```ts
segmento: OuvSegmento;           // legado, sigue requerido mientras coexistencia
segment_id: string;              // NUEVO — obligatorio en conversión (EARS-11/15)
subsegment_id?: string | null;   // NUEVO — opcional (EARS-16)
titulo, vertical, descripcion?
```

Validar EARS-17: si viene `subsegment_id`, pertenece a `segment_id` (consulta a `subsegments` vía servicio público de demand-gen o query mínima — **sin** deep-import ilegal; si no hay API pública, opciones en R8).

#### `OuvsService.crearDesdeSql`

Además de GC-13 / `empresa_nombre` / `reutilizarDesdeLead` ya implementados:
- Persistir `segmentId = dto.segment_id`, `subsegmentId = dto.subsegment_id ?? null`.
- **No** copiar automáticamente `subsegment_id` del lead (EARS-16).
- Default sugerido de `segment_id` desde el lead (si el lead tiene `segment_id`) lo aporta el **frontend / DTO de entrada**; el service no inventa herencia de subsegment.

#### `SqlsService.convertirEnOuv` (qualification — orquestación)

Mantener / endurecer:
1. Guard: SQL `Asignado`, actor = `comercial_asignado_id` (EARS-13).
2. Misma txn:
   - `ouv = await this.ouvsService.crearDesdeSql({ sqlId, comercialId: actor, leadId, dto }, transaction)`  
     → discovery hace OUV + account_id + empresa_nombre + contactos person_id + influencias + checklist.
   - `sql.update({ estado: ConvertidoOUV, ouvId: ouv.ouvId, ... })`
   - `workflowEngine.transition(..., 'ouv.creada_desde_sql', ...)` (si ya está aquí, **no duplicar** dentro de `crearDesdeSql`).
3. **Prohibido** en este service: crear filas `ouv_contactos` a mano, setear `account_id` a mano, copiar nombre/email denormalizados.

### E. Controllers / CASL

- Rutas existentes bajo `/qualification/sqls` — extender body de convertir.
- Subjects/roles: `SoporteComercial`, `EjecutivoComercial`, `DirectorMercadeo` en PascalCase.
- Sin endpoint de “crear SQL directo” en qualification (vive en demand-gen / leads).

### F. Migraciones

- **No** nueva migración de `ouv_contactos` / `account_id` / `origen_creacion` si ya existen.
- Solo migrar si falta algo mínimo no cubierto (improbable) — si hace falta algo grande → STOP R5.

---

## Frontend — `frontend/src/modules/qualification`

Patrones: `useState`/`useEffect`/`useCallback`, draft/applied donde aplique, `apiRequest()`, tokens Verytel, UI en español.

### Conversión (`ConvertirSqlEnOuvModal`)

- Campos: `titulo`, `vertical`, **`segment_id`** (select desde `GET` segments de demand-gen — reutilizar API existente), opcional **`subsegment_id`** (filtrado por segment; EARS-17), `descripcion`.
- Durante coexistencia: seguir enviando `segmento` ENUM si el backend aún lo exige (mapear desde el segment seleccionado o campo legado paralelo — documenta la elección en el resumen).
- Prefill `segment_id` desde el lead del SQL si viene en el detail; **no** prefill `subsegment_id` del lead.
- Redirect al detalle OUV tras éxito (AS-IS).

### Bandejas

- Inbox Soporte: solo pendientes de enrutamiento; labels “Profesional Soporte Comercial”.
- Assigned KAM: incluye directos; badge opcional “Directo” si `origen_creacion = directo_comercial`.
- Comparar roles por `Role.name` PascalCase, no por label UI.

### Assign

- Payload `comercial_asignado_id` (ya AS-IS).

---

## Condiciones de parada (STOP)

Si ocurre cualquiera, detente, escribe `NOTAS-BLOQUEO-CALIFICACION-V23.md` y espera:

- **R1:** Falta schema prerrequisito (`ouvs.account_id`, `ouv_contactos.person_id`, `segment_id` en ouvs, o `sqls.origen_creacion` / `comercial_asignado_id`).
- **R2:** demand-gen no invoca `sql.creado_directo` en la misma txn del alta directa — no dupliques el alta en calificación; documenta el fix mínimo en demand-gen.
- **R3:** `crearDesdeSql` no está exportado / qualification no puede inyectar `OuvsService` sin romper boundaries.
- **R4:** Guards de `ouv.creada_desde_sql` / `sql.asignado` exigen claves de payload incompatibles con `comercial_asignado_id` y no hay fix seguro sin inventar patrón nuevo.
- **R5:** Se pide migración destructiva o reestructurar de nuevo contactos OUV/leads.
- **R6:** Se pide implementar ajuste KPI §7 / `MQL Rate` / `SQL Rate` por `origen_creacion` — **rechaza** (Hallazgo 6A).
- **R7:** Librería no permitida parece “necesaria” — no la agregues; documenta.
- **R8:** Ambigüedad de contrato (map ENUM `segmento` ↔ `segment_id`, o API pública para validar subsegments) que bloquee FE+BE — pregunta con 2–3 opciones.
- **R9:** Tests existentes rompen de forma no relacionada y el fix sale del alcance.

---

## Criterios de hecho (Definition of Done)

- [ ] EARS-01b: verificado en demand-gen (`Asignado` + `comercial_asignado_id` + `directo_comercial`); bandeja KAM los muestra; inbox Soporte no los enruta.
- [ ] EARS-09: `sql.creado_directo` / `sql.creado` solo en demand-gen (misma txn); calificación **no** duplica el alta ni el transition de creación.
- [ ] EARS-12: `convertirEnOuv` orquesta txn e invoca `OuvsService.crearDesdeSql` (sin reescribir contactos/account_id).
- [ ] EARS-11/15/16/17: conversión exige `segment_id`; `subsegment_id` opcional + validación de pertenencia; persistido en `ouvs`.
- [ ] Nombre canónico `comercial_asignado_id` en assign/convert/payloads WF alineados al spec.
- [ ] `origen_creacion` expuesto en responses de calificación (filtros/badge); **sin** cambio de fórmulas KPI.
- [ ] Roles PascalCase en checks/CASL/UI labels.
- [ ] §7 KPI **no** implementado.
- [ ] `RESUMEN-PASO-CALIFICACION-V23.md` con verificación del parche `sql.creado_directo`, archivos tocados y cómo probar.

## Al terminar

No abras PR ni hagas commit a menos que el usuario lo pida. Entrega el resumen y la lista de archivos tocados.
