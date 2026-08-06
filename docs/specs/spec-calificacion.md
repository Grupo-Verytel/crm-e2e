# Spec — Módulo 2: Calificación
**Versión:** 1.0
**Fecha:** 2026-07-30
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Apertura — pendiente confirmación de EARS-10 en adelante (SQL→OUV, Taller T2)
**Precede a:** flujo Ejecutivo Comercial / KAM [SQL → OUV → Cierre] (ya descrito en Blueprint V2)
**Depende de:** Módulo 1 (Generación de Demanda) spec v2.0 — punto de entrada: MQL aprobado por Director de Mercadeo

---

## 1. Contexto y brecha identificada

El Blueprint V2 (WF002) define que al aprobar un MQL se crea el registro `sql`, se actualiza `lead.estado = SQL` y se notifica a "KAM/Soporte Comercial", agregándolo a la bandeja comercial. Sin embargo, no está definido el sub-flujo manual en el que **Profesional Soporte Comercial** recibe el SQL, lo revisa, y lo enruta a **un** Ejecutivo Comercial específico — incluyendo la posibilidad de agendar una cita en ese mismo acto.

El documento Bizagi (`DIAGRAMA_PROCESO_COMERCIAL_END_TO_END.pdf`) deja esta pregunta explícitamente abierta: *"en que casos debería asignarse directamente a comercial?"* — sin resolverla. Esta spec cierra ese vacío.

**Nota de nomenclatura:** el Blueprint usa la palabra "Limbo" para el tramo SQL→OUV (cuando el comercial ya tiene el SQL y aún no lo convierte). El estado que se define aquí es **anterior** a ese y se nombra de forma distinta para evitar ambigüedad: `PendienteAsignacion`.

---

## 2. Cambios de modelo de datos

### 2.1 `sqls.estado` — nuevo valor de enum

```
PendienteAsignacion → Asignado → EnGestion → ConvertidoOUV | Backlog | Descartado
```

| Valor | Significado | Quién lo produce |
|---|---|---|
| `PendienteAsignacion` | SQL creado por WF002, visible en bandeja de Soporte, sin comercial asignado | Sistema (automático, al aprobar MQL) |
| `Asignado` | Soporte ya seleccionó un comercial exclusivo | Profesional Soporte Comercial |

Campos ya existentes en `sqls` (`comercial_id`, `fecha_asignacion`) se completan en la transición `PendienteAsignacion → Asignado`. No se requieren columnas nuevas en `sqls`.

### 2.2 Nueva tabla `sql_citas`

Entidad propia del Módulo 2 (no reutiliza ni modifica la spec ya cerrada de Módulo 1 — la Bandeja de Agenda del canal agencia mantiene su propio modelo de cita, independiente).

| Campo | Tipo | Oblig. | Validación / Regla | Relación |
|---|---|---|---|---|
| `cita_id` | UUID | Sí | PK | — |
| `sql_id` | UUID | Sí | FK `sqls.sql_id`, UNIQUE (1:1) | sqls |
| `lugar` | VARCHAR(200) | Sí | — | — |
| `fecha` | DATE | Sí | ≥ fecha actual al crear | — |
| `hora` | TIME | Sí | — | — |
| `contacto_nombre` | VARCHAR(120) | Sí | — | — |
| `contacto_cargo` | VARCHAR(100) | No | — | — |
| `descripcion` | TEXT | No | Motivo/agenda de la reunión | — |
| `agendada_por` | UUID | Sí | FK `users.user_id` | users |
| `created_at` | TIMESTAMPTZ | Sí | DEFAULT NOW() | — |
| `updated_at` | TIMESTAMPTZ | Sí | Se actualiza en cada reagendamiento | — |

La tabla es mutable (una fila por SQL, no versionada). El historial de cambios (quién reagenda, valores anterior/nuevo) queda cubierto por el `audit_log` genérico ya existente en el blueprint — no se requiere tabla de historial propia.

---

## 3. Criterios EARS

**EARS-01.** Cuando un MQL es aprobado por el Director de Mercadeo, el sistema DEBE crear el SQL en estado `PendienteAsignacion` y notificar a Profesional Soporte Comercial.

**EARS-02.** El sistema DEBE mostrar a Profesional Soporte Comercial una bandeja de enrutamiento con los SQLs en estado `PendienteAsignacion`, exponiendo la información completa del lead (datos de contacto, historial de interacciones, score, origen).

**EARS-03.** Profesional Soporte Comercial DEBE poder seleccionar exactamente un Ejecutivo Comercial como destino de asignación por SQL (asignación exclusiva, no hay selección múltiple de candidatos).

**EARS-04.** Cuando Soporte confirma la asignación, el sistema DEBE:
  - actualizar `sqls.estado` a `Asignado`
  - registrar `comercial_id` y `fecha_asignacion`
  - notificar al Ejecutivo Comercial asignado con la información completa del lead

**EARS-05.** Profesional Soporte Comercial DEBE tener la opción, no obligatoria, de crear un registro en `sql_citas` en el mismo acto de asignación, capturando lugar, fecha, hora, contacto y descripción.

**EARS-06.** Si existe un registro en `sql_citas` al momento de asignar, el sistema DEBE incluir sus datos en la notificación enviada al Ejecutivo Comercial.

**EARS-07.** El Ejecutivo Comercial asignado a un SQL DEBE poder actualizar (reagendar) el registro de `sql_citas` asociado en cualquier momento posterior a la asignación.

**EARS-08.** Toda creación o actualización de `sql_citas` DEBE quedar registrada en `audit_log` (acción, campo modificado, valor anterior, valor nuevo, usuario, timestamp).

**EARS-09.** Toda transición `PendienteAsignacion → Asignado` DEBE quedar registrada en `audit_log`, incluyendo Soporte que asignó, comercial destino, y timestamp.

*(EARS-10 en adelante: flujo SQL → OUV de Ejecutivo Comercial/KAM — a confirmar en Taller T2, ya descrito preliminarmente en Blueprint V2 sección 3.3)*

---

## 4. Permisos (CASL)

| Acción | Profesional Soporte Comercial | Ejecutivo Comercial (dueño del SQL) | Otros |
|---|---|---|---|
| Ver SQL en `PendienteAsignacion` | ✅ | ❌ | ❌ |
| Asignar SQL a comercial | ✅ | ❌ | ❌ |
| Crear `sql_citas` (al asignar) | ✅ | ❌ | ❌ |
| Actualizar `sql_citas` (reagendar) | ❌ | ✅ (solo si `comercial_id` = usuario actual) | ❌ |
| Ver SQL ya `Asignado` | ✅ (lectura) | ✅ (propio) | ❌ |

---

## 5. UX / Pantallas

**Bandeja de Enrutamiento** (nueva, rol Soporte Comercial)
- Tabla: nombre lead, empresa, score, fecha creación SQL, días en `PendienteAsignacion`
- Acción por fila: "Asignar" → abre modal con selector de comercial (único) + sección opcional "Agendar cita" (lugar, fecha, hora, contacto, descripción)
- Al confirmar: dispara EARS-04/05/06

**SQL — Detalle** (vista comercial, extensión de la ya existente "Bandeja SQL — Comercial")
- Si existe `sql_citas`: tarjeta de cita visible con botón "Reagendar"
- Botón "Reagendar" abre el mismo formulario de captura, en modo edición

---

## 6. Fuera de alcance de esta apertura

- **Traductores de Negocio** (canal de Módulo 1): su comportamiento de funnel sigue TBD y no afecta este enrutamiento — cuando se resuelva, si ese canal también requiere paso por Soporte, se evaluará si aplica el mismo patrón.
- Selección de comercial por reglas automáticas (territorio, carga de trabajo, vertical) — Wave 1 es 100% manual, sin motor de reglas. Posible candidato a Wave 2.
- Reasignación de un SQL ya `Asignado` a otro comercial — no descrito en este alcance; si surge el caso, requiere su propio EARS.
