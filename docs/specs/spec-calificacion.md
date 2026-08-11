# Spec — Módulo 2: Calificación
**Versión:** 2.2
**Fecha:** 2026-08-10
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Pendiente de aprobación para implementación
**Precede a:** `spec-ouv-funnel.md` v1.3
**Depende de:** `spec-workflow-engine.md` v1.1, Módulo 1 (Generación de Demanda) v2.3, `spec-gestion-cuentas.md` v0.4

**Changelog v2.1 → v2.2:**
- EARS-01 se mantiene para el flujo estándar; se agrega **EARS-01b** para SQLs creados por la Ruta directa `EjecutivoComercial` (`spec-demand-generation.md` v2.3) — nacen en `Asignado`, no en `PendienteAsignacion`
- Nuevo campo `sqls.origen_creacion` consumido de `spec-demand-generation.md` v2.3, usado para el ajuste de KPI (sección 7)
- `ouvs.segment_id`/`ouvs.subsegment_id` nuevos (coexisten con `ouvs.segmento` ENUM)
- **EARS-12 reemplazado**: ya no se copian contactos del lead a `ouv_contactos`, se reutiliza `person_id` (ver `2026-08-DR-unificacion-contactos-cuentas-wave1.md`); alineado con `spec-ouv-funnel.md` v1.3 EARS-02
- **EARS-12 + GC-13:** en la misma transacción se setea `ouvs.account_id` desde el contacto principal del lead (`2026-08-DR-auto-poblar-ouv-account-id.md`)
- Decision records de origen: `2026-08-DR-lead-directo-sql.md`, `2026-08-DR-unificacion-contactos-cuentas-wave1.md`, `2026-08-DR-subsegmentos.md`, `2026-08-DR-auto-poblar-ouv-account-id.md`, `2026-08-DR-accounts-por-lead.md`

---

## 1. Alcance

Este módulo cubre el ciclo del SQL desde su creación (por WF002 al aprobar MQL, o directo por la ruta `EjecutivoComercial`) hasta su conversión en OUV. Tres sub-flujos:

**2a. Enrutamiento SQL** (Soporte Comercial → Ejecutivo Comercial) — flujo estándar
- Estado inicial: SQL en `PendienteAsignacion`
- Acción: Soporte selecciona un comercial exclusivo, opcionalmente agenda cita
- Estado final: SQL en `Asignado`

**2a-bis. Creación directa** (`EjecutivoComercial`, nuevo v2.2) — ver `spec-demand-generation.md` v2.3 EARS-27..30
- El SQL nace directo en `Asignado`, sin pasar por `PendienteAsignacion` ni por Soporte Comercial

**2b. Conversión SQL → OUV** (Ejecutivo Comercial)
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

### 2.4 `sqls.origen_creacion` *(consumido de spec-demand-generation.md v2.3)*
ENUM `enrutamiento_normal`\|`directo_comercial`. Usado en el ajuste de KPI de la sección 7.

### 2.5 `ouvs.segment_id` / `ouvs.subsegment_id` *(nuevo v2.2)*
- `segment_id`: FK a `segments.id` (tabla nueva, inglés). Coexiste con `ouvs.segmento` ENUM existente hasta migración.
- `subsegment_id`: FK opcional a `subsegments.id`, **independiente** del `subsegment_id` del lead de origen — no se copia automáticamente en la conversión.

---

## 3. Criterios EARS

### 3.1 Enrutamiento SQL (EARS-01 a EARS-09)

**EARS-01.** Cuando un MQL es aprobado por Director de Mercadeo, el sistema DEBE crear el SQL en estado `PendienteAsignacion` invocando `workflowEngine.transition('SQL', sqlId, 'sql.creado', ctx, transaction)`. El motor persiste la notificación al rol SoporteComercial y dispara el push WebSocket.

**EARS-01b** *(nuevo v2.2)*. Cuando un SQL se crea por la Ruta directa `EjecutivoComercial` (`spec-demand-generation.md` v2.3 EARS-29), el sistema DEBE crearlo directamente en `estado = Asignado` (no `PendienteAsignacion`), con `comercial_id` = el mismo KAM creador, `origen_creacion = directo_comercial`, **sin invocar el enrutamiento de Soporte Comercial**.

**EARS-02.** El sistema DEBE mostrar a Profesional Soporte Comercial una bandeja de enrutamiento con los SQLs en `PendienteAsignacion`, con información completa del lead visible. *(No aplica a SQLs con `origen_creacion = directo_comercial` — nunca pasan por esta bandeja.)*

**EARS-03.** Profesional Soporte Comercial DEBE poder seleccionar exactamente un Ejecutivo Comercial como destino de asignación por SQL (exclusiva).

**EARS-04.** Cuando Soporte confirma la asignación, el sistema DEBE invocar `workflowEngine.transition('SQL', sqlId, 'sql.asignado', ctx, transaction)` con `payload.comercial_id`. El motor valida guards, persiste notificación al comercial destino, registra en `audit_log`, dispara push WS post-commit.

**EARS-05.** Profesional Soporte Comercial DEBE tener la opción, no obligatoria, de crear un registro en `sql_citas` en el mismo acto de asignación.

**EARS-06.** Si existe `sql_citas` al momento de asignar, el motor DEBE incluir sus datos en `payload` para que la notificación refleje la cita.

**EARS-07.** El Ejecutivo Comercial asignado DEBE poder actualizar (reagendar) `sql_citas` en cualquier momento posterior. La actualización dispara `sql.cita_reagendada` con notificación informativa a Soporte Comercial.

**EARS-08.** Toda creación/actualización de `sql_citas` DEBE quedar registrada en `audit_log`.

**EARS-09.** Toda transición del SQL DEBE pasar por el motor. Escribir `sqls.estado = ...` fuera del motor viola el patrón. **Esto incluye la creación directa EARS-01b** — también debe pasar por `workflowEngine.transition()`, no por un `.create()` directo.

### 3.2 Conversión SQL → OUV (EARS-10 a EARS-14)

**EARS-10.** El Ejecutivo Comercial dueño de un SQL en estado `Asignado` DEBE poder iniciar la conversión a OUV.

**EARS-11.** La conversión DEBE requerir al menos: `titulo` de la OUV, `segment_id` (nuevo, reemplaza el ENUM `segmento` como campo primario — ver 2.5), y `vertical`. El sistema hereda automáticamente el `empresa_nombre` desde el lead origen.

**EARS-12** *(reemplazado v2.2 — ya no copia contactos; auto-puebla `account_id`)*. Al confirmar la conversión, el sistema DEBE en la misma transacción:
- Crear la fila `ouvs` en `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = desde_sql`, `sql_id_origen = sqlId`, `comercial_id = actor`
- Setear `ouvs.account_id` = `account_id` del `person` del contacto principal del lead (`lead_contacts.position = 1`) — ver `2026-08-DR-auto-poblar-ouv-account-id.md` / GC-13 / `spec-ouv-funnel.md` EARS-01
- Heredar `empresa_nombre` desde `accounts.name` de esa `account` (snapshot)
- Actualizar `sqls.estado = ConvertidoOUV` y `sqls.ouv_id = <nuevo_ouv_id>`
- **Para cada `person_id` asociado al lead de origen vía `lead_contacts`, crear una fila nueva en `ouv_contactos` con `ouv_id` + el mismo `person_id`** (reutiliza la persona, no duplica el dato — reemplaza el texto anterior de "copiar todos los contactos del lead")
- Sembrar 3 filas en `ouv_influencias` (Economica, Tecnica, Fabrica) en `SinEvaluar` con `contacto_ouv_id = NULL`
- Sembrar items de checklist para zona UNIVERSO
- Invocar `workflowEngine.transition('OUV', ouvId, 'ouv.creada_desde_sql', ctx, transaction)` que persiste notificación al Soporte Comercial

> Alineado con `spec-ouv-funnel.md` v1.3 EARS-01/EARS-02. La columna `ouvs.account_id` y este auto-poblado se implementan en el prompt de discovery/calificación (no en el prompt Wave 1a de `accounts` GC-01…11).

**EARS-13.** Guards para `ouv.creada_desde_sql`:
- `guardEntidadEnEstado('SQL', 'Asignado', (ctx) => ctx.payload.sqlId)` — el SQL de origen debe estar en `Asignado`
- `guardUsuarioEsComercialDelSQL` — solo el comercial dueño del SQL puede convertir

**EARS-14.** Si el Ejecutivo Comercial decide **no** convertir el SQL, DEBE poder marcarlo como `Descartado`. **Postergado**: requiere decision record propio para definir catálogo de motivos de descarte SQL.

### 3.3 Segmentación de OUV *(nuevo v2.2)*

**EARS-15.** El sistema DEBE permitir seleccionar `segment_id` en la OUV (por defecto heredado del lead origen si existe, editable por el comercial).

**EARS-16.** El sistema DEBE permitir, opcionalmente, `subsegment_id` en la OUV, **independiente** del `subsegment_id` del lead — no se copia automáticamente.

**EARS-17.** El sistema DEBE validar que `subsegment_id` pertenezca al mismo `segment_id` de la OUV.

---

## 4. Permisos CASL

| Acción | Profesional Soporte Comercial | Ejecutivo Comercial (dueño del SQL) | Director Mercadeo | Otros |
|---|---|---|---|---|
| Ver SQL en `PendienteAsignacion` | ✅ | ❌ | ✅ (lectura) | ❌ |
| Asignar SQL a comercial | ✅ | ❌ | ❌ | ❌ |
| Crear `sql_citas` (al asignar) | ✅ | ❌ | ❌ | ❌ |
| Ver SQL ya `Asignado` | ✅ (lectura) | ✅ (propio) | ✅ (todos) | ❌ |
| Actualizar `sql_citas` (reagendar) | ❌ | ✅ (solo dueño) | ❌ | ❌ |
| Convertir SQL → OUV | ❌ | ✅ (solo dueño) | ❌ | ❌ |
| Descartar SQL | ❌ | ✅ (solo dueño) | ✅ (any) | ❌ |
| **Crear SQL directo (Ruta EjecutivoComercial)** | ❌ | ✅ (solo para sí mismo) | ❌ | ❌ |

---

## 5. UX / Pantallas

Sin cambios estructurales respecto a v2.1. Al convertir SQL → OUV, redirect a vista de detalle OUV, donde el comercial verá los contactos ya poblados (reutilizados, no copiados) desde el lead.

---

## 6. Consumo del motor de workflow

| Evento | Origen | Destinatarios |
|---|---|---|
| `sql.creado` | WF002 (auto al aprobar MQL) | Rol SoporteComercial |
| `sql.creado_directo` *(nuevo v2.2)* | Ejecutivo Comercial (EARS-01b) | Ninguno — no requiere enrutamiento, solo `audit_log` |
| `sql.asignado` | Soporte Comercial (EARS-04) | Usuario `comercial_id` |
| `sql.cita_reagendada` | Ejecutivo Comercial (EARS-07) | Rol SoporteComercial (informativo) |
| `ouv.creada_desde_sql` | Ejecutivo Comercial (EARS-12) | Rol SoporteComercial (informativo) |
| `sql.descartado` | Diferido (EARS-14 pendiente DR) | Diferido |

---

## 7. KPIs — ajuste pendiente

🟡 **Pendiente (no resuelto, requiere confirmación de Gerencia/Marketing):** los `sql` con `origen_creacion = directo_comercial` nunca pasaron por `MQL_PENDING`. Definir si se excluyen del denominador de `MQL Rate`/`SQL Rate` en el dashboard de KPIs. **No implementar el ajuste sin esta confirmación.**

---

## 8. Fuera de alcance de esta spec

- Reasignación de SQL ya `Asignado` a otro comercial
- EARS-14 (descartar SQL) — requiere DR propio
- Ciclo posterior de la OUV — vive en `spec-ouv-funnel.md`
- Motor de reglas automáticas para asignación — Wave 2
- Jerarquía de cuentas, indicadores de salud — Wave 2 (`spec-gestion-cuentas.md` §6)
