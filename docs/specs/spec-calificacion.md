# Spec — Módulo 2: Calificación
**Versión:** 2.0
**Fecha:** 2026-08-05
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Pendiente de aprobación para implementación
**Precede a:** `spec-ouv-funnel.md` v1.0 (ciclo completo del embudo comercial)
**Depende de:** `spec-workflow-engine.md` v1.1 (motor de workflow), Módulo 1 (Generación de Demanda)

**Changelog v1.0 → v2.0:**
- v1.0 cubría solo el enrutamiento SQL (bandeja de Soporte). Se mantiene íntegro.
- v2.0 agrega la conversión SQL→OUV, punto de entrada al embudo comercial (ver DR-2026-08-B).
- Todas las transiciones de estado ahora consumen el motor de workflow (spec-workflow-engine v1.1) en vez de escribir a `notifications` a mano.

---

## 1. Alcance

Este módulo cubre el ciclo del SQL desde su creación (por WF002 al aprobar MQL) hasta su conversión en OUV (oportunidad). Tiene dos sub-flujos:

**2a. Enrutamiento SQL** (Soporte Comercial → Ejecutivo Comercial)
- Estado inicial: SQL en `PendienteAsignacion`
- Acción: Soporte selecciona un comercial exclusivo, opcionalmente agenda cita
- Estado final: SQL en `Asignado`

**2b. Conversión SQL → OUV** (Ejecutivo Comercial)
- Estado inicial: SQL en `Asignado` (dueño = comercial actual)
- Acción: comercial trabaja el SQL, decide crear OUV
- Estado final: SQL en `ConvertidoOUV`, OUV creada en zona `UNIVERSO`

El ciclo posterior de la OUV a través del embudo comercial vive en `spec-ouv-funnel.md`.

---

## 2. Cambios de modelo de datos

### 2.1 `sqls.estado` — enum actualizado

```
PendienteAsignacion → Asignado → EnGestion → ConvertidoOUV | Backlog | Descartado
```

Sin cambios respecto a v1.0. `EnGestion` es opcional y refleja "el comercial está trabajando el SQL antes de convertirlo o descartarlo" — su uso queda a discreción del comercial y no es guard obligatorio para pasar a `ConvertidoOUV`.

### 2.2 `sql_citas` — sin cambios respecto a v1.0

Mismo esquema. Módulo-scoped, mutable, con audit vía `audit_log`.

### 2.3 Referencia a `ouvs`

La conversión crea una fila en la tabla `ouvs` (definida en `spec-ouv-funnel.md`). El SQL retiene FK al OUV creado (`sqls.ouv_id`, nullable — se llena al convertir).

---

## 3. Criterios EARS

### 3.1 Enrutamiento SQL (heredados de v1.0, con actualización de eventos)

**EARS-01.** Cuando un MQL es aprobado por Director de Mercadeo, el sistema DEBE crear el SQL en estado `PendienteAsignacion` invocando `workflowEngine.transition('SQL', sqlId, 'sql.creado', ctx, transaction)`. El motor persiste la notificación al rol SoporteComercial y dispara el push WebSocket.

**EARS-02.** El sistema DEBE mostrar a Profesional Soporte Comercial una bandeja de enrutamiento con los SQLs en `PendienteAsignacion`, con información completa del lead visible.

**EARS-03.** Profesional Soporte Comercial DEBE poder seleccionar exactamente un Ejecutivo Comercial como destino de asignación por SQL (exclusiva).

**EARS-04.** Cuando Soporte confirma la asignación, el sistema DEBE invocar `workflowEngine.transition('SQL', sqlId, 'sql.asignado', ctx, transaction)` con `payload.comercial_id`. El motor:
- valida guards (SQL en `PendienteAsignacion`, actor tiene rol `SoporteComercial`)
- persiste notificación al comercial destino (por userId)
- registra en `audit_log`
- dispara push WS post-commit

**EARS-05.** Profesional Soporte Comercial DEBE tener la opción, no obligatoria, de crear un registro en `sql_citas` en el mismo acto de asignación (lugar, fecha, hora, contacto, descripción).

**EARS-06.** Si existe `sql_citas` al momento de asignar, el motor DEBE incluir sus datos en `payload` para que `entity_label` y `metadata` de la notificación reflejen la cita.

**EARS-07.** El Ejecutivo Comercial asignado DEBE poder actualizar (reagendar) `sql_citas` en cualquier momento posterior a la asignación. La actualización dispara `sql.cita_reagendada` con notificación informativa a Soporte Comercial.

**EARS-08.** Toda creación/actualización de `sql_citas` DEBE quedar registrada en `audit_log` (acción, campo, valor_anterior, valor_nuevo, usuario, timestamp).

**EARS-09.** Toda transición del SQL DEBE pasar por el motor. Escribir `sqls.estado = ...` fuera del motor viola el patrón (verificable en revisión de PR).

### 3.2 Conversión SQL → OUV (nuevos en v2.0)

**EARS-10.** El Ejecutivo Comercial dueño de un SQL en estado `Asignado` DEBE poder iniciar la conversión a OUV.

**EARS-11.** La conversión DEBE requerir al menos: `titulo` de la OUV, `segmento` (Gobierno / D&S / Proyectos Especiales / B2B), y `vertical` (según catálogo Verytel).

**EARS-12.** Al confirmar la conversión, el sistema DEBE en la misma transacción:
- Crear la fila `ouvs` en `zona_actual = UNIVERSO`, `resultado = EnCurso`, con `sql_id_origen = sqlId` y `comercial_id = actor`
- Actualizar `sqls.estado = ConvertidoOUV` y `sqls.ouv_id = <nuevo_ouv_id>`
- Invocar `workflowEngine.transition('OUV', ouvId, 'ouv.creada', ctx, transaction)` que persiste notificación al Director Comercial (informativa) y a Soporte Comercial (informativa)

**EARS-13.** Guards para `ouv.creada`:
- `guardEntidadEnEstado('SQL', 'Asignado')` — el SQL de origen debe estar en `Asignado`
- `guardUsuarioEsComercialDelSQL` — solo el comercial dueño del SQL puede convertir

**EARS-14.** Si el Ejecutivo Comercial decide **no** convertir el SQL (no encaja, cliente no responde, etc.), DEBE poder marcarlo como `Descartado` con motivo obligatorio. Esto dispara `sql.descartado` con notificación informativa a Director de Mercadeo (según DR: el motivo puede revelar problemas en calificación upstream).

---

## 4. Permisos CASL

| Acción | Profesional Soporte Comercial | Ejecutivo Comercial (dueño del SQL) | Director Comercial | Otros |
|---|---|---|---|---|
| Ver SQL en `PendienteAsignacion` | ✅ | ❌ | ✅ (lectura) | ❌ |
| Asignar SQL a comercial | ✅ | ❌ | ❌ | ❌ |
| Crear `sql_citas` (al asignar) | ✅ | ❌ | ❌ | ❌ |
| Ver SQL ya `Asignado` | ✅ (lectura) | ✅ (propio) | ✅ (todos) | ❌ |
| Actualizar `sql_citas` (reagendar) | ❌ | ✅ (solo si `comercial_id` = actor) | ❌ | ❌ |
| Convertir SQL → OUV | ❌ | ✅ (solo si `comercial_id` = actor) | ❌ | ❌ |
| Descartar SQL | ❌ | ✅ (solo si `comercial_id` = actor) | ✅ (any) | ❌ |

---

## 5. UX / Pantallas

### 5.1 Bandeja de Enrutamiento (rol Soporte Comercial)
- Tabla: nombre lead, empresa, score MQL, fecha creación SQL, días en `PendienteAsignacion`
- Acción por fila: "Asignar" → modal con selector de comercial (único) + sección opcional "Agendar cita"
- Al confirmar: dispara EARS-04/05/06

### 5.2 Bandeja del Ejecutivo Comercial (SQLs asignados)
- Vista de SQLs con `comercial_id = current` y `estado ∈ (Asignado, EnGestion)`
- Acción por SQL: "Ver detalle" (ver 5.3) o "Convertir en OUV"

### 5.3 SQL — Detalle
- Datos del lead + información completa del MQL
- Si existe `sql_citas`: tarjeta con datos + botón "Reagendar"
- Botón principal: "Crear OUV" (dispara flujo 2b) — abre modal con formulario mínimo (título, segmento, vertical)
- Botón secundario: "Descartar" — abre modal con selector de motivo (catálogo `motivos_descarte_sql`, a definir por seed en Wave 1)

### 5.4 Post-conversión
Al crear la OUV, redirect a la vista de detalle de OUV (definida en `spec-ouv-funnel.md` sección 8).

---

## 6. Consumo del motor de workflow

Todas las transiciones de este módulo pasan por `WorkflowEngineService.transition()`. Eventos utilizados:

| Evento | Origen | Destinatarios |
|---|---|---|
| `sql.creado` | WF002 (auto al aprobar MQL) | Rol SoporteComercial |
| `sql.asignado` | Soporte Comercial (EARS-04) | Usuario `comercial_id` |
| `sql.cita_reagendada` | Ejecutivo Comercial (EARS-07) | Rol SoporteComercial (informativo) |
| `ouv.creada` | Ejecutivo Comercial (EARS-12) | Director Comercial + Soporte Comercial (informativos) |
| `sql.descartado` | Ejecutivo Comercial (EARS-14) | Director Mercadeo (informativo) |

Cada evento vive como una entrada declarativa en `workflow.rules.ts`. No hay lógica de notificación en los services de dominio.

---

## 7. Fuera de alcance de esta spec

- Reasignación de SQL ya `Asignado` a otro comercial — no descrito; si surge, requiere su propio EARS
- Traductores de Negocio (canal de Módulo 1) — su comportamiento en calificación aún TBD
- Ciclo posterior de la OUV (4 zonas del funnel, cierre, reapertura) — vive en `spec-ouv-funnel.md`
- Motor de reglas automáticas para asignación (territorio, carga) — Wave 2
