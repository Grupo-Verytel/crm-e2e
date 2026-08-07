# Spec — Módulo 2: OUV Funnel (Embudo Comercial Verytel)
**Versión:** 1.0
**Fecha:** 2026-08-05
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Pendiente de aprobación para implementación
**Depende de:** `spec-calificacion.md` v2.0 (entrada: OUV creada en zona UNIVERSO), `spec-workflow-engine.md` v1.1 (motor consumido en todas las transiciones)
**Referencia de negocio:** `FILTROS_EMBUDO_COMERCIAL_v5.pdf` (embudo Verytel tipo MEDDIC)
**Decisiones estructurales:** DR-2026-08-B

---

## 1. Alcance

Cubre el ciclo de vida completo de la OUV a través de 4 zonas formales del embudo comercial, incluyendo:

- Transiciones de zona (avance y retroceso)
- Gestión de influencias compradoras (Económica / Técnica / Fábrica) con estado semáforo
- Checklist de criterios por zona (subjetivos declarativos)
- Presupuesto estructurado
- Alertas automáticas de gap de criterios
- Cierre (Ganada / Perdida / Descartada) y reapertura
- Bandeja del Ejecutivo Comercial y del Director Comercial

**Entrada:** OUV recién creada en `zona_actual = UNIVERSO`, `resultado = EnCurso` (proveniente de `spec-calificacion.md` v2.0 EARS-12).

**Salida:** OUV cerrada (Ganada → Módulo 7 Paso a Implementación; Perdida/Descartada → terminal para KPIs).

---

## 2. Modelo de datos

### 2.1 Tabla `ouvs`

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `ouv_id` | UUID | Sí (PK) | — |
| `consecutivo` | VARCHAR(20) | Sí | Formato `OUV-####` (generado con skill `generar-consecutivo`) |
| `sql_id_origen` | UUID | Sí (FK sqls) | SQL desde el que se creó |
| `comercial_id` | UUID | Sí (FK users) | Dueño exclusivo |
| `cuenta_id` | UUID | No (FK cuentas) | Nullable en Wave 1 (Módulo 12 pendiente) |
| `titulo` | VARCHAR(200) | Sí | Nombre corto de la oportunidad |
| `descripcion` | TEXT | No | — |
| `segmento` | ENUM(Gobierno, DefensaSeguridad, ProyectosEspeciales, B2B) | Sí | — |
| `vertical` | VARCHAR(80) | Sí | Catálogo Verytel |
| **Zona y resultado** | | | |
| `zona_actual` | ENUM(UNIVERSO, ENCIMA_FUNNEL, EN_FUNNEL, MAYOR_PROBABILIDAD) | Sí | Default UNIVERSO |
| `resultado` | ENUM(EnCurso, Ganada, Perdida, Descartada) | Sí | Default EnCurso |
| **Gap de criterios** | | | |
| `tiene_gap` | BOOLEAN | Sí | Default false — mantenido por `CriteriosZonaEvaluator` |
| `criterios_faltantes` | JSON | No | Array de códigos de criterios faltantes |
| **Presupuesto (P2)** | | | |
| `presupuesto_confirmado` | BOOLEAN | Sí | Default false — guard duro para ENCIMA_FUNNEL |
| `presupuesto_monto` | DECIMAL(18,2) | No | — |
| `presupuesto_moneda` | ENUM(COP, USD) | No | Extensible en Wave 2 |
| `presupuesto_fecha_captura` | TIMESTAMPTZ | No | — |
| `presupuesto_fuente` | ENUM(cliente_declaro, contrato_previo, licitacion_publicada, estimacion_comercial, sin_verificar) | No | — |
| **Cierre** | | | |
| `motivo_id` | UUID | No | FK a `motivos_perdida` o `motivos_descarte` según `resultado` |
| `motivo_snapshot` | VARCHAR(200) | No | Nombre del motivo al momento del cierre (inmutable) |
| `motivo_detalle` | TEXT | No | Obligatorio si motivo = "Otro" |
| `competidor_ganador` | VARCHAR(200) | No | Solo si motivo Perdida = "Ganó competidor" |
| `monto_final` | DECIMAL(18,2) | No | Obligatorio si `resultado = Ganada` |
| `moneda_final` | ENUM(COP, USD) | No | Obligatorio si `resultado = Ganada` |
| `monto_estimado_perdido` | DECIMAL(18,2) | No | Obligatorio si `resultado = Perdida` |
| `fecha_cierre` | TIMESTAMPTZ | No | Auto al marcar cierre |
| **Reapertura y override** | | | |
| `zona_antes_cierre` | ENUM (4 zonas) | No | Guardado al cerrar, usado al reabrir |
| `motivo_reapertura_id` | UUID | No | FK `motivos_reapertura`, snapshot como los otros |
| `motivo_reapertura_snapshot` | VARCHAR(200) | No | — |
| `fecha_reapertura` | TIMESTAMPTZ | No | Auto al reabrir |
| `override_ganada_aplicado` | BOOLEAN | Sí | Default false |
| `override_motivo` | TEXT | No | Obligatorio si `override_ganada_aplicado = true` |
| **Auditoría estándar** | | | |
| `created_at` / `updated_at` | TIMESTAMPTZ | Sí | — |

### 2.2 Tabla `ouv_influencias` (3 filas por OUV, seed automático)

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `influencia_id` | UUID | Sí (PK) | — |
| `ouv_id` | UUID | Sí (FK ouvs) | — |
| `tipo` | ENUM(Economica, Tecnica, Fabrica) | Sí | UNIQUE compuesto con `ouv_id` — solo una fila por tipo por OUV |
| `estado` | ENUM(Verde, Rojo, Amarillo, SinEvaluar) | Sí | Default SinEvaluar |
| `contacto_id` | UUID | No (FK contactos) | Reutiliza tabla existente del ciclo de leads |
| `contacto_nombre_snapshot` | VARCHAR(160) | No | Inmutable al momento del último cambio |
| `contacto_cargo_snapshot` | VARCHAR(120) | No | — |
| `contacto_email_snapshot` | VARCHAR(160) | No | — |
| `notas` | TEXT | No | — |
| `motivo_estado` | TEXT | No | Por qué está en Rojo/Amarillo |
| `fecha_ultimo_cambio` | TIMESTAMPTZ | No | Auto al UPDATE |
| `created_at` | TIMESTAMPTZ | Sí | — |

**Seed automático:** al crear una OUV (`ouv.creada`), el sistema inserta 3 filas — una por cada tipo — en `estado = SinEvaluar`.

### 2.3 Tabla `ouv_checklist_items` (T3 con timestamp)

| Campo | Tipo | Oblig. | Descripción |
|---|---|---|---|
| `item_id` | UUID | Sí (PK) | — |
| `ouv_id` | UUID | Sí (FK ouvs) | — |
| `zona` | ENUM (4 zonas) | Sí | Zona a la que pertenece el criterio |
| `codigo_item` | VARCHAR(60) | Sí | Identificador del criterio (ej. `impacto_mision`, `reputacion`) |
| `label` | VARCHAR(200) | Sí | Texto visible del criterio (snapshot desde plantilla) |
| `marcado` | BOOLEAN | Sí | Default false |
| `marcado_at` | TIMESTAMPTZ | No | Auto al marcar true |
| `marcado_por` | UUID | No | FK users |
| `created_at` | TIMESTAMPTZ | Sí | — |

**Seed automático:** al transicionar la OUV a una zona nueva (`ouv.avance_zona` o `ouv.retroceso_zona`), el sistema:
1. Consulta `zona_checklist_templates` para la zona destino
2. Inserta filas correspondientes en `ouv_checklist_items` (si no existen ya para esa OUV/zona)
3. Las filas de zonas ya visitadas se preservan (retroceso no borra checklist previo)

### 2.4 Catálogos administrables

**`zona_checklist_templates`** — plantillas de checklist por zona
- `template_id` UUID PK
- `zona` ENUM (4 zonas)
- `codigo_item` VARCHAR(60) — único por zona
- `label` VARCHAR(200)
- `orden` INT — para render
- `activo` BOOLEAN — soft delete
- CRUD por rol Director Comercial

**`motivos_perdida`, `motivos_descarte`, `motivos_reapertura`** — catálogos de motivos
- `motivo_id` UUID PK
- `nombre` VARCHAR(200)
- `descripcion` TEXT
- `requiere_detalle` BOOLEAN — si es true, obliga `motivo_detalle` en la OUV
- `orden` INT
- `activo` BOOLEAN — soft delete
- CRUD por rol Director Comercial

### 2.5 Snapshot mensual de KPIs (para reapertura sin corrupción de histórico)

**`kpi_snapshots_mensuales`**
- `snapshot_id` UUID PK
- `mes` DATE (primer día del mes)
- `comercial_id` UUID FK users nullable (null = agregado global)
- `total_ganadas`, `total_perdidas`, `total_descartadas` INT
- `monto_ganado` DECIMAL
- `winrate_calculado` DECIMAL(5,4)
- `created_at` TIMESTAMPTZ
- Job cron el día 1 de cada mes calcula y persiste este snapshot antes de que las reaperturas alteren el estado

---

## 3. Criterios EARS

### 3.1 Creación (EARS-01 a EARS-03)

**EARS-01.** Al crear una OUV (viene de `spec-calificacion.md` v2.0 EARS-12), el sistema DEBE inicializar:
- `zona_actual = UNIVERSO`, `resultado = EnCurso`
- Tres filas en `ouv_influencias` (Economica, Tecnica, Fabrica) en estado `SinEvaluar`
- Items de checklist para zona UNIVERSO desde `zona_checklist_templates`
- Consecutivo `OUV-####` generado con skill `generar-consecutivo`

**EARS-02.** El sistema DEBE registrar `ouv.creada` en el motor de workflow con destinatarios: Director Comercial + Soporte Comercial (informativos).

**EARS-03.** La OUV DEBE nacer sin gap: `tiene_gap = false`, `criterios_faltantes = null`.

### 3.2 Avance de zona (EARS-04 a EARS-07)

**EARS-04.** El Ejecutivo Comercial dueño DEBE poder solicitar avance a la zona siguiente vía `POST /ouvs/:id/avanzar`.

**EARS-05.** El motor DEBE validar los siguientes guards según zona destino:

| Zona destino | Guards |
|---|---|
| ENCIMA_FUNNEL | `guardEntidadEnEstado('OUV', 'UNIVERSO')` + `guardPresupuestoConfirmado` |
| EN_FUNNEL | `guardEntidadEnEstado('OUV', 'ENCIMA_FUNNEL')` + `guard2InfluenciasEnVerde` |
| MAYOR_PROBABILIDAD | `guardEntidadEnEstado('OUV', 'EN_FUNNEL')` + `guard2InfluenciasEnVerde` |

**EARS-06.** Si un guard rechaza, el motor DEBE lanzar `WorkflowGuardRejectedException` con HTTP 422 y detalle del criterio faltante.

**EARS-07.** Al aprobar todos los guards, el motor DEBE:
- Actualizar `zona_actual` a la nueva zona
- Sembrar items de checklist para la zona destino (si no existen)
- Emitir `ouv.avance_zona` con notificación informativa al Director Comercial
- Registrar en `audit_log`

### 3.3 Retroceso de zona (EARS-08 a EARS-10)

**EARS-08.** El Ejecutivo Comercial dueño DEBE poder degradar la OUV a la zona previa vía `POST /ouvs/:id/retroceder`, aportando `motivo` (TEXT obligatorio).

**EARS-09.** El motor DEBE:
- Actualizar `zona_actual` a la zona previa
- Preservar los items de checklist ya marcados de la zona actual (no se borran)
- Emitir `ouv.retroceso_zona` con `payload.motivo` incluido
- Registrar en `audit_log` (incluyendo motivo)

**EARS-10.** El sistema NO DEBE permitir retroceder desde UNIVERSO (es zona inicial). Retroceder desde UNIVERSO se hace vía Descartada.

### 3.4 Gestión de influencias (EARS-11 a EARS-14)

**EARS-11.** El Ejecutivo Comercial dueño DEBE poder actualizar cada `ouv_influencias` con: nuevo `estado`, `contacto_id` (opcional), `motivo_estado` (recomendado si Rojo/Amarillo), `notas`.

**EARS-12.** Al asignar `contacto_id`, el sistema DEBE poblar los `_snapshot` con los datos actuales del contacto en `contactos`. Si el contacto se actualiza después, los snapshots permanecen inmutables.

**EARS-13.** Cada actualización de influencia DEBE disparar `ouv.influencia_cambio` en el motor, con `payload` incluyendo `tipo`, `estado_anterior`, `estado_nuevo`.

**EARS-14.** El evento `ouv.influencia_cambio` DEBE invocar `CriteriosZonaEvaluator.evaluate(ouv)` como side effect, que actualiza `tiene_gap` y `criterios_faltantes`.

### 3.5 Checklist de zona (EARS-15 a EARS-17)

**EARS-15.** El Ejecutivo Comercial dueño DEBE poder marcar/desmarcar items del checklist de la zona actual.

**EARS-16.** Al marcar un item (`marcado = true`), el sistema DEBE registrar `marcado_at = NOW()` y `marcado_por = actor`. Al desmarcar, ambos vuelven a null.

**EARS-17.** Cada marcado/desmarcado DEBE disparar `ouv.checklist_item_marcado` invocando `CriteriosZonaEvaluator` como side effect.

### 3.6 Presupuesto (EARS-18 a EARS-19)

**EARS-18.** El Ejecutivo Comercial dueño DEBE poder actualizar los campos de presupuesto (`presupuesto_confirmado`, `presupuesto_monto`, `presupuesto_moneda`, `presupuesto_fecha_captura`, `presupuesto_fuente`).

**EARS-19.** Cambios en presupuesto DEBEN disparar `ouv.presupuesto_actualizado` invocando `CriteriosZonaEvaluator` como side effect.

### 3.7 Alerta de gap (EARS-20 a EARS-22)

**EARS-20.** `CriteriosZonaEvaluator.evaluate(ouv)` DEBE:
- Consultar los guards duros aplicables a la zona actual (`presupuesto_confirmado` si ENCIMA_FUNNEL o superior; `2 influencias en verde` si EN_FUNNEL o superior)
- Retornar `{ tieneGap: boolean, criteriosFaltantes: string[] }`
- Persistir el resultado en `ouv.tiene_gap` y `ouv.criterios_faltantes`

**EARS-21.** Cuando `tiene_gap` transiciona de `false` a `true`, el sistema DEBE disparar `ouv.criterios_perdidos` con destinatario = `comercial_id`. El `dedup_key` (`ouv.criterios_perdidos:${ouv_id}:${comercial_id}`) previene notificación repetida.

**EARS-22.** Cuando `tiene_gap` transiciona de `true` a `false`, el sistema DEBE disparar `ouv.criterios_recuperados` (silencioso, sin toast — solo actualiza estado de la notificación previa marcándola resuelta).

### 3.8 Cierre (EARS-23 a EARS-29)

**EARS-23.** El Ejecutivo Comercial dueño DEBE poder marcar cierre Ganada vía `POST /ouvs/:id/ganar`, aportando `motivo_id` (opcional; puede no aplicar), `monto_final`, `moneda_final`.

**EARS-24.** Guards para Ganada:
- `guardEntidadEnEstado('OUV', 'MAYOR_PROBABILIDAD')` — regla estricta

**EARS-25.** Excepción de Ganada: rol Director Comercial DEBE poder aplicar override vía `POST /ouvs/:id/ganar-con-override` desde cualquier zona activa, aportando `override_motivo` (TEXT obligatorio). El sistema marca `override_ganada_aplicado = true`.

**EARS-26.** El Ejecutivo Comercial dueño DEBE poder marcar cierre Perdida vía `POST /ouvs/:id/perder`, aportando `motivo_id` (obligatorio), `monto_estimado_perdido` (obligatorio), `competidor_ganador` (obligatorio si motivo requiere).

**EARS-27.** El Ejecutivo Comercial dueño DEBE poder marcar cierre Descartada vía `POST /ouvs/:id/descartar`, aportando `motivo_id` (obligatorio) desde catálogo `motivos_descarte`.

**EARS-28.** En cualquier cierre, el sistema DEBE:
- Persistir `motivo_snapshot` desde el motivo seleccionado (inmutable si el motivo se edita después)
- Guardar `zona_antes_cierre = zona_actual`
- Setear `fecha_cierre = NOW()`
- Emitir el evento correspondiente (`ouv.ganada` | `ouv.perdida` | `ouv.descartada`) con notificación a Director Comercial

**EARS-29.** Ganada DEBE disparar además evento hacia Módulo 7 (Paso a Implementación): `ouv.lista_para_implementacion` con destinatario rol `SoporteComercial` (que habilita el paso). El manejo detallado vive en la spec de Módulo 7 (pendiente).

### 3.10 Reapertura (EARS-30 a EARS-32)

**EARS-30.** Solo rol Director Comercial DEBE poder reabrir una OUV cerrada vía `POST /ouvs/:id/reabrir`, aportando `motivo_reapertura_id` (obligatorio desde catálogo `motivos_reapertura`).

**EARS-31.** Al reabrir, el sistema DEBE:
- Restaurar `zona_actual = zona_antes_cierre`
- Setear `resultado = EnCurso`
- Persistir `motivo_reapertura_snapshot` y `fecha_reapertura`
- Emitir `ouv.reabierta` con notificación al comercial dueño (informativa)
- Registrar en `audit_log`

**EARS-32.** Los KPIs mensuales calculados vía snapshot en `kpi_snapshots_mensuales` NO DEBEN alterarse al reabrir. Solo los KPIs "en tiempo real" (dashboards del mes en curso) reflejan el cambio.

---

## 4. Permisos CASL

| Acción | Ejecutivo Comercial (dueño) | Director Comercial | Otros |
|---|---|---|---|
| Ver OUV propia | ✅ | ✅ (todas) | ❌ |
| Actualizar influencias/checklist/presupuesto | ✅ | ✅ (todas) | ❌ |
| Solicitar avance/retroceso de zona | ✅ | ✅ (todas) | ❌ |
| Cerrar Ganada (desde MAYOR_PROBABILIDAD) | ✅ | ✅ | ❌ |
| Cerrar Ganada con override (desde otra zona) | ❌ | ✅ | ❌ |
| Cerrar Perdida | ✅ | ✅ | ❌ |
| Cerrar Descartada | ✅ | ✅ | ❌ |
| Reabrir OUV cerrada | ❌ | ✅ | ❌ |
| CRUD de catálogos (motivos, plantillas) | ❌ | ✅ | ❌ |

---

## 5. Guards nuevos del motor

Los siguientes guards se agregan a `guards/` del motor de workflow. Todos operan sync con la entidad ya cargada + contexto:

- **`guardPresupuestoConfirmado(ouv)`** — retorna `ouv.presupuesto_confirmado === true`
- **`guard2InfluenciasEnVerde(ouv, deps)`** — consulta `ouv_influencias` de la OUV, cuenta filas con `estado = Verde`, retorna `count >= 2`
- **`guardChecklistZonaCumplido(ouv, deps, zona)`** — opcional, no obligatorio en Wave 1 (los items son declarativos, no bloquean)
- **`guardUsuarioEsComercialDelOUV(ouv, ctx)`** — retorna `ctx.actorUserId === ouv.comercial_id`
- **`guardRolDirectorComercial(ctx, deps)`** — reutiliza `guardUsuarioTieneRol('DirectorComercial')` ya existente

---

## 6. Eventos nuevos del motor

Todos siguen la convención `entidad.accion_en_pasado`:

- `ouv.creada` — al crear OUV
- `ouv.avance_zona` — transición hacia zona siguiente
- `ouv.retroceso_zona` — degradación manual
- `ouv.influencia_cambio` — semáforo de influencia cambió
- `ouv.checklist_item_marcado` — comercial marcó/desmarcó item
- `ouv.presupuesto_actualizado` — cambio en presupuesto
- `ouv.criterios_perdidos` — alerta al detectar gap (idempotente vía dedup_key)
- `ouv.criterios_recuperados` — silencioso, resuelve alerta previa
- `ouv.ganada` — cierre exitoso
- `ouv.perdida` — cierre no exitoso
- `ouv.descartada` — descarte por decisión propia
- `ouv.reabierta` — reapertura por Director
- `ouv.lista_para_implementacion` — post-Ganada, notifica a Soporte Comercial

Cada evento vive como entrada en `workflow.rules.ts`. Ver skill `workflow-engine-pattern` para el patrón de invocación.

---

## 7. Componentes NestJS

### 7.1 `OUVService`
- CRUD básico + métodos de acción: `avanzar`, `retroceder`, `ganar`, `ganarConOverride`, `perder`, `descartar`, `reabrir`
- Cada método invoca `workflowEngine.transition()` dentro de transacción, no escribe estado directamente

### 7.2 `OUVInfluenciasService`
- CRUD sobre `ouv_influencias`
- Método `actualizarEstado(ouvId, tipo, dto)` que dispara `ouv.influencia_cambio`

### 7.3 `OUVChecklistService`
- Método `marcarItem(itemId, marcado)` que dispara `ouv.checklist_item_marcado`
- Método `seedChecklistParaZona(ouvId, zona, transaction)` invocado por el motor tras `avance_zona`/`retroceso_zona`

### 7.4 `CriteriosZonaEvaluator`
- Servicio puro (sin side effects propios) con método `evaluate(ouv): { tieneGap, criteriosFaltantes[] }`
- Invocado como side effect en `ouv.influencia_cambio`, `ouv.checklist_item_marcado`, `ouv.presupuesto_actualizado`
- Persiste `ouv.tiene_gap` y `ouv.criterios_faltantes` dentro de la transacción

### 7.5 `KPISnapshotJob`
- Cron mensual (día 1 a las 00:05) que calcula agregados y persiste en `kpi_snapshots_mensuales`
- Reutilizable como servicio manual para recálculo puntual

### 7.6 `CatalogoMotivosService` y `ZonaTemplateService`
- CRUD estándar sobre catálogos
- Guards CASL para restringir a Director Comercial

---

## 8. UX / Pantallas

### 8.1 Bandeja del Ejecutivo Comercial (default)
- **Vista dual:** toggle Lista / Kanban (consistente con Módulo 1 patrón)
- **Lista:** columnas: consecutivo, título, cuenta, zona (badge), gap (badge amarillo si aplica), monto presupuesto, última actividad, acciones
- **Kanban:** 4 columnas (zonas), OUVs como cards. Arrastrar abre modal de transición (no transiciona directo)
- **Orden default:** `updated_at DESC`
- **Filtros:** zona (multi-select), gap (sí/no/todos), texto libre (búsqueda por título/consecutivo/cuenta), rango `created_at`
- **Paginación:** reutiliza `Pagination.tsx`

### 8.2 Bandeja del Director Comercial
- Mismo componente, permisos CASL más amplios
- Columna adicional: comercial dueño
- Filtro adicional: por comercial
- Acciones adicionales: override Ganada, reabrir OUV cerrada

### 8.3 OUV — Detalle
Layout de secciones colapsables:
- **Encabezado:** consecutivo, título, badge de zona, badge de resultado, botones (Avanzar / Retroceder / Cerrar)
- **Banner de alerta:** si `tiene_gap = true`, banner amarillo con lista de `criterios_faltantes`
- **Panel de influencias:** 3 tarjetas (Económica, Técnica, Fábrica) con semáforo editable + contacto asignado + motivo/notas
- **Panel de presupuesto:** formulario con confirmado + monto + moneda + fuente + fecha
- **Panel de checklist:** items de la zona actual (y de zonas ya visitadas colapsados por defecto)
- **Sección de cierre:** visible cuando `resultado !== EnCurso`, muestra motivo, monto, competidor, fecha
- **Sección de auditoría:** historial de transiciones desde `audit_log`

### 8.4 Modal de transición (avance)
- Muestra el checklist de la zona destino con estado actual
- Lista los guards que se van a evaluar
- Botón "Confirmar avance" — dispara EARS-04
- Si un guard falla, muestra mensaje del filtro de excepciones (HTTP 422)

### 8.5 Modal de retroceso
- Selector de motivo (texto libre TEXT obligatorio en Wave 1; catálogo `motivos_retroceso` opcional Wave 2)
- Botón "Confirmar retroceso"

### 8.6 Modal de cierre (Ganada / Perdida / Descartada)
- Formulario dinámico según resultado seleccionado
- Ganada: motivo (opcional) + monto + moneda
- Perdida: motivo (obligatorio) + monto estimado perdido + competidor (si aplica)
- Descartada: motivo (obligatorio)
- Botón "Confirmar cierre"

### 8.7 Modal de override (Ganada desde otra zona)
- Visible solo a Director Comercial
- Formulario: motivo override (obligatorio) + monto + moneda + motivo Ganada (opcional)

### 8.8 Modal de reapertura
- Visible solo a Director Comercial en OUVs cerradas
- Selector de motivo desde catálogo `motivos_reapertura`
- Confirma restauración a `zona_antes_cierre`

### 8.9 Pantallas de administración (rol Director Comercial)
- CRUD de `motivos_perdida`, `motivos_descarte`, `motivos_reapertura`
- CRUD de `zona_checklist_templates` (con selector de zona)

---

## 9. Consumo del motor de workflow

Todas las transiciones y side effects pasan por `WorkflowEngineService.transition()`. Los services de dominio de este módulo NO escriben en `notifications` a mano ni actualizan estados directamente — todo pasa por el motor. Ver skill `workflow-engine-pattern` para el patrón obligatorio de invocación.

---

## 10. Fuera de alcance de esta spec (Wave 2 o después)

- **Modelo unificado de contactos** Lead↔OUV↔Cuenta (depende de Módulo 12)
- **Tabla `ouv_actividades` formal** (T2) — si adopción del checklist con timestamp lo justifica
- **Reglas automáticas de degradación** — degradación sigue siendo manual
- **Editor visual de reglas del motor** o versionamiento de flujos
- **Notificaciones por email/SMS** — solo in-app en Wave 1
- **Influencias adicionales** más allá de las 3 fijas (Económica, Técnica, Fábrica)
- **Segmentación de reglas por segmento** (Gobierno vs D&S vs B2B con guards distintos)
- **Preferencias de notificación por usuario**
- **Filtros avanzados** en bandeja (segmento, vertical, rango monto, orden manual)
- **Predicción de cierre basada en histórico** — Módulo 13 Reportería
- **Análisis automático de "descuento aplicado en negociación"** — KPI derivado Wave 2
