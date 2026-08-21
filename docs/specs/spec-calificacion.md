# Spec — Módulo 2: Calificación
**Versión:** 2.3 — clarify 2026-08-10
**Fecha:** 2026-08-10
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Aprobado
**Precede a:** `spec-ouv-funnel.md` v1.4
**Depende de:** `spec-workflow-engine.md` v1.1, Módulo 1 (Generación de Demanda) **v2.5**, `spec-gestion-cuentas.md` v0.4; **schema** `ouv_contactos.person_id` + `ouvs.account_id` vía implementación de `spec-ouv-funnel.md` (antes o en oleada coordinada previa a EARS-12)

**Changelog v2.2 → v2.3 (speckit-clarify):**
- Canónico `sqls.comercial_asignado_id` (no `comercial_id` de SQL).
- EARS-11 sin herencia de `empresa_nombre`; herencia solo en EARS-12 vía `accounts.name`.
- Roles PascalCase en EARS/CASL (`SoporteComercial`, `EjecutivoComercial`, `DirectorMercadeo`).
- Alta SQL ruta directa: dueño = demand-gen (EARS-29) + `sql.creado_directo` en misma txn; EARS-01b = contrato; EARS-09 excepción controlada.
- Schema `ouv_contactos.person_id` + `ouvs.account_id` → prompt `spec-ouv-funnel.md` (EARS-12 solo consume).
- §7 KPI por `origen_creacion` → diferido explícito; no bloquea aprobación ni entra al prompt Wave 1 de calificación.

**Changelog v2.1 → v2.2:**
- EARS-01b para SQLs ruta `EjecutivoComercial` (`spec-demand-generation.md`) — nacen en `Asignado`.
- `sqls.origen_creacion`; `ouvs.segment_id`/`subsegment_id`; EARS-12 reutiliza `person_id` + GC-13 `account_id`.
- DRs: lead-directo-sql, unificacion-contactos-cuentas-wave1, subsegmentos, auto-poblar-ouv-account-id, accounts-por-lead.

---

## 1. Alcance

Este módulo cubre el ciclo del SQL desde su creación (por WF002 al aprobar MQL, o directo por la ruta `EjecutivoComercial`) hasta su conversión en OUV. Tres sub-flujos:

**2a. Enrutamiento SQL** (`SoporteComercial` → `EjecutivoComercial`) — flujo estándar
- Estado inicial: SQL en `PendienteAsignacion`
- Acción: Soporte selecciona un comercial exclusivo, opcionalmente agenda cita
- Estado final: SQL en `Asignado`

**2a-bis. Creación directa** (`EjecutivoComercial`, nuevo v2.2) — ver `spec-demand-generation.md` v2.5 EARS-27..30
- El SQL nace directo en `Asignado`, sin pasar por `PendienteAsignacion` ni por `SoporteComercial`
- El **alta** del registro vive en Generación de Demanda; este módulo consume el contrato (EARS-01b)

**2b. Conversión SQL → OUV** (`EjecutivoComercial`)
- Estado inicial: SQL en `Asignado` (dueño = comercial actual)
- Acción: comercial trabaja el SQL, decide crear OUV
- Estado final: SQL en `ConvertidoOUV`, OUV creada en zona `UNIVERSO`

El ciclo posterior de la OUV vive en `spec-ouv-funnel.md`.

---

## 2. Cambios de modelo de datos

### 2.1 `sqls.estado`
Sin cambios respecto a v2.1. Enum: `PendienteAsignacion → Asignado → EnGestion → ConvertidoOUV | Backlog | Descartado`.

**Nota v2.2:** los SQL de la Ruta `EjecutivoComercial` nacen directo en `Asignado` (ver EARS-01b).

### 2.2 `sql_citas`
Sin cambios respecto a v2.1.

### 2.3 Referencia a `ouvs`
`sqls.ouv_id` (nullable, FK) — se llena al convertir.

### 2.4 `sqls.origen_creacion` *(consumido de spec-demand-generation.md v2.5)*
ENUM `enrutamiento_normal`\|`directo_comercial`. Campo persistido y usable en filtros/bandejas. El **ajuste de fórmulas KPI** que lo consume queda diferido (§7).

### 2.5 `ouvs.segment_id` / `ouvs.subsegment_id` *(nuevo v2.2)*
- `segment_id`: FK a `segments.id` (tabla nueva, inglés). Coexiste con `ouvs.segmento` ENUM existente hasta migración.
- `subsegment_id`: FK opcional a `subsegments.id`, **independiente** del `subsegment_id` del lead de origen — no se copia automáticamente en la conversión.

### 2.6 Columna canónica de asignación SQL
`sqls.comercial_asignado_id` (UUID, FK users) — nombre canónico en repo y en este spec. No usar `comercial_id` para la asignación del SQL (`comercial_id` en `ouvs` es otra columna, régimen español).

---

## 3. Criterios EARS

### 3.1 Enrutamiento SQL (EARS-01 a EARS-09)

**EARS-01.** Cuando un MQL es aprobado por `DirectorMercadeo`, el sistema DEBE dejar el SQL en estado `PendienteAsignacion` con `origen_creacion = enrutamiento_normal`. **Dueño del alta:** Generación de Demanda (misma txn que el approve MQL), que DEBE invocar `workflowEngine.transition('SQL', sqlId, 'sql.creado', ctx, transaction)`. El motor persiste la notificación al rol `SoporteComercial` y dispara el push WebSocket. Este módulo no re-crea el SQL.

**EARS-01b** *(nuevo v2.2)*. Cuando un SQL se crea por la Ruta directa `EjecutivoComercial` (`spec-demand-generation.md` EARS-29), el sistema DEBE dejarlo en `estado = Asignado` (no `PendienteAsignacion`), con `comercial_asignado_id` = el mismo KAM creador y `origen_creacion = directo_comercial`, **sin invocar el enrutamiento de `SoporteComercial`**. **Dueño del alta:** módulo Generación de Demanda (no este módulo). Este criterio solo fija el **contrato resultante** visible en calificación (bandeja del KAM, exclusión de bandeja de enrutamiento).

**EARS-02.** El sistema DEBE mostrar a `SoporteComercial` una bandeja de enrutamiento con los SQLs en `PendienteAsignacion`, con información completa del lead visible. *(No aplica a SQLs con `origen_creacion = directo_comercial` — nunca pasan por esta bandeja.)*

**EARS-03.** `SoporteComercial` DEBE poder seleccionar exactamente un `EjecutivoComercial` como destino de asignación por SQL (exclusiva).

**EARS-04.** Cuando `SoporteComercial` confirma la asignación, el sistema DEBE invocar `workflowEngine.transition('SQL', sqlId, 'sql.asignado', ctx, transaction)` con `payload.comercial_asignado_id`. El motor valida guards, persiste notificación al comercial destino, registra en `audit_log`, dispara push WS post-commit.

**EARS-05.** `SoporteComercial` DEBE tener la opción, no obligatoria, de crear un registro en `sql_citas` en el mismo acto de asignación.

**EARS-06.** Si existe `sql_citas` al momento de asignar, el motor DEBE incluir sus datos en `payload` para que la notificación refleje la cita.

**EARS-07.** El `EjecutivoComercial` asignado DEBE poder actualizar (reagendar) `sql_citas` en cualquier momento posterior. La actualización dispara `sql.cita_reagendada` con notificación informativa a `SoporteComercial`.

**EARS-08.** Toda creación/actualización de `sql_citas` DEBE quedar registrada en `audit_log`.

**EARS-09.** Toda transición del SQL DEBE pasar por el motor. Escribir `sqls.estado = ...` fuera del motor viola el patrón. **Excepción controlada (altas en demand-gen — EARS-01 / EARS-01b):** se permite `sqls.create(...)` **únicamente** si, en la **misma transacción**, se invoca de inmediato `workflowEngine.transition(...)` con `sql.creado` (enrutamiento normal) o `sql.creado_directo` (ruta KAM). Un `.create()` suelto sin ese `transition` está prohibido.

### 3.2 Conversión SQL → OUV (EARS-10 a EARS-14)

**EARS-10.** El `EjecutivoComercial` dueño de un SQL en estado `Asignado` DEBE poder iniciar la conversión a OUV.

**EARS-11.** La conversión DEBE requerir al menos: `titulo` de la OUV, `segment_id` (campo primario frente al ENUM `segmento` durante coexistencia — ver 2.5), y `vertical`.

**EARS-12** *(reemplazado v2.2 — ya no copia contactos; auto-puebla `account_id`)*. Al confirmar la conversión, el sistema DEBE en la misma transacción:
- Crear la fila `ouvs` en `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = desde_sql`, `sql_id_origen = sqlId`, `comercial_id = actor`
- Setear `ouvs.account_id` = `account_id` del `person` del contacto principal del lead (`lead_contacts.position = 1`) — ver `2026-08-DR-auto-poblar-ouv-account-id.md` / GC-13 / `spec-ouv-funnel.md` EARS-01
- Heredar `empresa_nombre` desde `accounts.name` de esa `account` (snapshot)
- Actualizar `sqls.estado = ConvertidoOUV` y `sqls.ouv_id = <nuevo_ouv_id>`
- **Para cada `person_id` asociado al lead de origen vía `lead_contacts`, crear una fila nueva en `ouv_contactos` con `ouv_id` + el mismo `person_id`** (reutiliza la persona, no duplica el dato — reemplaza el texto anterior de "copiar todos los contactos del lead")
- Sembrar 3 filas en `ouv_influencias` (Economica, Tecnica, Fabrica) en `SinEvaluar` con `contacto_ouv_id = NULL`
- Sembrar items de checklist para zona UNIVERSO
- Invocar `workflowEngine.transition('OUV', ouvId, 'ouv.creada_desde_sql', ctx, transaction)` que persiste notificación a `SoporteComercial`

> **Prerrequisito de schema (fuera de este módulo):** `ouv_contactos.person_id` (reestructura + drop denormalizados) y la columna nueva `ouvs.account_id` (GC-13) se implementan en el prompt de **`spec-ouv-funnel.md`**, no en calificación. EARS-12 **asume** ese schema ya aplicado y solo escribe filas/`account_id` en la conversión SQL→OUV. Alineado con `spec-ouv-funnel.md` EARS-01/EARS-02.

**EARS-13.** Guards para `ouv.creada_desde_sql`:
- `guardEntidadEnEstado('SQL', 'Asignado', (ctx) => ctx.payload.sqlId)` — el SQL de origen debe estar en `Asignado`
- `guardUsuarioEsComercialDelSQL` — solo el comercial dueño del SQL (`comercial_asignado_id`) puede convertir

**EARS-14.** Si el `EjecutivoComercial` decide **no** convertir el SQL, DEBE poder marcarlo como `Descartado`. **Postergado**: requiere decision record propio para definir catálogo de motivos de descarte SQL.

### 3.3 Segmentación de OUV *(nuevo v2.2)*

**EARS-15.** El sistema DEBE permitir seleccionar `segment_id` en la OUV (por defecto heredado del lead origen si existe, editable por el comercial).

**EARS-16.** El sistema DEBE permitir, opcionalmente, `subsegment_id` en la OUV, **independiente** del `subsegment_id` del lead — no se copia automáticamente.

**EARS-17.** El sistema DEBE validar que `subsegment_id` pertenezca al mismo `segment_id` de la OUV.

---

## 4. Permisos CASL

| Acción | `SoporteComercial` *(UI: “Profesional Soporte Comercial”)* | `EjecutivoComercial` (dueño del SQL) | `DirectorMercadeo` | Otros |
|---|---|---|---|---|
| Ver SQL en `PendienteAsignacion` | ✅ | ❌ | ✅ (lectura) | ❌ |
| Asignar SQL a comercial | ✅ | ❌ | ❌ | ❌ |
| Crear `sql_citas` (al asignar) | ✅ | ❌ | ❌ | ❌ |
| Ver SQL ya `Asignado` | ✅ (lectura) | ✅ (propio) | ✅ (todos) | ❌ |
| Actualizar `sql_citas` (reagendar) | ❌ | ✅ (solo dueño) | ❌ | ❌ |
| Convertir SQL → OUV | ❌ | ✅ (solo dueño) | ❌ | ❌ |
| Descartar SQL | ❌ | ✅ (solo dueño) | ✅ (any) | ❌ |
| **Crear SQL directo (Ruta `EjecutivoComercial`)** | ❌ | ✅ (solo para sí mismo; enforce en demand-gen) | ❌ | ❌ |

---

## 5. UX / Pantallas

Sin cambios estructurales respecto a v2.1. Al convertir SQL → OUV, redirect a vista de detalle OUV, donde el comercial verá los contactos ya poblados (reutilizados, no copiados) desde el lead.

---

## 6. Consumo del motor de workflow

| Evento | Origen | Destinatarios |
|---|---|---|
| `sql.creado` | Generación de Demanda (approve MQL / WF002) en la misma txn del alta | Rol `SoporteComercial` |
| `sql.creado_directo` *(nuevo v2.2)* | Generación de Demanda (EARS-29) en la misma txn del alta | Ninguno — no requiere enrutamiento; sí `audit_log` |
| `sql.asignado` | `SoporteComercial` (EARS-04) | Usuario `comercial_asignado_id` |
| `sql.cita_reagendada` | `EjecutivoComercial` (EARS-07) | Rol `SoporteComercial` (informativo) |
| `ouv.creada_desde_sql` | `EjecutivoComercial` (EARS-12) | Rol `SoporteComercial` (informativo) |
| `sql.descartado` | Diferido (EARS-14 pendiente DR) | Diferido |

---

## 7. KPIs — ajuste diferido

🟡 **Diferido (no bloquea aprobación de este spec ni el prompt Wave 1 de calificación):** los `sql` con `origen_creacion = directo_comercial` nunca pasaron por `MQL_PENDING`. Cuando Gerencia/Marketing confirme el criterio, se definirá si se excluyen del denominador de `MQL Rate`/`SQL Rate`. **No implementar ese ajuste en el prompt de calificación hasta esa confirmación.**

---

## 8. Fuera de alcance de esta spec

- Reasignación de SQL ya `Asignado` a otro comercial
- EARS-14 (descartar SQL) — requiere DR propio
- Ciclo posterior de la OUV — vive en `spec-ouv-funnel.md`
- Motor de reglas automáticas para asignación — Wave 2
- Jerarquía de cuentas, indicadores de salud — Wave 2 (`spec-gestion-cuentas.md` §6)
- Reestructurar `ouv_contactos` / agregar `ouvs.account_id` — prompt de `spec-ouv-funnel.md` (prerrequisito de EARS-12)
- Ajuste de KPI `MQL Rate`/`SQL Rate` por `origen_creacion` — §7 diferido

---

## Checklist clarify

- [x] `comercial_asignado_id` canónico (1A)
- [x] EARS-11 sin herencia lead `empresa_nombre` (2A)
- [x] Roles PascalCase en EARS/CASL (3A)
- [x] Frontera alta SQL + `sql.creado_directo` (4A)
- [x] Schema OUV contactos/`account_id` en ouv-funnel (5B)
- [x] KPI §7 diferido (6A)
