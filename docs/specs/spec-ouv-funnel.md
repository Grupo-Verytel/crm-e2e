# Spec — Módulo 2: OUV Funnel (Embudo Comercial Verytel)
**Versión:** 1.2
**Fecha:** 2026-08-07
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Pendiente de aprobación para implementación
**Depende de:** `spec-calificacion.md` v2.1, `spec-workflow-engine.md` v1.1
**Referencia de negocio:** `FILTROS_EMBUDO_COMERCIAL_v5.pdf`, `Frisson_CRM_Blueprint_V2_19062026.pdf`
**Decisiones estructurales:** DR-2026-08-B (con adendas A y B)

**Changelog v1.1 → v1.2 (adenda 2026-08-07-B):**
- Nueva tabla `ouv_contactos` propia del módulo `discovery`, sin FK a `contactos`
- `contactos.lead_id` vuelve a NOT NULL (revierte cambio de v1.1)
- `ouv_influencias.contacto_id` renombrado a `contacto_ouv_id` (FK a `ouv_contactos`)
- Snapshots inmutables en `ouv_influencias` eliminados (ya no necesarios)
- En Vía 1, se copian todos los contactos del lead a `ouv_contactos` al crear OUV
- Contactos multi-propósito: pueden crearse sin estar asignados a influencia
- Sin sincronización posterior lead↔OUV: una vez copiado, se rompe el vínculo

---

## 1. Alcance

Cubre el ciclo de vida completo de la OUV a través de 4 zonas formales del embudo comercial, incluyendo:

- Dos vías de creación (desde SQL o directa)
- Transiciones de zona (avance y retroceso)
- Gestión de contactos propios de la OUV
- Gestión de influencias compradoras (Económica / Técnica / Fábrica)
- Checklist de criterios por zona
- Presupuesto estructurado
- Alertas automáticas de gap de criterios
- Cierre (Ganada / Perdida / Descartada)
- Bandeja del Ejecutivo Comercial

**Explícitamente diferido a Wave 2:** Override de Ganada, reapertura, vista Marketing.

---

## 2. Modelo de datos

### 2.1 Tabla `ouvs`

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `ouv_id` | UUID | Sí (PK) | — |
| `consecutivo` | VARCHAR(20) | Sí | Formato `OUV-####` |
| `sql_id_origen` | UUID | No | FK sqls, NULL para OUVs directas |
| `origen_via` | ENUM(desde_sql, directa) | Sí | Redundante con `sql_id_origen` pero explícito para queries |
| `comercial_id` | UUID | Sí (FK users) | Dueño exclusivo |
| `cuenta_id` | UUID | No (FK cuentas) | Nullable en Wave 1 (Módulo 12 pendiente) |
| `titulo` | VARCHAR(200) | Sí | Nombre corto |
| `empresa_nombre` | VARCHAR(200) | Sí | Snapshot del nombre del cliente. En Vía 1 se hereda del lead; en Vías 2/3/4 lo captura el comercial |
| `descripcion` | TEXT | No | — |
| `segmento` | ENUM(Gobierno, DefensaSeguridad, ProyectosEspeciales, B2B) | Sí | — |
| `vertical` | ENUM (7 valores, ver 2.6) | Sí | — |
| **Zona y resultado** | | | |
| `zona_actual` | ENUM(UNIVERSO, ENCIMA_FUNNEL, EN_FUNNEL, MAYOR_PROBABILIDAD) | Sí | Default UNIVERSO |
| `resultado` | ENUM(EnCurso, Ganada, Perdida, Descartada) | Sí | Default EnCurso |
| **Gap de criterios** | | | |
| `tiene_gap` | BOOLEAN | Sí | Default false — mantenido por `CriteriosZonaEvaluator` |
| `criterios_faltantes` | JSON | No | Array de códigos de criterios faltantes |
| **Presupuesto** | | | |
| `presupuesto_confirmado` | BOOLEAN | Sí | Default false — guard duro para ENCIMA_FUNNEL |
| `presupuesto_monto` | DECIMAL(18,2) | No | — |
| `presupuesto_moneda` | ENUM(COP, USD) | No | — |
| `presupuesto_fecha_captura` | TIMESTAMPTZ | No | — |
| `presupuesto_fuente` | ENUM(cliente_declaro, contrato_previo, licitacion_publicada, estimacion_comercial, sin_verificar) | No | — |
| **Cierre** | | | |
| `motivo_id` | UUID | No | FK a `motivos_perdida` o `motivos_descarte` |
| `motivo_snapshot` | VARCHAR(200) | No | Nombre del motivo (inmutable) |
| `motivo_detalle` | TEXT | No | Obligatorio si motivo = "Otro" |
| `competidor_ganador` | VARCHAR(200) | No | Solo si motivo Perdida = "Ganó competidor" |
| `monto_final` | DECIMAL(18,2) | No | Obligatorio si `resultado = Ganada` |
| `moneda_final` | ENUM(COP, USD) | No | Obligatorio si `resultado = Ganada` |
| `monto_estimado_perdido` | DECIMAL(18,2) | No | Obligatorio si `resultado = Perdida` |
| `fecha_cierre` | TIMESTAMPTZ | No | Auto al marcar cierre |
| **Auditoría estándar** | | | |
| `created_at` / `updated_at` | TIMESTAMPTZ | Sí | — |

**Nota:** campos `zona_antes_cierre`, `motivo_reapertura_id`, `motivo_reapertura_snapshot`, `fecha_reapertura`, `override_ganada_aplicado`, `override_motivo` NO se crean en Wave 1.

### 2.2 Tabla `ouv_contactos` (NUEVA en v1.2)

Tabla propia del módulo `discovery`. Autocontenida, sin FK a `contactos`.

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `contacto_ouv_id` | UUID | Sí (PK) | — |
| `ouv_id` | UUID | Sí (FK ouvs) | — |
| `nombre` | VARCHAR(120) | Sí | — |
| `cargo` | VARCHAR(80) | No | — |
| `email` | VARCHAR(180) | No | El comercial puede no tener el email inicialmente |
| `telefono` | VARCHAR(20) | No | — |
| `notas` | TEXT | No | Contexto adicional sobre este contacto en la OUV |
| `created_at` | TIMESTAMPTZ | Sí | — |
| `updated_at` | TIMESTAMPTZ | Sí | — |
| `deleted_at` | TIMESTAMPTZ | No | Soft-delete estándar del proyecto |

Índice: `(ouv_id, deleted_at)` para listar contactos vigentes por OUV.

### 2.3 Tabla `contactos` (sin cambios v1.2)

Tabla existente en `demand-generation`, con `lead_id` NOT NULL (schema original). NO se modifica en el PR grande del embudo.

Nota: el schema ya soporta el ciclo de leads y NO se toca al implementar el embudo comercial.

### 2.4 Tabla `ouv_influencias` (simplificada v1.2)

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `influencia_id` | UUID | Sí (PK) | — |
| `ouv_id` | UUID | Sí (FK ouvs) | — |
| `tipo` | ENUM(Economica, Tecnica, Fabrica) | Sí | UNIQUE compuesto con `ouv_id` |
| `estado` | ENUM(Verde, Rojo, Amarillo, SinEvaluar) | Sí | Default SinEvaluar |
| `contacto_ouv_id` | UUID | No (FK ouv_contactos) | Nullable — la influencia puede no tener contacto asignado todavía |
| `notas` | TEXT | No | — |
| `motivo_estado` | TEXT | No | Por qué está en Rojo/Amarillo |
| `fecha_ultimo_cambio` | TIMESTAMPTZ | No | Auto al UPDATE del `estado` |
| `created_at` | TIMESTAMPTZ | Sí | — |

**Cambios v1.2:**
- `contacto_id` FK a `contactos` **eliminado** — reemplazado por `contacto_ouv_id` FK a `ouv_contactos`
- Snapshots `contacto_nombre_snapshot`, `contacto_cargo_snapshot`, `contacto_email_snapshot` **eliminados**. Ya no son necesarios: el contacto vive en tabla del propio módulo (`ouv_contactos`) y no cambia por acciones externas

**Seed automático:** al crear una OUV, el sistema inserta 3 filas — una por cada tipo — en `estado = SinEvaluar` y `contacto_ouv_id = NULL`.

### 2.5 Tabla `ouv_checklist_items` (T3 con timestamp)

Sin cambios respecto a v1.1.

### 2.6 ENUM `Vertical` (hardcoded Wave 1)

Sin cambios respecto a v1.1. Lista de 7 valores según PDF v5.

### 2.7 Catálogos administrables

`motivos_perdida`, `motivos_descarte`, `zona_checklist_templates` — sin cambios respecto a v1.1. CRUD por Soporte Comercial.

---

## 3. Criterios EARS

### 3.1 Creación desde SQL — Vía 1 (EARS-01 a EARS-04)

**EARS-01.** Al crear una OUV desde SQL (via `spec-calificacion.md` v2.1 EARS-10..14), el sistema DEBE inicializar en la misma transacción:
- `ouvs`: `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = desde_sql`, `sql_id_origen = <SQL de origen>`
- `empresa_nombre` heredado desde `contactos.empresa_nombre` del lead origen
- Consecutivo `OUV-####`
- Tres filas en `ouv_influencias` en estado `SinEvaluar`
- Items de checklist para zona UNIVERSO

**EARS-02.** En la misma transacción, el sistema DEBE **copiar todos los contactos del lead origen a `ouv_contactos`**. Reglas:
- Se consultan filas de `contactos` con `lead_id = <lead origen del SQL>` y `deleted_at IS NULL`
- Por cada fila de origen, se crea una fila en `ouv_contactos` con: `ouv_id`, `nombre`, `cargo`, `email`, `telefono` copiados literales
- Campo `notas` queda vacío
- El campo `position` de origen NO se copia (no aplica en discovery)
- La copia es **de una sola vez**: no hay sincronización posterior

**EARS-03.** Los contactos copiados NO se auto-asignan a ninguna influencia. Todas las filas de `ouv_influencias` nacen con `contacto_ouv_id = NULL`. El Ejecutivo Comercial asigna manualmente después según su criterio.

**EARS-04.** El sistema DEBE emitir el evento `ouv.creada_desde_sql` con destinatario: Soporte Comercial.

### 3.2 Creación directa — Vías 2/3/4 (EARS-05 a EARS-07)

**EARS-05.** Un usuario con rol `EjecutivoComercial` DEBE poder crear una OUV directa vía `POST /discovery/ouvs` con campos obligatorios: `titulo`, `empresa_nombre`, `segmento`, `vertical`, `descripcion`.

**EARS-06.** Al crear OUV directa, el sistema DEBE inicializar:
- `ouvs`: `zona_actual = UNIVERSO`, `resultado = EnCurso`, `origen_via = directa`, `sql_id_origen = NULL`
- `comercial_id = actor_user_id`
- Tres filas en `ouv_influencias` (idéntico a Vía 1)
- Items de checklist para zona UNIVERSO
- Consecutivo `OUV-####`
- **NO se crean filas en `ouv_contactos`** — el comercial las crea después manualmente

**EARS-07.** El sistema DEBE emitir el evento `ouv.creada_directa` con destinatario: Soporte Comercial.

### 3.3 Gestión de contactos de OUV (EARS-08 a EARS-11)

**EARS-08.** El Ejecutivo Comercial dueño DEBE poder crear filas nuevas en `ouv_contactos` para su OUV vía `POST /discovery/ouvs/:id/contactos`. Sin necesidad de asignarlos inmediatamente a una influencia.

**EARS-09.** El Ejecutivo Comercial dueño DEBE poder actualizar filas de `ouv_contactos` de su OUV (nombre, cargo, email, telefono, notas).

**EARS-10.** El Ejecutivo Comercial dueño DEBE poder eliminar (soft-delete) filas de `ouv_contactos`. Si el contacto está referenciado por alguna `ouv_influencias`, el sistema DEBE:
- Setear `ouv_influencias.contacto_ouv_id = NULL` para todas las influencias afectadas
- Registrar el cambio en `audit_log`

**EARS-11.** Los contactos de OUV NO se sincronizan con contactos del lead. Si el lead agrega/edita contactos DESPUÉS de crear la OUV, esos cambios NO se propagan a `ouv_contactos`.

### 3.4 Avance de zona (EARS-12 a EARS-15)

**EARS-12.** El Ejecutivo Comercial dueño DEBE poder solicitar avance a la zona siguiente vía `POST /discovery/ouvs/:id/avanzar`.

**EARS-13.** El motor DEBE validar los siguientes guards según zona destino:

| Zona destino | Guards |
|---|---|
| ENCIMA_FUNNEL | `guardEntidadEnEstado('OUV', 'UNIVERSO')` + `guardPresupuestoConfirmado` |
| EN_FUNNEL | `guardEntidadEnEstado('OUV', 'ENCIMA_FUNNEL')` + `guard2InfluenciasEnVerde` |
| MAYOR_PROBABILIDAD | `guardEntidadEnEstado('OUV', 'EN_FUNNEL')` + `guard2InfluenciasEnVerde` |

**EARS-14.** Si un guard rechaza, el motor DEBE lanzar `WorkflowGuardRejectedException` con HTTP 422 y detalle del criterio faltante.

**EARS-15.** Al aprobar todos los guards, el motor DEBE:
- Actualizar `zona_actual` a la nueva zona
- Sembrar items de checklist para la zona destino
- Emitir `ouv.avance_zona`
- Registrar en `audit_log`

### 3.5 Retroceso de zona (EARS-16 a EARS-18)

**EARS-16.** El Ejecutivo Comercial dueño DEBE poder degradar la OUV a la zona previa vía `POST /discovery/ouvs/:id/retroceder`, aportando `motivo` (TEXT obligatorio).

**EARS-17.** El motor DEBE:
- Actualizar `zona_actual` a la zona previa
- Preservar los items de checklist ya marcados
- Emitir `ouv.retroceso_zona` con `payload.motivo`

**EARS-18.** No se permite retroceder desde UNIVERSO. Retroceder desde UNIVERSO se hace vía Descartada.

### 3.6 Gestión de influencias (EARS-19 a EARS-21)

**EARS-19.** El Ejecutivo Comercial dueño DEBE poder actualizar cada `ouv_influencias` con: nuevo `estado`, `contacto_ouv_id` (opcional, FK a `ouv_contactos`), `motivo_estado`, `notas`.

**EARS-20.** El `contacto_ouv_id` asignado a una influencia DEBE existir en `ouv_contactos` **de la misma OUV**. Validar en el service que `ouv_contactos.ouv_id === ouv_influencias.ouv_id`.

**EARS-21.** Cada actualización de influencia DEBE disparar `ouv.influencia_cambio` en el motor. El evento invoca `CriteriosZonaEvaluator.evaluate(ouv)` como side effect.

### 3.7 Checklist de zona (EARS-22 a EARS-24)

**EARS-22.** El Ejecutivo Comercial dueño DEBE poder marcar/desmarcar items del checklist de la zona actual.

**EARS-23.** Al marcar un item, registrar `marcado_at = NOW()` y `marcado_por = actor`. Al desmarcar, ambos vuelven a NULL.

**EARS-24.** Cada marcado/desmarcado DEBE disparar `ouv.checklist_item_marcado` invocando `CriteriosZonaEvaluator`.

### 3.8 Presupuesto (EARS-25 a EARS-26)

**EARS-25.** El Ejecutivo Comercial dueño DEBE poder actualizar los campos de presupuesto.

**EARS-26.** Cambios en presupuesto DEBEN disparar `ouv.presupuesto_actualizado` invocando `CriteriosZonaEvaluator`.

### 3.9 Alerta de gap (EARS-27 a EARS-29)

**EARS-27.** `CriteriosZonaEvaluator.evaluate(ouv)` DEBE consultar los guards duros aplicables a la zona actual y retornar `{ tieneGap, criteriosFaltantes[] }`, persistiendo en la OUV.

**EARS-28.** Cuando `tiene_gap` transiciona de `false` a `true`, disparar `ouv.criterios_perdidos` (con `dedup_key` para prevenir spam).

**EARS-29.** Cuando `tiene_gap` transiciona de `true` a `false`, disparar `ouv.criterios_recuperados` (silencioso).

### 3.10 Cierre (EARS-30 a EARS-34)

**EARS-30.** El Ejecutivo Comercial dueño DEBE poder marcar cierre Ganada vía `POST /discovery/ouvs/:id/ganar`.

**EARS-31.** Guards para Ganada:
- `guardEntidadEnEstado('OUV', 'MAYOR_PROBABILIDAD')` — regla estricta, sin excepciones en Wave 1

**EARS-32.** El Ejecutivo Comercial dueño DEBE poder marcar cierre Perdida vía `POST /discovery/ouvs/:id/perder`, con `motivo_id` (obligatorio), `monto_estimado_perdido` (obligatorio), `competidor_ganador` (obligatorio si motivo lo requiere).

**EARS-33.** El Ejecutivo Comercial dueño DEBE poder marcar cierre Descartada vía `POST /discovery/ouvs/:id/descartar` con `motivo_id` obligatorio.

**EARS-34.** En cualquier cierre, el sistema DEBE:
- Persistir `motivo_snapshot` (inmutable)
- Setear `fecha_cierre = NOW()`
- Emitir el evento correspondiente con notificación a Soporte Comercial
- Solo Ganada: emitir `ouv.lista_para_implementacion` (destinatario Soporte)

### 3.11 Reapertura (postergada a Wave 2)

Sin funcionalidad en Wave 1.

---

## 4. Permisos CASL

| Acción | Ejecutivo Comercial (dueño) | Soporte Comercial | Otros |
|---|---|---|---|
| Ver OUV propia | ✅ | ✅ (todas) | ❌ |
| Crear OUV directa | ✅ | ❌ | ❌ |
| Actualizar contactos de OUV propia | ✅ | ❌ | ❌ |
| Actualizar influencias/checklist/presupuesto | ✅ (propias) | ❌ | ❌ |
| Solicitar avance/retroceso de zona | ✅ (propias) | ❌ | ❌ |
| Cerrar Ganada (desde MAYOR_PROBABILIDAD) | ✅ (propias) | ❌ | ❌ |
| Cerrar Perdida / Descartada | ✅ (propias) | ❌ | ❌ |
| CRUD `motivos_perdida` / `motivos_descarte` | ❌ | ✅ | ❌ |
| CRUD `zona_checklist_templates` | ❌ | ✅ | ❌ |

---

## 5. Guards nuevos del motor

- `guardPresupuestoConfirmado(ouv)` — retorna `ouv.presupuesto_confirmado === true`
- `guard2InfluenciasEnVerde(ouv, deps)` — consulta `ouv_influencias`, retorna `count(Verde) >= 2`
- `guardUsuarioEsComercialDelOUV(ouv, ctx)` — retorna `ctx.actorUserId === ouv.comercial_id`

---

## 6. Eventos nuevos del motor

- `ouv.creada_desde_sql`
- `ouv.creada_directa`
- `ouv.avance_zona`
- `ouv.retroceso_zona`
- `ouv.contacto_creado` (opcional — evalúa si vale audit_log-only o notif)
- `ouv.contacto_eliminado`
- `ouv.influencia_cambio`
- `ouv.checklist_item_marcado`
- `ouv.presupuesto_actualizado`
- `ouv.criterios_perdidos` (con dedup_key)
- `ouv.criterios_recuperados`
- `ouv.ganada`
- `ouv.perdida`
- `ouv.descartada`
- `ouv.lista_para_implementacion`

**Migración de regla existente:** la regla `ouv.creada` (después de PR-3') se renombra a `ouv.creada_desde_sql`. Los eventos previos en `notifications` se dejan como histórico.

---

## 7. Componentes NestJS

### 7.1 `OUVService`
CRUD básico + métodos de acción: `crearDesdeSQL`, `crearDirecta`, `avanzar`, `retroceder`, `ganar`, `perder`, `descartar`. Cada método sigue el contrato de la regla `800-workflow-transitions.mdc`.

### 7.2 `OUVContactosService` (NUEVO v1.2)
- `crearDesdeLead(ouvId, leadId, transaction)` — invocado durante `crearDesdeSQL` para copiar contactos del lead
- `crear(ouvId, dto, actorUserId)` — creación manual desde UI
- `actualizar(contactoOuvId, dto, actorUserId)`
- `eliminar(contactoOuvId, actorUserId)` — soft-delete + limpieza de FK en `ouv_influencias`
- `listByOuv(ouvId)`

### 7.3 `OUVInfluenciasService`
- `listByOuv(ouvId)`
- `actualizarEstado(ouvId, tipo, dto)` — dispara `ouv.influencia_cambio`. Valida que `contacto_ouv_id` pertenece a la misma OUV
- `seedInfluenciasParaOuv(ouvId, transaction)` — invocado tras creación de OUV

### 7.4 `OUVChecklistService`
Sin cambios respecto a v1.1.

### 7.5 `CriteriosZonaEvaluator`
Sin cambios respecto a v1.1.

### 7.6 `CatalogoMotivosService` y `ZonaTemplateService`
Sin cambios respecto a v1.1. CRUD por Soporte Comercial.

---

## 8. UX / Pantallas

### 8.1 Bandeja del Ejecutivo Comercial
Sin cambios respecto a v1.1. Vista dual lista/Kanban con filtros mínimos.

### 8.2 Bandeja del Soporte Comercial
Sin cambios respecto a v1.1.

### 8.3 OUV — Detalle
Layout de secciones colapsables:
- Encabezado con badges
- Banner de alerta si `tiene_gap`
- **Panel de contactos (NUEVO v1.2):** lista de `ouv_contactos` de la OUV con acciones agregar/editar/eliminar. Muestra si el contacto está asignado a alguna influencia (badge). En Vía 1 aparecen ya poblados desde el lead.
- Panel de influencias: 3 tarjetas con semáforo editable + selector de contacto (dropdown desde `ouv_contactos` de la OUV) + notas
- Panel de presupuesto
- Panel de checklist
- Sección de cierre (visible si `resultado !== EnCurso`)
- Sección de auditoría

### 8.4 Modal de "Crear OUV directa"
Sin cambios respecto a v1.1.

### 8.5 Modal de "Agregar contacto" (NUEVO v1.2)
Formulario con: nombre (obligatorio), cargo, email, telefono, notas. Al confirmar: POST /discovery/ouvs/:id/contactos.

### 8.6 Modal de transición (avance)
Sin cambios.

### 8.7 Modal de retroceso
Sin cambios.

### 8.8 Modal de cierre (Ganada / Perdida / Descartada)
Sin cambios.

### 8.9 Pantallas de administración (rol SoporteComercial)
Sin cambios respecto a v1.1.

---

## 9. Consumo del motor de workflow

Todas las transiciones y side effects pasan por `WorkflowEngineService.transition()` siguiendo el contrato de la regla `800-workflow-transitions.mdc`. Ver skill `workflow-engine-pattern`.

---

## 10. Fuera de alcance (Wave 2 o después)

- Override de Ganada
- Reapertura de OUV cerrada
- KPI snapshots mensuales
- Vista de seguimiento para Marketing
- Modelo unificado de contactos Lead↔OUV↔Cuenta (Módulo 12)
- Tabla `ouv_actividades` formal
- Editor visual de reglas del motor
- Notificaciones por email/SMS
- Influencias adicionales más allá de las 3 fijas
- Segmentación de reglas por segmento
- Filtros avanzados en bandeja
- Predicción de cierre basada en histórico
- Catálogo administrable de verticales
- Sincronización posterior lead↔OUV para contactos
