# Spec — Módulo 2: OUV Funnel (Embudo Comercial Verytel)
**Versión:** 1.4 — clarify 2026-08-10
**Fecha:** 2026-08-10
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Aprobado
**Depende de:** `spec-calificacion.md` **v2.3**, `spec-workflow-engine.md` v1.1, `spec-gestion-cuentas.md` v0.4, `spec-demand-generation.md` v2.5
**Referencia de negocio:** `FILTROS_EMBUDO_COMERCIAL_v5.pdf`, `Frisson_CRM_Blueprint_V2_19062026.pdf`
**Decisiones estructurales:** DR-2026-08-B (con adendas A y B), `2026-08-DR-unificacion-contactos-cuentas-wave1.md`, `2026-08-DR-auto-poblar-ouv-account-id.md`, `2026-08-DR-accounts-por-lead.md`

**Changelog v1.3 → v1.4 (speckit-clarify):**
- Frontera Vía 1: calificación orquesta la txn (EARS-12); este módulo aporta schema + servicio público `reutilizarDesdeLead` (EARS-01/02 = contrato).
- §2.1 `empresa_nombre`: Vía 1 desde `accounts.name`; Vías 2/3/4 captura comercial.
- EARS-08b: un `account_id` por OUV (paridad leads / DR accounts-por-lead).
- Roles PascalCase en EARS/CASL (`EjecutivoComercial`, `SoporteComercial`).
- Migración: ALTER directo; truncate solo defensivo con guarda de producción.

**Changelog v1.2 → v1.3:**
- EARS-02 reutiliza `person_id`; `ouv_contactos` reestructurada; `ouvs.account_id` (GC-13); unificación Wave 1; EARS-08/09 vía `people`.

---

## 1. Alcance

Cubre el ciclo de vida completo de la OUV a través de 4 zonas formales del embudo comercial: dos vías de creación (desde SQL o directa), transiciones de zona, gestión de contactos propios de la OUV (vía `people` reutilizado), gestión de influencias compradoras, checklist por zona, presupuesto estructurado, alertas de gap, cierre, bandeja del `EjecutivoComercial` (UI: “Ejecutivo Comercial”).

**Explícitamente diferido a Wave 2:** Override de Ganada, reapertura, vista Marketing.

---

## 2. Modelo de datos

### 2.1 Tabla `ouvs`

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `ouv_id` | UUID | Sí (PK) | — |
| `consecutivo` | VARCHAR(20) | Sí | Formato `OUV-####` |
| `sql_id_origen` | UUID | No | FK sqls, NULL para OUVs directas |
| `origen_via` | ENUM(desde_sql, directa) | Sí | — |
| `comercial_id` | UUID | Sí (FK users) | Dueño exclusivo |
| `account_id` *(nuevo)* | UUID | No (FK `accounts.account_id`) | Columna **nueva** (inglés). Vía 1: auto-poblada (GC-13). Vías 2/3/4: nullable/seleccionable |
| `titulo` | VARCHAR(200) | Sí | — |
| `empresa_nombre` | VARCHAR(200) | Sí | Snapshot. **Vía 1:** desde `accounts.name` del contacto principal del lead (EARS-01 / demand-gen EARS-42). **Vías 2/3/4:** lo captura el comercial; si elige `account_id`, PUEDE alinearse al `name` de esa cuenta |
| `descripcion` | TEXT | No | — |
| `segmento` | ENUM(Gobierno, DefensaSeguridad, ProyectosEspeciales, B2B) | Sí | Legado — coexiste con `segment_id` (`spec-calificacion.md` v2.3 §2.5) |
| `segment_id` *(nuevo)* | UUID | No | FK `segments.id` |
| `subsegment_id` *(nuevo)* | UUID | No | FK `subsegments.id` |
| `vertical` | ENUM (7 valores, ver 2.6) | Sí | — |
| `zona_actual` | ENUM(UNIVERSO, ENCIMA_FUNNEL, EN_FUNNEL, MAYOR_PROBABILIDAD) | Sí | Default UNIVERSO |
| `resultado` | ENUM(EnCurso, Ganada, Perdida, Descartada) | Sí | Default EnCurso |
| `tiene_gap` | BOOLEAN | Sí | Default false |
| `criterios_faltantes` | JSON | No | — |
| `presupuesto_confirmado` | BOOLEAN | Sí | Default false |
| `presupuesto_monto` | DECIMAL(18,2) | No | — |
| `presupuesto_moneda` | ENUM(COP, USD) | No | — |
| `presupuesto_fecha_captura` | TIMESTAMPTZ | No | — |
| `presupuesto_fuente` | ENUM(cliente_declaro, contrato_previo, licitacion_publicada, estimacion_comercial, sin_verificar) | No | — |
| `motivo_id` | UUID | No | FK motivos_perdida/descarte |
| `motivo_snapshot` | VARCHAR(200) | No | — |
| `motivo_detalle` | TEXT | No | Obligatorio si motivo="Otro" |
| `competidor_ganador` | VARCHAR(200) | No | — |
| `monto_final` | DECIMAL(18,2) | No | Obligatorio si Ganada |
| `moneda_final` | ENUM(COP, USD) | No | Obligatorio si Ganada |
| `monto_estimado_perdido` | DECIMAL(18,2) | No | Obligatorio si Perdida |
| `fecha_cierre` | TIMESTAMPTZ | No | — |
| `created_at` / `updated_at` | TIMESTAMPTZ | Sí | — |

**Nota:** `zona_antes_cierre`, `motivo_reapertura_*`, `override_*` NO se crean en Wave 1.

### 2.2 Tabla `ouv_contactos` *(reestructurada v1.3)*

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `contacto_ouv_id` | UUID | Sí (PK) | Sin cambio — `ouv_influencias.contacto_ouv_id` no requiere ajuste |
| `ouv_id` | UUID | Sí (FK ouvs) | — |
| `person_id` *(nuevo)* | UUID | Sí | FK `people.person_id` — reemplaza `nombre`/`cargo`/`email`/`telefono` |
| `notas` | TEXT | No | Contexto local a esta OUV — no viaja con la persona |
| `created_at` / `updated_at` | TIMESTAMPTZ | Sí | — |
| `deleted_at` | TIMESTAMPTZ | No | Soft-delete estándar |

Índice: `(ouv_id, deleted_at)`; índice en `person_id`.

> ~~`nombre`, `cargo`, `email`, `telefono`~~ eliminados — ahora viven en `people`, se editan desde `spec-gestion-cuentas.md`.

**Migración (clarify 5A):** ALTER directo — ADD `person_id` NOT NULL FK → `people`, DROP denormalizados; ADD `ouvs.account_id` nullable FK → `accounts`. **Truncate solo defensivo** si quedan filas residuales (demand-gen EARS-43 ya truncó en oleada previa). Si se trunca: misma guarda que demand-gen (`NODE_ENV=production` exige `ALLOW_CONTACT_TRUNCATE=true`; no truncar a ciegas).
### 2.3 Tabla `lead_contacts` *(nombre corregido v1.3 — antes se llamaba "contactos" en esta spec)*

Ver `spec-demand-generation.md` **v2.5** §3.2 — reestructurada con `person_id`.

### 2.4 Tabla `ouv_influencias` (sin cambios en v1.3)

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `influencia_id` | UUID | Sí (PK) | — |
| `ouv_id` | UUID | Sí (FK ouvs) | — |
| `tipo` | ENUM(Economica, Tecnica, Fabrica) | Sí | UNIQUE compuesto con `ouv_id` |
| `estado` | ENUM(Verde, Rojo, Amarillo, SinEvaluar) | Sí | Default SinEvaluar |
| `contacto_ouv_id` | UUID | No (FK ouv_contactos) | Nullable |
| `notas` | TEXT | No | — |
| `motivo_estado` | TEXT | No | — |
| `fecha_ultimo_cambio` | TIMESTAMPTZ | No | — |
| `created_at` | TIMESTAMPTZ | Sí | — |

**Seed automático:** al crear una OUV, 3 filas (una por tipo) en `estado = SinEvaluar`, `contacto_ouv_id = NULL`.

### 2.5 Tabla `ouv_checklist_items`
Sin cambios respecto a v1.1.

### 2.6 ENUM `Vertical`
Sin cambios respecto a v1.1.

### 2.7 Catálogos administrables
`motivos_perdida`, `motivos_descarte`, `zona_checklist_templates` — sin cambios. CRUD por `SoporteComercial` (UI: “Profesional Soporte Comercial”).

---

## 3. Criterios EARS

### 3.1 Creación desde SQL — Vía 1 (EARS-01 a EARS-04) — contrato de servicios Discovery

> **Frontera de módulo (clarify):** la **orquestación** de la conversión SQL→OUV vive en `spec-calificacion.md` EARS-12 (txn del módulo calificación). Este módulo implementa el **schema** (`ouv_contactos.person_id`, `ouvs.account_id`) y expone servicios públicos (p. ej. `reutilizarDesdeLead`, helpers de inicialización OUV) que calificación invoca **dentro de esa txn**. EARS-01/02 **no** definen un endpoint de conversión separado en discovery.

**EARS-01** *(ajustado v1.3 — contrato de servicio)*. Cuando calificación solicita la inicialización de una OUV desde SQL, el servicio de discovery DEBE, en la misma transacción recibida:
- Crear/preparar `ouvs`: `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = desde_sql`, `sql_id_origen = <SQL de origen>`, `comercial_id` según actor
- Setear `account_id` = `account_id` del `person` del contacto principal del lead (`lead_contacts.position = 1`) — GC-13 / `2026-08-DR-auto-poblar-ouv-account-id.md`
- Setear `empresa_nombre` desde `accounts.name` de esa misma `account` (snapshot)
- Consecutivo `OUV-####`; tres filas en `ouv_influencias` en `SinEvaluar`; items de checklist zona UNIVERSO

**EARS-02** *(REEMPLAZADO v1.3 — contrato `reutilizarDesdeLead`)*. En la misma transacción, el servicio DEBE **reutilizar** los contactos del lead origen, no copiarlos:
- Se consultan filas de `lead_contacts` con `lead_id = <origen>` y su `person_id`
- Por cada `person_id` único, se crea una fila en `ouv_contactos` con `ouv_id` + el mismo `person_id` (sin duplicar la persona)
- `notas` queda vacío; `position` no se copia (no aplica en discovery)
- La relación se crea una sola vez; sin sincronización automática posterior (ver EARS-11)

**EARS-03.** Los contactos reutilizados NO se auto-asignan a ninguna influencia — todas nacen `contacto_ouv_id = NULL`.

**EARS-04.** El sistema DEBE emitir `ouv.creada_desde_sql` a `SoporteComercial` (típicamente invocado desde la txn de calificación tras completar EARS-01/02).

### 3.2 Creación directa — Vías 2/3/4 (EARS-05 a EARS-07)

**EARS-05.** `EjecutivoComercial` DEBE poder crear OUV directa vía `POST /discovery/ouvs` con: `titulo`, `empresa_nombre`, `segment_id` (o `segmento` legado), `vertical`, `descripcion`.

**EARS-06.** Al crear OUV directa: `origen_via = directa`, `sql_id_origen = NULL`, `comercial_id = actor`, 3 `ouv_influencias`, checklist UNIVERSO, consecutivo. `account_id` nullable (opcional en el alta). **NO se crean filas en `ouv_contactos`.**

**EARS-07.** Emitir `ouv.creada_directa` a `SoporteComercial`.

### 3.3 Gestión de contactos de OUV (EARS-08 a EARS-11) *(ajustados v1.3)*

**EARS-08** *(ajustado)*. El `EjecutivoComercial` dueño DEBE poder agregar un contacto vía `POST /discovery/ouvs/:id/contactos`, con payload `{ person_id }` o `{ person: {...} }` para crear un `person` nuevo en el acto (delega a `spec-gestion-cuentas.md`).

**EARS-08b** *(nuevo — paridad con demand-gen EARS-40/41 / DR accounts-por-lead)*. CUANDO se agrega un `person` a `ouv_contactos`:
- SI `ouvs.account_id` ya está informado, el sistema DEBE rechazar la operación SI `person.account_id` ≠ `ouvs.account_id`.
- SI `ouvs.account_id` es NULL (p. ej. OUV directa sin cuenta), al agregar el **primer** contacto el sistema DEBE setear `ouvs.account_id = person.account_id` (y PUEDE alinear `empresa_nombre` al `accounts.name` de esa cuenta). Contactos posteriores DEBEN cumplir la misma `account_id`.

**EARS-09** *(ajustado — ya no edita datos de la persona)*. El `EjecutivoComercial` dueño DEBE poder actualizar únicamente `notas` de una fila `ouv_contactos`. Editar nombre/email/teléfono/cargo de la persona **no se hace desde este panel** — va en `spec-gestion-cuentas.md`, porque el dato es compartido.

**EARS-10.** El `EjecutivoComercial` dueño DEBE poder eliminar (soft-delete) filas de `ouv_contactos` — elimina la **relación**, no el `person`. Si está referenciado por `ouv_influencias`, setear `contacto_ouv_id = NULL` ahí y registrar en `audit_log`.

**EARS-11.** Los contactos de OUV NO se sincronizan automáticamente con los del lead tras la conversión.

### 3.4 Avance de zona (EARS-12 a EARS-15)
Sin cambios respecto a v1.2.

**EARS-12.** Solicitar avance vía `POST /discovery/ouvs/:id/avanzar`.

**EARS-13.** Guards por zona destino:

| Zona destino | Guards |
|---|---|
| ENCIMA_FUNNEL | `guardEntidadEnEstado('OUV','UNIVERSO')` + `guardPresupuestoConfirmado` |
| EN_FUNNEL | `guardEntidadEnEstado('OUV','ENCIMA_FUNNEL')` + `guard2InfluenciasEnVerde` |
| MAYOR_PROBABILIDAD | `guardEntidadEnEstado('OUV','EN_FUNNEL')` + `guard2InfluenciasEnVerde` |

**EARS-14.** Guard rechazado → `WorkflowGuardRejectedException` HTTP 422.

**EARS-15.** Aprobado → actualizar `zona_actual`, sembrar checklist, emitir `ouv.avance_zona`, `audit_log`.

### 3.5 Retroceso de zona (EARS-16 a EARS-18)
Sin cambios. Retroceder vía `POST /discovery/ouvs/:id/retroceder` con `motivo` obligatorio; no se permite desde UNIVERSO (usar Descartada).

### 3.6 Gestión de influencias (EARS-19 a EARS-21)
Sin cambios. Actualizar `estado`/`contacto_ouv_id`/`motivo_estado`/`notas`; `contacto_ouv_id` debe pertenecer a la misma OUV; dispara `ouv.influencia_cambio`.

### 3.7 Checklist de zona (EARS-22 a EARS-24)
Sin cambios.

### 3.8 Presupuesto (EARS-25 a EARS-26)
Sin cambios.

### 3.9 Alerta de gap (EARS-27 a EARS-29)
Sin cambios.

### 3.10 Cierre (EARS-30 a EARS-34)
Sin cambios. Ganada (`MAYOR_PROBABILIDAD` estricto), Perdida (motivo+monto obligatorios), Descartada (motivo obligatorio); solo Ganada emite `ouv.lista_para_implementacion`.

### 3.11 Reapertura
Postergada a Wave 2.

---

## 4. Permisos CASL

| Acción | `EjecutivoComercial` (dueño) | `SoporteComercial` *(UI: “Profesional Soporte Comercial”)* | Otros |
|---|---|---|---|
| Ver OUV propia | ✅ | ✅ (todas) | ❌ |
| Crear OUV directa | ✅ | ❌ | ❌ |
| Actualizar contactos de OUV propia (solo `notas`) | ✅ | ❌ | ❌ |
| Actualizar influencias/checklist/presupuesto | ✅ (propias) | ❌ | ❌ |
| Avance/retroceso de zona | ✅ (propias) | ❌ | ❌ |
| Cerrar Ganada/Perdida/Descartada | ✅ (propias) | ❌ | ❌ |
| CRUD `motivos_perdida`/`motivos_descarte` | ❌ | ✅ | ❌ |
| CRUD `zona_checklist_templates` | ❌ | ✅ | ❌ |

---

## 5. Guards nuevos del motor
Sin cambios: `guardPresupuestoConfirmado`, `guard2InfluenciasEnVerde`, `guardUsuarioEsComercialDelOUV`.

## 6. Eventos nuevos del motor
Sin cambios respecto a v1.2 (lista completa en la versión original).

---

## 7. Componentes NestJS

### 7.1 `OUVService`
Sin cambios.

### 7.2 `OUVContactosService` *(ajustado v1.3/v1.4)*
- `reutilizarDesdeLead(ouvId, leadId, transaction)` *(renombrado de `crearDesdeLead` — ya no copia, reutiliza `person_id`)* — **API pública** exportada por el módulo discovery para que calificación la invoque dentro de su txn (EARS-02)
- `crear(ouvId, dto, actorUserId)` — `dto` acepta `{ person_id }` o `{ person: {...} }`; aplica EARS-08b
- `actualizarNotas(contactoOuvId, notas, actorUserId)` *(renombrado de `actualizar` — solo `notas`)*
- `eliminar(contactoOuvId, actorUserId)` — soft-delete + limpieza FK
- `listByOuv(ouvId)` — join a `people` para el response

### 7.3–7.6
Sin cambios respecto a v1.1/v1.2.

---

## 8. UX / Pantallas

Sin cambios estructurales salvo:

### 8.3 OUV — Detalle
Panel de contactos: lista `ouv_contactos` (join a `people`), acciones agregar/eliminar y editar `notas` únicamente.

### 8.5 Modal "Agregar contacto" *(ajustado v1.3)*
Selector de `person` existente (busca por nombre/email) o formulario para crear uno nuevo (nombre, cargo, email, teléfono + selección/creación de `account`) — delega a `spec-gestion-cuentas.md`. `notas` local siempre editable aquí.

Resto de pantallas (8.1, 8.2, 8.4, 8.6–8.9): sin cambios.

---

## 9. Consumo del motor de workflow
Sin cambios — todo pasa por `WorkflowEngineService.transition()`.

---

## 10. Fuera de alcance (Wave 2 o después)

- Override de Ganada
- Reapertura de OUV cerrada
- KPI snapshots mensuales
- Vista de seguimiento para Marketing
- ~~Modelo unificado de contactos Lead↔OUV↔Cuenta (Módulo 12)~~ — **removido v1.3, ya no aplica (movido a Wave 1)**
- Tabla `ouv_actividades` formal
- Editor visual de reglas del motor
- Notificaciones por email/SMS
- Influencias adicionales más allá de las 3 fijas
- Segmentación de reglas por segmento
- Filtros avanzados en bandeja
- Predicción de cierre basada en histórico
- Catálogo administrable de verticales
- Jerarquía de cuentas padre/hijas, indicadores de salud (resto de Módulo 12, ver `spec-gestion-cuentas.md` §6)

---

## Checklist clarify

- [x] Frontera Vía 1: calificación orquesta; discovery = schema + servicios (1A)
- [x] `empresa_nombre` Vía 1 desde `accounts.name` (2A)
- [x] EARS-08b un account por OUV (3A)
- [x] Roles PascalCase en EARS/CASL (4A)
- [x] Migración ALTER + truncate defensivo (5A)
