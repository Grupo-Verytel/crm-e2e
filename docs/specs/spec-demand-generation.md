# spec-demand-generation.md
**Módulo:** Fase 1 — Generación de Demanda (TOFU → MOFU → BOFU)
**Versión:** 2.0 — reemplaza la versión anterior (sin scoring, sin campañas)
**Fecha:** 2026-07-03
**Decisiones de alcance confirmadas por Evilio:**
- Calificación: **híbrido** — checklist cualitativo ahora (v1), motor de scoring numérico (demográfico + comportamental, Blueprint V2 §4.1-4.3) queda en **Wave 2**.
- Campañas (creación, import CSV, presupuesto/CPL): **incluidas** en este módulo.
- Pendiente de validar en **taller T1** (Scoring + criterios OUV): la redacción exacta de los ítems del checklist y si son 3 o 4.

---

## 1. Alcance y límites del módulo

**Incluye:**
- Captura de leads multicanal (Inbound, Outbound, Aliado/Canal, Fábrica, Referido, SECOP/Licitación)
- Gestión de campañas (creación, import CSV masivo, presupuesto, CPL)
- Registro de interacciones (email, llamada, reunión, webinar, descarga, visita web)
- Checklist de calificación cualitativa (reemplaza scoring numérico en v1)
- Máquina de estados TOFU → MOFU → BOFU (MQL_PENDING) → SQL
- Aprobación de MQL por Director de Mercadeo
- Entrega del lead calificado (SQL) a la bandeja comercial

**NO incluye (pertenece a Fase 2 — Calificación, módulo separado):**
- Creación de OUV
- Checklist Strategic Selling (Universo / Encima del Funnel / En Funnel / Mayor Probabilidad)
- Gestión de la bandeja SQL una vez asignada al comercial (contacto, conversión a OUV)

**Diferido a Wave 2:**
- Motor de scoring demográfico + comportamental con decaimiento temporal
- Secuencias de nurturing automatizadas (drip campaigns)
- Recomendación de "próxima mejor acción" basada en histórico

---

## 2. Actores

| Actor | Responsabilidad en este módulo |
|---|---|
| Director de Mercadeo | Crea/aprueba campañas, revisa y aprueba/rechaza MQL, ve KPIs |
| Gestor de Mercadeo | Captura y gestiona leads, registra interacciones, aplica checklist, transiciona TOFU→MOFU→BOFU |
| Profesional Soporte Comercial | Recibe el SQL en bandeja comercial (fuera de alcance su gestión, solo el evento de entrada) |

---

## 3. Entidades de datos (v1 — sin campos de scoring numérico activos)

### 3.1 `leads`
| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| lead_id | UUID | Sí | PK |
| tipo_lead | ENUM | Sí | Inbound\|Outbound\|Referido\|Aliado\|Licitacion |
| origen | ENUM | Sí | Web\|Email\|LinkedIn\|Evento\|SECOP\|Aliado\|Otro |
| sub_origen | VARCHAR(80) | No | LP específica, UTM_source |
| campana_id | UUID | No | FK campaigns |
| estado | ENUM | Sí | Nuevo\|TOFU\|MOFU\|MQL_PENDING\|SQL\|Reciclaje\|Descartado |
| segmento | ENUM | Sí | Gobierno\|D&S\|PymesEspeciales\|B2B |
| industria | VARCHAR(80) | Condicional | Obligatorio si segmento=B2B |
| region | VARCHAR(60) | Sí | |
| empresa_nombre | VARCHAR(120) | Sí | |
| contacto_nombre | VARCHAR(120) | Sí | |
| cargo | VARCHAR(80) | No | |
| email | VARCHAR(180) | Sí | RFC 5321 |
| telefono | VARCHAR(20) | No | E.164 |
| responsable_id | UUID | Sí | FK users (Gestor de Mercadeo asignado) |
| motivo_descarte | TEXT | Condicional | Obligatorio si estado=Descartado |
| fecha_captura | TIMESTAMPTZ | Sí | default now() |
| fecha_ultima_interaccion | TIMESTAMPTZ | No | trigger on interaction |
| created_at / updated_at | TIMESTAMPTZ | Sí | |

> Campos `icp_score`, `lead_score`, `mql_score`, `sql_score` del Blueprint V2 **se dejan modelados pero inactivos** (nullable, sin motor que los calcule) para no romper el esquema cuando se active Wave 2.

### 3.2 `lead_checklist` (nuevo — reemplaza el scoring en v1)
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

### 3.3 `campaigns`
Igual al Blueprint V2 §2.2 (nombre, tipo, canal, objetivo, segmento_objetivo, fechas, presupuesto, gasto_real, estado, leads_generados, mqls_generados, sqls_generados, cpl — estos tres últimos calculados, no editables).

### 3.4 `interactions`
Igual al Blueprint V2 §2.3 (tipo, subtipo, canal, descripción, responsable, fecha, campana_id, resultado). Se elimina `puntos_scoring` de la lógica activa en v1 (columna se mantiene nullable para Wave 2).

### 3.5 `mqls` (simplificado v1)
| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| mql_id | UUID | Sí | PK |
| lead_id | UUID | Sí | FK leads, UNIQUE |
| checklist_id | UUID | Sí | FK lead_checklist (evidencia de calificación) |
| calificado_por | UUID | Sí | FK users |
| fecha_calificacion | TIMESTAMPTZ | Sí | |
| motivo_calificacion | TEXT | No | |
| estado | ENUM | Sí | Activo\|ConvertidoSQL\|Devuelto\|Descartado |

### 3.6 `sqls` (solo creación/handoff — gestión es de otro módulo)
| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| sql_id | UUID | Sí | PK |
| mql_id | UUID | Sí | FK mqls, UNIQUE |
| en_backlog | BOOLEAN | Sí | default true al crearse |
| comercial_asignado_id | UUID | No | Asignado por Soporte Comercial (fuera de este módulo) |
| fecha_creacion | TIMESTAMPTZ | Sí | |

---

## 4. Máquina de estados

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

---

## 5. Requisitos funcionales (EARS)

**Ubicuos**
- DG-01: El sistema SIEMPRE debe registrar `created_by`, `created_at` y `updated_at` en cada lead.
- DG-02: El sistema SIEMPRE debe calcular `cpl = gasto_real / leads_generados` para cada campaña activa.

**Basados en evento**
- DG-03: CUANDO se registra un lead vía formulario web, import CSV o integración de aliado, el sistema DEBE crearlo en estado `Nuevo` y transicionarlo automáticamente a `TOFU`.
- DG-04: CUANDO el Gestor de Mercadeo registra una interacción, el sistema DEBE actualizar `fecha_ultima_interaccion` del lead asociado.
- DG-05: CUANDO se completa el `lead_checklist` con los 4 criterios en `true`, el sistema DEBE transicionar el lead a `MQL_PENDING` y crear el registro `mqls` en estado `Activo`, notificando al Director de Mercadeo.
- DG-06: CUANDO el Director de Mercadeo aprueba un MQL, el sistema DEBE crear el registro `sqls` con `en_backlog = true`, actualizar `lead.estado = SQL`, y notificar a Soporte Comercial.
- DG-07: CUANDO el Director de Mercadeo rechaza un MQL, el sistema DEBE exigir motivo, actualizar `lead.estado = Reciclaje` y notificar al Gestor de Mercadeo responsable.
- DG-08: CUANDO se importa un CSV de campaña outbound, el sistema DEBE validar duplicados por email+NIT antes de crear los leads.

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
- DG-16: DONDE el lead provenga de un canal `SECOP` o `Licitacion`, el sistema PUEDE saltar la etapa de nutrición y sugerir calificación directa (alineado con la nota del BPMN: "prospectos de comercial pueden saltar la nutrición").
- DG-17: DONDE el usuario tenga rol Director de Mercadeo, el sistema PUEDE mostrarle un panel de configuración de los criterios del checklist (para cuando se confirmen en T1).
- DG-18: DONDE se active Wave 2, el sistema PUEDE reemplazar el gate por checklist con el motor de scoring numérico sin migración de esquema (campos ya modelados).

---

## 6. Pantallas mínimas (v1)

**Director de Mercadeo**
- Módulo Campañas: crear / listar / importar CSV
- Dashboard Marketing: KPIs (Leads/mes, % leads calificados, CPL, MQLs pendientes)
- Bandeja MQL: aprobar / rechazar con motivo

**Gestor de Mercadeo**
- Leads / Lista (filtros: estado, segmento, campaña, responsable)
- Lead / Detalle: datos, checklist de calificación, timeline de interacciones
- Registrar interacción (modal rápido)

---

## 7. KPIs del módulo

| KPI | Fórmula | Línea base real (Excel operativo) |
|---|---|---|
| Leads/mes × segmento | Conteo por segmento/mes | — |
| % leads calificados | leads con checklist=Calificado / total leads | ~42.7% histórico (35/82 tras primer filtro) |
| CPL | gasto_real / leads_generados | — |
| Tasa TOFU→MOFU | — | — |
| Tasa MOFU→SQL (handoff) | — | ~5.7% histórico llegó a cierre final (referencia de todo el embudo, no solo este módulo) |

---

## 8. Abierto para taller T1

1. Confirmar si el checklist es de 3 o 4 criterios y su redacción exacta.
2. Confirmar si SECOP/Licitación realmente salta nutrición o solo acelera el checklist.
3. Confirmar catálogo de campos de `campaigns` con Director de Mercadeo (¿falta algún tipo de campaña usado hoy, ej. BTL desayunos, co-creación con fábricas?).
