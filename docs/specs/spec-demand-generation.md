# spec-demand-generation.md
**Módulo:** Fase 1 — Generación de Demanda (TOFU → MOFU → BOFU)
**Versión:** 2.5 — analyze 2026-08-10 (DG-19 refs; `ProductManager` / `SoporteComercial` canónicos)
**Fecha:** 2026-08-10
**Estado:** Aprobado — 2026-08-10 (arquitecto); parche analyze 2026-08-10
**Decisiones de alcance confirmadas por Evilio:**
- Calificación: **híbrido** — checklist cualitativo ahora (v1), motor de scoring numérico (demográfico + comportamental, Blueprint V2 §4.1-4.3) queda en **Wave 2**.
- Campañas (creación, import CSV, presupuesto/CPL): **incluidas** en este módulo.
- Pendiente de validar en **taller T1** (Scoring + criterios OUV): la redacción exacta de los ítems del checklist y si son 3 o 4.

**Changelog v2.4 → v2.5 (speckit-analyze):**
- DG-19 referencia EARS-37…42 (contactos/`person_id`), no EARS-30/31.
- `Role.name = ProductManager` (PascalCase); UI label “Product Manager”.
- `SoporteComercial` canónico en EARS/actores; “Profesional Soporte Comercial” solo label UI.

**Changelog v2.3 → v2.4 (speckit-clarify):**
- Estado canónico **`MQL_PENDING`** (UI “BOFU”); DR lead-directo alineado al repo (Artículo II).
- `TraductorDeNegocio`: login + lectura de leads donde es `business_referrer_id` (EARS-33b).
- DG-08: duplicado CSV = email+NIT informados → rechazar fila.
- Sin migración histórica: truncate `lead_contacts` y `ouv_contactos` en dev/staging (EARS-43).

**Changelog v2.2 → v2.3:**
- Nuevos actores: `ProductManager` / `EjecutivoComercial` rutas directas; `business_referrer_id`; `segment_id`/`subsegment_id`; `lead_contacts.person_id`; `sqls.origen_creacion`; EARS-29 mql automático.
- Decision records: product-manager, lead-directo-sql, unificacion-contactos-cuentas-wave1, subsegmentos, rol-traductor-negocio, convencion-nombres-ingles, accounts-por-lead.

---

## 1. Alcance y límites del módulo

**Incluye:**
- Captura de leads multicanal (Inbound, Outbound, Aliado/Canal, Fábrica, Referido, SECOP/Licitación)
- Creación directa de leads por `ProductManager` y `EjecutivoComercial` (nuevo en v2.3)
- Gestión de campañas (creación, import CSV masivo, presupuesto, CPL)
- Registro de interacciones (email, llamada, reunión, webinar, descarga, visita web)
- Checklist de calificación cualitativa (reemplaza scoring numérico en v1)
- Máquina de estados TOFU → MOFU → BOFU (MQL_PENDING) → SQL, con rutas directas nuevas
- Aprobación de MQL por Director de Mercadeo
- Entrega del lead calificado (SQL) a la bandeja comercial
- Administración de empresas/contactos vía `accounts`/`people` (consumido desde este módulo, administrado en `spec-gestion-cuentas.md`)

**NO incluye (pertenece a Fase 2 — Calificación, módulo separado):**
- Creación de OUV
- Checklist Strategic Selling (Universo / Encima del Funnel / En Funnel / Mayor Probabilidad)
- Gestión de la bandeja SQL una vez asignada al comercial (contacto, conversión a OUV)

**Diferido a Wave 2:**
- Motor de scoring demográfico + comportamental con decaimiento temporal
- Secuencias de nurturing automatizadas (drip campaigns)
- Recomendación de "próxima mejor acción" basada en histórico
- Jerarquía de cuentas padre/hijas, indicadores de salud de cuenta (ver `spec-gestion-cuentas.md` §6)

---

## 2. Actores

| Actor | Responsabilidad en este módulo |
|---|---|
| Director de Mercadeo | Crea/aprueba campañas, revisa y aprueba/rechaza MQL, ve KPIs |
| Gestor de Mercadeo | Captura y gestiona leads, registra interacciones, aplica checklist, transiciona TOFU→MOFU→BOFU |
| **SoporteComercial** *(UI: “Profesional Soporte Comercial”)* | Registra citas del canal `GENERACION_DEMANDA_AGENCIA` y recibe el SQL en bandeja comercial |
| **ProductManager** *(nuevo v2.3; UI: “Product Manager”)* | Crea leads manualmente con checklist ya diligenciado; nacen directo en BOFU (`MQL_PENDING`), canal limitado a `BTL`/`FABRICA` |
| **EjecutivoComercial (KAM)** *(nuevo v2.3, solo esta ruta)* | Crea leads manualmente con checklist ya diligenciado; nacen directo en `SQL`, auto-asignados a sí mismo. Canal `BTL`/`FABRICA`/`TRADUCTOR_NEGOCIO` |
| **TraductorDeNegocio** *(v2.4)* | Seleccionable en `business_referrer_id`. Login + solo lectura de leads donde es el referente. Sin create/update de leads ni campañas |

---

## 3. Entidades de datos (v1 — sin campos de scoring numérico activos)

### 3.1 `leads`
| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| lead_id | UUID | Sí | PK |
| tipo_lead | ENUM | Sí | Inbound\|Outbound\|Referido\|Aliado\|Licitacion |
| origen | ENUM | Sí | Web\|Email\|LinkedIn\|Evento\|SECOP\|Aliado\|Otro |
| canal_origen | ENUM | Sí | CAMPANA_DIGITAL\|BTL\|FABRICA\|GENERACION_DEMANDA_AGENCIA\|TRADUCTOR_NEGOCIO. Requerido al crear e inmutable después de la creación |
| sub_origen | VARCHAR(80) | No | LP específica, UTM_source |
| campana_id | UUID | No | FK campaigns |
| estado | ENUM | Sí | Nuevo\|TOFU\|MOFU\|MQL_PENDING\|SQL\|Reciclaje\|Descartado |
| segmento | ENUM | Sí | Gobierno\|D&S\|PymesEspeciales\|B2B — **legado, coexiste con `segment_id` hasta migración** |
| **segment_id** *(nuevo v2.3)* | UUID | No* | FK `segments.id`. *Obligatorio a futuro, opcional durante coexistencia con `segmento` |
| **subsegment_id** *(nuevo v2.3)* | UUID | No | FK `subsegments.id`, opcional, debe pertenecer al mismo `segment_id` |
| industria | VARCHAR(80) | Condicional | Obligatorio si segmento=B2B |
| region | VARCHAR(60) | Sí | |
| responsable_id | UUID | Sí | FK users (Gestor de Mercadeo asignado, o el propio creador en rutas directas) |
| cita_agendada | BOOLEAN | Sí | default false. Solo relevante para `canal_origen=GENERACION_DEMANDA_AGENCIA` |
| fecha_cita | DATE | No | Solo relevante para `canal_origen=GENERACION_DEMANDA_AGENCIA` |
| comercial_asignado_id | UUID | No | FK users. Solo relevante para `canal_origen=GENERACION_DEMANDA_AGENCIA` |
| **business_referrer_id** *(nuevo v2.3)* | UUID | Condicional | FK `users.user_id`, filtrado a rol `TraductorDeNegocio`. **Obligatorio y visible únicamente si `canal_origen = TRADUCTOR_NEGOCIO`**; oculto y `null` en cualquier otro caso |
| motivo_descarte | TEXT | Condicional | Obligatorio si estado=Descartado |
| fecha_captura | TIMESTAMPTZ | Sí | default now() |
| fecha_ultima_interaccion | TIMESTAMPTZ | No | trigger on interaction |
| created_at / updated_at | TIMESTAMPTZ | Sí | |

> Campos `icp_score`, `lead_score`, `mql_score`, `sql_score` del Blueprint V2 **se dejan modelados pero inactivos** (nullable, sin motor que los calcule) para no romper el esquema cuando se active Wave 2.
>
> **Nota v2.3:** los campos `empresa_nombre`, `contacto_nombre`, `cargo`, `email`, `telefono` que existían aquí como "copia temporal del contacto principal" se **eliminan** — ahora se resuelven vía `lead_contacts.person_id` → `people` (ver 3.2).

### 3.2 `lead_contacts` *(reestructurada v2.3 — antes tenía columnas denormalizadas)*
Cada lead tiene entre 1 y 3 contactos. La posición 1 identifica el contacto principal.

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| contact_id | UUID | Sí | PK |
| lead_id | UUID | Sí | FK leads |
| position | TINYINT | Sí | 1..3, único por lead |
| **person_id** *(nuevo v2.3)* | UUID | Sí | FK `people.person_id` (tabla nueva, ver `spec-gestion-cuentas.md`) |
| created_at / updated_at | TIMESTAMPTZ | Sí | |

> Los campos `empresa_nombre`, `nombre`, `cargo`, `email`, `telefono` que existían aquí se **eliminan** — ahora viven en `people` (y `accounts` para la empresa), consumidos vía `person_id`. Ver `2026-08-DR-unificacion-contactos-cuentas-wave1.md`.

### 3.3 `lead_checklist` (nuevo — reemplaza el scoring en v1)
Sin cambios respecto a v2.2.

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| checklist_id | UUID | Sí | PK |
| lead_id | UUID | Sí | FK leads |
| criterio_sector_objetivo | BOOLEAN | Sí | ¿Pertenece a sector/industria del grupo objetivo? |
| criterio_necesidad_portafolio | BOOLEAN | Sí | ¿Necesidad alineada al portafolio Frisson/Verytel? |
| criterio_acceso_decisor | BOOLEAN | Sí | ¿Se habla con decisor o influencia que lleva al decisor? |
| criterio_presupuesto_indicios | BOOLEAN | Sí | ¿Hay indicios de presupuesto o capacidad de inversión? |
| completado_por | UUID | Sí | FK users |
| fecha_completado | TIMESTAMPTZ | Sí | |
| resultado | ENUM (calculado) | Sí | Calificado si los 4 = true, No Calificado en otro caso |

*Los 4 criterios son mi propuesta de armonización entre "4 FILTROS MARKETING" del Excel y los 3 filtros documentados en Filtros Embudo Comercial v5 — **queda pendiente de confirmar redacción exacta en T1**.*

### 3.4 `campaigns`
Sin cambios respecto a v2.2. Igual al Blueprint V2 §2.2.

### 3.5 `interactions`
Sin cambios respecto a v2.2.

### 3.6 `mqls` (simplificado v1)
Sin cambios respecto a v2.2.

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| mql_id | UUID | Sí | PK |
| lead_id | UUID | Sí | FK leads, UNIQUE |
| checklist_id | UUID | Condicional | FK lead_checklist (evidencia de calificación). Nullable cuando el gate es una cita agendada de `GENERACION_DEMANDA_AGENCIA` |
| calificado_por | UUID | Sí | FK users |
| fecha_calificacion | TIMESTAMPTZ | Sí | |
| motivo_calificacion | TEXT | No | |
| estado | ENUM | Sí | Activo\|ConvertidoSQL\|Devuelto\|Descartado |

### 3.7 `sqls` (solo creación/handoff — gestión es de otro módulo) *(actualizada v2.3)*

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| sql_id | UUID | Sí | PK |
| mql_id | UUID | Sí | FK mqls, UNIQUE. Ruta EjecutivoComercial: se satisface con `mql` automático (EARS-29) |
| en_backlog | BOOLEAN | Sí | default true al crearse. **Ruta EjecutivoComercial: `false`** (ya está trabajado, no entra a backlog) |
| comercial_asignado_id | UUID | No | Asignado por Soporte Comercial (fuera de este módulo), **o el propio KAM en la Ruta EjecutivoComercial** |
| **origen_creacion** *(nuevo v2.3)* | ENUM | Sí | `enrutamiento_normal`\|`directo_comercial` — default `enrutamiento_normal`. Necesario para no distorsionar KPIs (ver `spec-calificacion.md` addendum) |
| fecha_creacion | TIMESTAMPTZ | Sí | |

---

## 4. Máquina de estados

Sin cambios respecto a v2.2 para el flujo estándar. Ver sección 4.1 para las dos rutas directas nuevas.

| Entidad | Origen | Destino | Condición / Evento |
|---|---|---|---|
| LEAD | — | Nuevo | Lead capturado (form web, import CSV, registro manual, integración aliado/fábrica) |
| LEAD | Nuevo | TOFU | Automático al registrar, con campaña o fuente asociada |
| LEAD | TOFU | MOFU | Gestor de Mercadeo registra ≥1 interacción **y** clasifica segmento/industria/línea de negocio |
| LEAD | MOFU | MQL_PENDING (BOFU) | Gestor de Mercadeo completa `lead_checklist` con los 4 criterios = true |
| LEAD | MQL_PENDING | SQL | Director de Mercadeo aprueba el MQL |
| LEAD | MQL_PENDING | Reciclaje | Director rechaza (motivo obligatorio) → vuelve a MOFU para seguir nutriendo |
| LEAD | MOFU / MQL_PENDING | Descartado | No cumple checklist de forma irreversible o desinterés explícito del prospecto (motivo obligatorio) |
| LEAD | Descartado | MOFU | Reciclaje futuro manual (nueva interacción detectada) |
| **LEAD** *(nuevo v2.3)* | **—** | **MQL_PENDING** | **`ProductManager` crea el lead con checklist ya diligenciado — salta Nuevo/TOFU/MOFU** |
| **LEAD** *(nuevo v2.3)* | **—** | **SQL** | **EjecutivoComercial crea el lead con checklist ya diligenciado — salta Nuevo/TOFU/MOFU/MQL_PENDING** |

### 4.1 Reglas de flujo por canal *(actualizada v2.3 — resuelve TRADUCTOR_NEGOCIO)*

| canal_origen | estado_entrada | estados_aplicables (orden) | transición especial |
|---|---|---|---|
| CAMPANA_DIGITAL | TOFU | TOFU → MOFU → BOFU → SQL | Ninguna (checklist estándar) |
| BTL | TOFU | TOFU → MOFU → BOFU → SQL | Ninguna (checklist estándar). **Excepción:** si lo crea `ProductManager` o `EjecutivoComercial`, aplica su ruta directa (ver abajo) |
| FABRICA | TOFU | TOFU → BOFU → SQL | Omite MOFU. **Excepción:** igual que BTL, ruta directa si aplica |
| GENERACION_DEMANDA_AGENCIA | MOFU | MOFU → BOFU → SQL | MOFU → BOFU por evento manual (`cita_agendada=true`), no por checklist |
| **TRADUCTOR_NEGOCIO** *(resuelto v2.3)* | **SQL** | **SQL directo** | **Solo puede originarse por la ruta EjecutivoComercial (nunca por captura estándar) — ver sección 5. Ya no es TBD.** |
| — Ruta `ProductManager` (BTL/FABRICA) | MQL_PENDING | MQL_PENDING → SQL (enrutamiento normal) | Checklist ya viene diligenciado al crear |
| — Ruta EjecutivoComercial (BTL/FABRICA/TRADUCTOR_NEGOCIO) | SQL | SQL (ya resuelto, sin enrutamiento) | Checklist ya viene diligenciado al crear; auto-asignado |

> En esta tabla, BOFU corresponde al estado persistido `MQL_PENDING`.

---

## 5. Requisitos funcionales (EARS)

**Ubicuos**
- DG-01: El sistema SIEMPRE debe registrar `created_by`, `created_at` y `updated_at` en cada lead.
- DG-02: El sistema SIEMPRE debe calcular `cpl = gasto_real / leads_generados` para cada campaña activa.

**Basados en evento**
- DG-03: CUANDO se registra un lead vía formulario web, import CSV o integración de aliado, el sistema DEBE crearlo en estado `Nuevo` y transicionarlo automáticamente a `TOFU`.
- DG-04: CUANDO el Gestor de Mercadeo registra una interacción, el sistema DEBE actualizar `fecha_ultima_interaccion` del lead asociado.
- DG-05: CUANDO se completa el `lead_checklist` con los 4 criterios en `true`, el sistema DEBE transicionar el lead a `MQL_PENDING` y crear el registro `mqls` en estado `Activo`, notificando al Director de Mercadeo.
- DG-06: CUANDO el Director de Mercadeo aprueba un MQL, el sistema DEBE crear el registro `sqls` con `en_backlog = true`, `origen_creacion = enrutamiento_normal`, actualizar `lead.estado = SQL`, y notificar a Soporte Comercial.
- DG-07: CUANDO el Director de Mercadeo rechaza un MQL, el sistema DEBE exigir motivo, actualizar `lead.estado = Reciclaje` y notificar al Gestor de Mercadeo responsable.
- DG-08: CUANDO se importa un CSV de campaña outbound, el sistema DEBE validar duplicados antes de crear cada fila: si vienen informados email (contacto/`people`) y NIT (`accounts.tax_id`) y ya existe un lead activo con ese mismo par vía `lead_contacts` → `people` → `accounts`, ENTONCES **rechaza esa fila** y continúa con el resto del lote. Si email o NIT vienen vacíos, ese eje no participa del match.

**Basados en estado**
- DG-09: MIENTRAS un lead esté en estado `MOFU`, el sistema DEBE permitirle al Gestor de Mercadeo editar el checklist de calificación.
- DG-10: MIENTRAS un lead esté en `MQL_PENDING`, el sistema NO DEBE permitir su edición por el Gestor de Mercadeo (solo lectura, pendiente de decisión del Director).
- DG-11: MIENTRAS una campaña esté en estado `Finalizada` o `Cancelada`, el sistema NO DEBE permitir asociarle nuevos leads.

**Comportamiento no deseado**
- DG-12: SI se intenta transicionar un lead de `TOFU` a `MOFU` sin al menos 1 interacción registrada, ENTONCES el sistema DEBE rechazar la transición y mostrar el criterio faltante.
- DG-13: SI se intenta completar el checklist sin los 4 criterios evaluados, ENTONCES el sistema DEBE bloquear el paso a `MQL_PENDING`.
- DG-14: SI se marca un lead como `Descartado`, ENTONCES el sistema DEBE exigir `motivo_descarte` como campo obligatorio.
- DG-15: SI se intenta crear una campaña con `fecha_fin` anterior o igual a `fecha_inicio`, ENTONCES el sistema DEBE rechazar el registro.

**Opcionales**
- DG-16: DONDE el lead provenga de un canal `SECOP` o `Licitacion`, el sistema PUEDE saltar la etapa de nutrición y sugerir calificación directa.
- DG-17: DONDE el usuario tenga rol Director de Mercadeo, el sistema PUEDE mostrarle un panel de configuración de los criterios del checklist (para cuando se confirmen en T1).
- DG-18: DONDE se active Wave 2, el sistema PUEDE reemplazar el gate por checklist con el motor de scoring numérico sin migración de esquema (campos ya modelados).
- DG-19: CUANDO se crea un lead, el sistema DEBE exigir entre 1 y 3 contactos y cada contacto DEBE resolver a un `person_id` válido (ver EARS-37…42).
- DG-20: SI se intenta crear o actualizar un lead con cero contactos o más de tres, ENTONCES el sistema DEBE rechazar la operación sin guardar cambios parciales.
- DG-21: CUANDO se crea un lead con varios contactos, el sistema DEBE identificar al contacto en posición 1 como principal.
- DG-22: CUANDO se crea, actualiza o elimina un contacto de un lead, el sistema DEBE registrar el cambio en auditoría.

**Reglas por canal de origen**
- EARS-19: CUANDO se crea un lead con `canal_origen=FABRICA` (captura estándar, no ruta directa), el sistema DEBERÁ asignar `estado_inicial=TOFU` y omitir la transición a MOFU.
- EARS-20: CUANDO se crea un lead con `canal_origen=GENERACION_DEMANDA_AGENCIA`, el sistema DEBERÁ asignar `estado_inicial=MOFU` sin pasar por TOFU.
- EARS-21: CUANDO un usuario con rol `SoporteComercial` registra `cita_agendada=true` sobre un lead en MOFU con `canal_origen=GENERACION_DEMANDA_AGENCIA`, el sistema DEBERÁ transicionar el lead a BOFU (`MQL_PENDING`), crear un MQL activo sin `checklist_id` y notificar a `comercial_asignado_id`.
- EARS-22: SI un lead tiene `canal_origen=FABRICA` o `canal_origen=GENERACION_DEMANDA_AGENCIA`, ENTONCES el Kanban DEBERÁ ocultar o atenuar visualmente las columnas no aplicables.
- EARS-23: CUANDO se filtra el Kanban o la Lista por un `canal_origen` específico, el sistema DEBERÁ mostrar únicamente los leads de ese canal y ajustar las columnas visibles.

**Ruta directa — ProductManager** *(nuevo v2.3; UI: “Product Manager”)*
- EARS-24: CUANDO un usuario con rol `ProductManager` selecciona "Nuevo Lead", el sistema DEBE permitir la creación manual, limitando `canal_origen` a `BTL` o `FABRICA`.
- EARS-25: CUANDO un `ProductManager` crea un lead, el sistema DEBE requerir `lead_checklist` completo (los 4 criterios) en el mismo acto de creación.
- EARS-26: CUANDO se guarda un lead creado por `ProductManager` con checklist completo, el sistema DEBE transicionarlo directamente a `estado = MQL_PENDING` (equivalente a DG-05 en el momento de creación) y crear `mqls` en `estado = Activo`, notificando al Director de Mercadeo. A partir de aquí sigue el flujo normal (DG-06/DG-07).

**Ruta directa — EjecutivoComercial** *(nuevo v2.3)*
- EARS-27: CUANDO un usuario con rol `EjecutivoComercial` selecciona "Nuevo Lead", el sistema DEBE permitir la creación manual, limitando `canal_origen` a `BTL`, `FABRICA` o `TRADUCTOR_NEGOCIO`.
- EARS-28: CUANDO un `EjecutivoComercial` crea un lead, el sistema DEBE requerir `lead_checklist` completo en el mismo acto de creación.
- ✅ **EARS-29 (resuelto 2026-08-10, ver `2026-08-DR-lead-directo-sql.md` adenda):** CUANDO se guarda un lead creado por `EjecutivoComercial` con checklist completo, el sistema DEBE: crear un `mql` automático (`estado = ConvertidoSQL`, `calificado_por` = el mismo KAM, `motivo_calificacion = "Auto-calificado — creación directa comercial"`, `checklist_id` = el `lead_checklist` diligenciado); transicionar `lead.estado = SQL`; crear el `sql` sobre ese `mql_id`, con `en_backlog = false`, `comercial_asignado_id` = el mismo KAM, `origen_creacion = directo_comercial`. No se modifica el schema existente de `sqls.mql_id` (sigue obligatorio).
- EARS-30: El lead/SQL creado por la ruta `EjecutivoComercial` DEBE ser visible de inmediato en la bandeja del KAM (detalle de esa bandeja vive en `spec-calificacion.md`).

**Campo condicional — Traductor de Negocio** *(nuevo v2.3)*
- EARS-31: El sistema DEBE mostrar el campo `business_referrer_id` únicamente cuando `canal_origen = TRADUCTOR_NEGOCIO`.
- EARS-32: CUANDO `canal_origen = TRADUCTOR_NEGOCIO`, el sistema DEBE requerir `business_referrer_id` antes de permitir guardar. El selector DEBE listar únicamente usuarios activos con rol `TraductorDeNegocio`.
- EARS-33: CUANDO `canal_origen` sea distinto de `TRADUCTOR_NEGOCIO`, el sistema DEBE ocultar el campo y no incluir `business_referrer_id` en el payload.
- EARS-33b *(nuevo v2.4)*: CUANDO un usuario con rol `TraductorDeNegocio` autenticado lista o abre leads, el sistema DEBE mostrar **solo lectura** de los leads donde `business_referrer_id` = su `user_id`. El sistema NO DEBE permitirle crear ni editar leads ni campañas.

**Segmentación (`segments`/`subsegments`)** *(nuevo v2.3)*
- EARS-34: El sistema DEBE permitir seleccionar `segment_id` (FK a `segments`) en el lead, coexistiendo con el campo legado `segmento` hasta que se ejecute la migración.
- EARS-35: El sistema DEBE permitir, opcionalmente, `subsegment_id` una vez elegido `segment_id`, validando que pertenezca al mismo segmento.
- EARS-36: SI `segment_id` no tiene `subsegments` activos, ENTONCES el sistema DEBE ocultar o deshabilitar el campo.

**Contactos vía `people`/`accounts`** *(nuevo v2.3, reemplaza el modelo denormalizado)*
- EARS-37: CUANDO se registra un contacto de lead, el sistema DEBE crear o reutilizar un registro en `people` y asociarlo vía `lead_contacts.person_id`.
- EARS-38: CUANDO se selecciona o registra la empresa del lead, el sistema DEBE crear o reutilizar un registro en `accounts`. Cualquier rol autenticado puede crear una `account` nueva desde este flujo.
- EARS-39: El sistema NO DEBE permitir asociar un `person` a un lead si ese `person` no tiene `account_id` asignado.
- EARS-40 *(nuevo, resuelve ambigüedad — ver `2026-08-DR-accounts-por-lead.md`)*: CUANDO se agrega un `person` a `lead_contacts` de un lead que ya tiene al menos un contacto, el sistema DEBE validar que `person.account_id` coincida con el `account_id` de los contactos ya asociados a ese lead.
- EARS-41: SI el `account_id` no coincide, ENTONCES el sistema DEBE rechazar la operación y mostrar mensaje indicando la empresa ya asociada al lead.
- EARS-42: El `account_id` del contacto en `position = 1` (principal) DEBE considerarse la `account` del lead para cualquier herencia posterior (ej. `spec-ouv-funnel.md` EARS-01).
- EARS-43 *(nuevo v2.4)*: Antes de aplicar el cambio de esquema que introduce `person_id` (y elimina columnas denormalizadas), en ambientes sin datos productivos (dev/staging) se DEBE **truncar** `lead_contacts` y `ouv_contactos`. **No** se implementa script de migración ni deduplicación de empresas históricas (`2026-08-DR-unificacion-contactos-cuentas-wave1.md` adenda).

---

## 6. Pantallas mínimas (v1)

**Director de Mercadeo**
- Módulo Campañas: crear / listar / importar CSV
- Dashboard Marketing: KPIs (Leads/mes, % leads calificados, CPL, MQLs pendientes)
- Bandeja MQL: aprobar / rechazar con motivo

**Gestor de Mercadeo**
- Leads / Lista y Kanban (filtros: canal de origen, estado, segmento, campaña, responsable)
- Lead / Detalle: datos, ruta esperada por canal, checklist de calificación, timeline de interacciones
- Registrar interacción (modal rápido)

**SoporteComercial** *(UI: “Profesional Soporte Comercial”)*
- Bandeja de Agenda: leads `GENERACION_DEMANDA_AGENCIA` en MOFU, registro de cita y asignación de comercial

**ProductManager** *(nuevo v2.3; UI: “Product Manager”)*
- Modal "Nuevo Lead" simplificado: checklist + datos básicos, sin las pantallas de Kanban/nutrición

**EjecutivoComercial** *(nuevo v2.3, solo para esta ruta)*
- Modal "Nuevo Lead directo" — mismo patrón; al guardar redirige a la bandeja SQL propia (`spec-calificacion.md`)

**TraductorDeNegocio** *(nuevo v2.4)*
- Vista de solo lectura de “Mis leads referidos” (filtro `business_referrer_id = me`); sin acciones de create/update

---

## 7. KPIs del módulo

Sin cambios respecto a v2.2. Ver `spec-calificacion.md` addendum para el ajuste pendiente de `MQL Rate`/`SQL Rate` por `origen_creacion`.

---

## 8. Abierto para taller T1

1. Confirmar si el checklist es de 3 o 4 criterios y su redacción exacta.
2. Confirmar si SECOP/Licitación realmente salta nutrición o solo acelera el checklist.
3. Confirmar catálogo de campos de `campaigns` con Director de Mercadeo.
4. ~~Definir el flujo de `TRADUCTOR_NEGOCIO`~~ — **Resuelto en v2.3/v2.4**.
5. ~~Resolver el hallazgo de `sqls.mql_id` obligatorio vs. Ruta EjecutivoComercial~~ — **Resuelto** (EARS-29).
6. ~~Alcance de permisos del rol `TraductorDeNegocio`~~ — **Resuelto v2.4** (EARS-33b).
7. ~~Criterio de migración de `lead_contacts` existentes~~ — **Resuelto v2.4** (EARS-43: truncate, sin script histórico).

---

## Checklist clarify

- [x] `MQL_PENDING` canónico (vs Blueprint `MQL`)
- [x] Alcance `TraductorDeNegocio`
- [x] DG-08 dedup CSV con people/accounts
- [x] Truncate vs migración histórica
- [x] Aprobación explícita del arquitecto (2026-08-10)
