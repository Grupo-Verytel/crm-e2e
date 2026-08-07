# Spec — Módulo 2: Calificación
**Versión:** 2.1
**Fecha:** 2026-08-07
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Pendiente de aprobación para implementación
**Precede a:** `spec-ouv-funnel.md` v1.2 (ciclo completo del embudo comercial)
**Depende de:** `spec-workflow-engine.md` v1.1, Módulo 1 (Generación de Demanda)

**Changelog v2.0 → v2.1:**
- Evento `ouv.creada` renombrado a `ouv.creada_desde_sql` (alineación con spec-ouv-funnel v1.2)
- EARS-12 actualizado: durante la creación de la OUV se copian todos los contactos del lead a la nueva tabla `ouv_contactos` (delegado a `spec-ouv-funnel.md` v1.2 EARS-02 para el detalle)
- Sección 6 actualizada con el nuevo nombre del evento

---

## 1. Alcance

Este módulo cubre el ciclo del SQL desde su creación (por WF002 al aprobar MQL) hasta su conversión en OUV. Dos sub-flujos:

**2a. Enrutamiento SQL** (Soporte Comercial → Ejecutivo Comercial)
- Estado inicial: SQL en `PendienteAsignacion`
- Acción: Soporte selecciona un comercial exclusivo, opcionalmente agenda cita
- Estado final: SQL en `Asignado`

**2b. Conversión SQL → OUV** (Ejecutivo Comercial)
- Estado inicial: SQL en `Asignado` (dueño = comercial actual)
- Acción: comercial trabaja el SQL, decide crear OUV
- Estado final: SQL en `ConvertidoOUV`, OUV creada en zona `UNIVERSO`

El ciclo posterior de la OUV vive en `spec-ouv-funnel.md` v1.2.

---

## 2. Cambios de modelo de datos

### 2.1 `sqls.estado`
Sin cambios respecto a v2.0. Enum: `PendienteAsignacion → Asignado → EnGestion → ConvertidoOUV | Backlog | Descartado`.

### 2.2 `sql_citas`
Sin cambios respecto a v2.0.

### 2.3 Referencia a `ouvs`
`sqls.ouv_id` (nullable, FK) — se llena al convertir.

---

## 3. Criterios EARS

### 3.1 Enrutamiento SQL (EARS-01 a EARS-09)

**EARS-01.** Cuando un MQL es aprobado por Director de Mercadeo, el sistema DEBE crear el SQL en estado `PendienteAsignacion` invocando `workflowEngine.transition('SQL', sqlId, 'sql.creado', ctx, transaction)`. El motor persiste la notificación al rol SoporteComercial y dispara el push WebSocket.

**EARS-02.** El sistema DEBE mostrar a Profesional Soporte Comercial una bandeja de enrutamiento con los SQLs en `PendienteAsignacion`, con información completa del lead visible.

**EARS-03.** Profesional Soporte Comercial DEBE poder seleccionar exactamente un Ejecutivo Comercial como destino de asignación por SQL (exclusiva).

**EARS-04.** Cuando Soporte confirma la asignación, el sistema DEBE invocar `workflowEngine.transition('SQL', sqlId, 'sql.asignado', ctx, transaction)` con `payload.comercial_id`. El motor valida guards, persiste notificación al comercial destino, registra en `audit_log`, dispara push WS post-commit.

**EARS-05.** Profesional Soporte Comercial DEBE tener la opción, no obligatoria, de crear un registro en `sql_citas` en el mismo acto de asignación.

**EARS-06.** Si existe `sql_citas` al momento de asignar, el motor DEBE incluir sus datos en `payload` para que la notificación refleje la cita.

**EARS-07.** El Ejecutivo Comercial asignado DEBE poder actualizar (reagendar) `sql_citas` en cualquier momento posterior. La actualización dispara `sql.cita_reagendada` con notificación informativa a Soporte Comercial.

**EARS-08.** Toda creación/actualización de `sql_citas` DEBE quedar registrada en `audit_log`.

**EARS-09.** Toda transición del SQL DEBE pasar por el motor. Escribir `sqls.estado = ...` fuera del motor viola el patrón.

### 3.2 Conversión SQL → OUV (EARS-10 a EARS-14)

**EARS-10.** El Ejecutivo Comercial dueño de un SQL en estado `Asignado` DEBE poder iniciar la conversión a OUV.

**EARS-11.** La conversión DEBE requerir al menos: `titulo` de la OUV, `segmento` (Gobierno / D&S / Proyectos Especiales / B2B), y `vertical`. El sistema hereda automáticamente el `empresa_nombre` desde el lead origen (via SQL→Lead→contactos.empresa_nombre).

**EARS-12.** Al confirmar la conversión, el sistema DEBE en la misma transacción:
- Crear la fila `ouvs` en `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = desde_sql`, `sql_id_origen = sqlId`, `comercial_id = actor`
- Actualizar `sqls.estado = ConvertidoOUV` y `sqls.ouv_id = <nuevo_ouv_id>`
- **Copiar todos los contactos del lead origen a la tabla `ouv_contactos`** (ver `spec-ouv-funnel.md` v1.2 EARS-02 para reglas de copia)
- Sembrar 3 filas en `ouv_influencias` (Economica, Tecnica, Fabrica) en `SinEvaluar` con `contacto_ouv_id = NULL`
- Sembrar items de checklist para zona UNIVERSO
- Invocar `workflowEngine.transition('OUV', ouvId, 'ouv.creada_desde_sql', ctx, transaction)` que persiste notificación al Soporte Comercial

**EARS-13.** Guards para `ouv.creada_desde_sql`:
- `guardEntidadEnEstado('SQL', 'Asignado', (ctx) => ctx.payload.sqlId)` — el SQL de origen debe estar en `Asignado`
- `guardUsuarioEsComercialDelSQL` — solo el comercial dueño del SQL puede convertir

**EARS-14.** Si el Ejecutivo Comercial decide **no** convertir el SQL, DEBE poder marcarlo como `Descartado`. **Postergado**: requiere decision record propio para definir catálogo de motivos de descarte SQL. Ver DR pendiente.

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

---

## 5. UX / Pantallas

Sin cambios estructurales respecto a v2.0. Al convertir SQL → OUV, redirect a vista de detalle OUV (definida en `spec-ouv-funnel.md` v1.2 sección 8.3), donde el comercial verá los contactos ya copiados del lead.

---

## 6. Consumo del motor de workflow

| Evento | Origen | Destinatarios |
|---|---|---|
| `sql.creado` | WF002 (auto al aprobar MQL) | Rol SoporteComercial |
| `sql.asignado` | Soporte Comercial (EARS-04) | Usuario `comercial_id` |
| `sql.cita_reagendada` | Ejecutivo Comercial (EARS-07) | Rol SoporteComercial (informativo) |
| `ouv.creada_desde_sql` | Ejecutivo Comercial (EARS-12) | Rol SoporteComercial (informativo) |
| `sql.descartado` | Diferido (EARS-14 pendiente DR) | Diferido |

---

## 7. Fuera de alcance de esta spec

- Reasignación de SQL ya `Asignado` a otro comercial
- Traductores de Negocio (canal Módulo 1) — TBD
- EARS-14 (descartar SQL) — requiere DR propio
- Ciclo posterior de la OUV — vive en `spec-ouv-funnel.md` v1.2
- Motor de reglas automáticas para asignación — Wave 2
