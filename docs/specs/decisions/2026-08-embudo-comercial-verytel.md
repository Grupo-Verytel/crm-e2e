# DR-2026-08-B — Embudo Comercial Verytel: descubrimiento y decisiones estructurales del Módulo 2

**Fecha original:** 2026-08-05
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Aceptado — con dos adendas (2026-08-07 A y B)

---

## Contexto y descubrimiento

Durante el arranque de Módulo 2 se identificó que el CRM debe soportar **dos embudos coexistentes**, no uno:

1. **Embudo de Marketing** (ya implementado en Módulo 1): `TOFU → MOFU → BOFU → SQL` — lógica de calentamiento de contactos, operado por Director/Gestor de Mercadeo.

2. **Embudo Comercial** (recién descubierto en el PDF v5): `UNIVERSO → ENCIMA_FUNNEL → EN_FUNNEL → MAYOR_PROBABILIDAD → Cierre` — lógica de calificación de oportunidad tipo MEDDIC / Miller Heiman, operado por el Ejecutivo Comercial una vez recibe un SQL asignado.

Estos embudos son **secuenciales**: Marketing termina en SQL; Comercial arranca cuando ese SQL se convierte en OUV. No son alternativos, no son intercambiables. Son dos ciclos de vida distintos sobre entidades distintas (LEAD/MQL/SQL vs OUV).

Este descubrimiento amplió sustancialmente el alcance del Módulo 2.

---

## Decisiones estructurales (v1.0 original)

### 1. Las 4 zonas del PDF son estados formales de la OUV
Valores de un enum `ouv.zona_actual` con guards de transición gestionados por el motor de workflow.

### 2. Modelo de cierre: zona + resultado separados
- `ouv.zona_actual` (ENUM 4 zonas) — dónde está en el funnel
- `ouv.resultado` (ENUM: EnCurso, Ganada, Perdida, Descartada) — cómo terminó

### 3. Avance y retroceso: ambos manuales
Avance: comercial declara "quiero pasar" y motor valida. Retroceso: comercial degrada con motivo obligatorio; sistema alerta ante gap pero no degrada solo.

### 4. Ganada solo desde MAYOR_PROBABILIDAD, con override justificado
> **⚠️ Revisada en adenda 2026-08-07-A:** override eliminado.

### 5. Criterios de zona: Camino B
Guards para criterios duros + checklist declarativo para subjetivos.

### 6. Influencias compradoras: 3 fijas + tabla propia
Económica, Técnica, Fábrica — sin variación por segmento en Wave 1.

### 7. Influencias vinculadas a contactos: FK opcional + snapshots
> **⚠️ Revisada en adenda 2026-08-07-A:** `contactos.lead_id` a nullable.
> **⚠️ Re-revisada en adenda 2026-08-07-B:** tabla `ouv_contactos` separada, sin FK a `contactos`. Ver adenda B.

### 8. Motivos de cierre: catálogos administrables
Dos catálogos: `motivos_perdida` y `motivos_descarte`. Soft-delete + snapshot.
> **⚠️ Revisada en adenda 2026-08-07-A:** CRUD reasignado a Soporte Comercial.

### 9. Campos obligatorios al cerrar: R1 estricto, lista mínima
Ganada: motivo + monto + moneda. Perdida: motivo + monto perdido + competidor si aplica. Descartada: solo motivo.

### 10. Monto final desacoplado del pricing PRI-####
Comercial captura el monto real tras negociación.

### 11. Reapertura: solo Director + KPIs con snapshot mensual
> **⚠️ Revisada en adenda 2026-08-07-A:** reapertura postergada a Wave 2.

### 12. Trabajo por hacer: T3 (checklist con timestamp)
Items del checklist de zona con `marcado_at`. No se crea tabla `ouv_actividades` en Wave 1.

### 13. Alerta de criterios perdidos: A2 reactivo por eventos
`CriteriosZonaEvaluator` invocado en cada evento relevante.

### 14. Presupuesto: P2 objeto estructurado sin tabla propia
Campos en la OUV: `presupuesto_confirmado` (guard duro), monto/moneda/fecha/fuente opcionales.

### 15. Bandeja del comercial: vista dual + orden por última actividad + filtros mínimos
Lista (default) + Kanban guiado. Consistente con Módulo 1.

### 16. Bandeja del Director Comercial reutiliza el componente
> **⚠️ Revisada en adenda 2026-08-07-A:** eliminada.

---

## ═══════════════════════════════════════════════════════════
## ADENDA 2026-08-07-A — Descarte del rol DirectorComercial + dos vías de OUV
## ═══════════════════════════════════════════════════════════

### Contexto

Revisando el Blueprint V2 se confirmó que el rol "DirectorComercial" **no existe** en Verytel. El rol comercial válido es únicamente `EjecutivoComercial` según blueprint. El término apareció en conversaciones de diseño para modelar capacidades que asumíamos requerían un rol superior; ese supuesto no fue validado contra el blueprint y se corrige.

Adicionalmente, se descubrió que una OUV puede nacer **sin lead origen** en ~10% del volumen (upsell, outbound puro, licitación pública descubierta).

### Decisiones revisadas

**A-D1 — Rol DirectorComercial descartado.** No se crea el rol. Capacidades reasignadas o postergadas.

**A-D2 — Override de Ganada postergado a Wave 2.** Guard `guardEntidadEnEstado('OUV', 'MAYOR_PROBABILIDAD')` queda estricto en Wave 1. Excepciones se resuelven fuera del CRM.

**A-D3 — Reapertura de OUV cerrada postergada a Wave 2.** Sin rol de gestión, no aplica en Wave 1. Los campos `zona_antes_cierre`, `motivo_reapertura_*`, `fecha_reapertura` no se crean.

**A-D4 — CRUD de catálogos reasignado a Soporte Comercial.** `motivos_perdida`, `motivos_descarte`, `zona_checklist_templates` administrados por Soporte.

**A-D5 — Notificaciones al crear OUV: solo Soporte Comercial.** Marketing verá vista de seguimiento agregada en Wave 2.

**A-D6 — Dos vías de creación de OUV.** Vía 1 (desde SQL, ~90%) + Vías 2/3/4 (directa, ~10%). Cualquier Ejecutivo puede crear OUV directa sin autorización adicional.

Consecuencias:
- `ouvs.sql_id_origen` nullable
- `ouvs.empresa_nombre` VARCHAR(200) NOT NULL nuevo (snapshot del cliente)
- `ouvs.origen_via` ENUM(desde_sql, directa) para queries explícitas
- Nueva regla del motor `ouv.creada_directa`

**A-D7 — Regla `ouv.creada` renombrada a `ouv.creada_desde_sql`.** Consecuencia técnica de A-D6.

**A-D8 — `contactos.lead_id` cambia a nullable.**
> **⚠️ REVERTIDA en adenda 2026-08-07-B.** Ver adenda B.

**A-D9 — Bandeja del Director Comercial eliminada.** La bandeja de Soporte cumple función parcial de vista transversal.

---

## ═══════════════════════════════════════════════════════════
## ADENDA 2026-08-07-B — Contactos de OUV en tabla separada
## ═══════════════════════════════════════════════════════════

### Contexto

Al analizar el patrón real de datos de Verytel, se estimó que en las Vías 2/3/4 (~10% del volumen de OUVs) **los contactos son casi todos nuevos**, sin contraparte en la tabla `contactos` de leads. Reutilizar una sola tabla con `lead_id` nullable resultaba en modelo forzado para un caso mayoritario donde no hay lead.

Se evaluó la opción de separar los contactos de OUV en una tabla propia (`ouv_contactos`) sin FK a `contactos`. Los pros (simplicidad, bounded contexts respetados, snapshots innecesarios, cero acoplamiento entre módulos) superaron los contras (duplicación en el 10% de casos con superposición Lead↔OUV, futura migración a modelo unificado más costosa en Módulo 12).

### Decisiones

**B-D1 — Nueva tabla `ouv_contactos`, sin FK a `contactos`.**
Propia del módulo `discovery`. Autocontenida. Con soft-delete estándar del proyecto.

Estructura:
- `contacto_ouv_id` UUID PK
- `ouv_id` UUID NOT NULL, FK ouvs
- `nombre` VARCHAR(120) NOT NULL
- `cargo` VARCHAR(80) NULLABLE
- `email` VARCHAR(180) NULLABLE
- `telefono` VARCHAR(20) NULLABLE
- `notas` TEXT NULLABLE
- `created_at`, `updated_at`, `deleted_at`

**B-D2 — Revertir A-D8: `contactos.lead_id` vuelve a NOT NULL.**
La tabla `contactos` recupera su schema original. Elimina el riesgo de queries en demand-generation que asumen NOT NULL.

**B-D3 — `ouv_influencias` simplifica: FK a `ouv_contactos`, sin snapshots.**
El campo `contacto_id` (FK a `contactos`) se reemplaza por `contacto_ouv_id` (FK a `ouv_contactos`, nullable). Los snapshots inmutables (`contacto_nombre_snapshot`, `contacto_cargo_snapshot`, `contacto_email_snapshot`) se eliminan — ya no son necesarios porque el contacto vive en tabla del propio módulo y no cambia por acciones externas.

**B-D4 — Contactos multi-propósito.**
El comercial puede crear filas en `ouv_contactos` libremente, sin necesidad de asignarlas a una influencia. Un contacto puede quedar en la OUV sin rol específico (referente general del proyecto, contacto administrativo, etc.).

**B-D5 — En Vía 1, se copian TODOS los contactos del lead al crear la OUV.**
Al crear una OUV desde SQL (evento `ouv.creada_desde_sql`), el sistema copia todas las filas de `contactos` asociadas al lead origen a `ouv_contactos`. La copia se hace en la misma transacción que crea la OUV.

Cada contacto copiado incluye: `nombre`, `cargo`, `email`, `telefono`. Se ignora el campo `position` de origen (no aplica en el módulo discovery). El campo `notas` queda vacío inicialmente.

**B-D6 — Los contactos copiados NO se auto-asignan a influencias.**
El sistema NO adivina cuál contacto corresponde a Económica, Técnica o Fábrica. Todas las influencias nacen con `contacto_ouv_id = NULL`. El comercial asigna manualmente después.

**B-D7 — Sin sincronización posterior entre lead y OUV.**
Una vez copiado, el vínculo se rompe. Si el equipo de marketing edita el lead o agrega contactos nuevos después de crear la OUV, esos cambios NO se propagan. La OUV es dueña de sus contactos y evoluciona independiente.

### Impacto en el modelo (vs adenda A)

| Elemento | Estado tras adenda B |
|---|---|
| `contactos.lead_id` | NOT NULL (revierte A-D8) |
| `ouv_contactos` (nueva tabla) | Creada, sin FK a `contactos` |
| `ouv_influencias.contacto_id` | Renombrado a `contacto_ouv_id`, FK a `ouv_contactos` |
| Snapshots en `ouv_influencias` | Eliminados |
| Migración esperada | Solo `CREATE TABLE ouv_contactos`. NO se modifica `contactos` |

### Consecuencias

**Positivas:**
- Módulo `discovery` autocontenido; cero dependencia de schema con `demand-generation`
- `ouv_influencias` más simple (menos columnas, sin snapshots que mantener)
- Migración del PR grande más segura: no toca tabla existente en producción
- Cada tabla evoluciona independiente sin coordinar cambios entre módulos

**Negativas / trade-offs aceptados:**
- Duplicación de datos en el ~10% de casos donde el contacto de OUV Vía 1 tenía contraparte en el lead
- Cuando llegue Módulo 12 (Gestión de Cuentas), habrá 3 tablas de contactos (contactos, ouv_contactos, contactos_cuenta) para consolidar en modelo unificado
- Si `contactos` evoluciona (agrega campos), `ouv_contactos` no los hereda — deriva de esquema
- Sin trazabilidad automática "este contacto vino originalmente del lead X" tras la copia

Los trade-offs se aceptan explícitamente. La opción de modelo unificado queda documentada para revisar en Módulo 12.

---

## Reglas de negocio consolidadas (post-adenda B)

| Regla | Enforcement |
|---|---|
| No hay atajos entre zonas | Guard duro por zona destino |
| Presupuesto es prerequisito para ENCIMA_FUNNEL | `guardPresupuestoConfirmado` |
| 2 influencias en verde son prerequisito para EN_FUNNEL y MAYOR_PROBABILIDAD | `guard2InfluenciasEnVerde` |
| Ganada requiere MAYOR_PROBABILIDAD sin excepciones en Wave 1 | `guardEntidadEnEstado('OUV', 'MAYOR_PROBABILIDAD')` |
| Retroceso requiere motivo obligatorio | Guard sobre DTO |
| Reapertura no permitida en Wave 1 | No existe endpoint |
| Motivos de cierre desde catálogo | FK + snapshot inmutable |
| Alerta de gap sin degradar solo | Motor evalúa reactivo pero solo notifica |
| OUV puede crearse sin lead | `sql_id_origen` nullable, ruta `POST /discovery/ouvs` |
| **Contactos de OUV viven en tabla separada** | `ouv_contactos`, sin FK a `contactos` |
| **En Vía 1, contactos del lead se copian al crear OUV** | Copia en transacción de `ouv.creada_desde_sql` |
| **Contactos copiados no se auto-asignan a influencias** | `ouv_influencias.contacto_ouv_id = NULL` por defecto |

---

## Consecuencias

### Positivas
- Trazabilidad completa del ciclo comercial en el CRM
- KPIs (WinRate, tasa de descarte, motivos de pérdida) derivables directamente
- Motor de workflow (Fase A) validado end-to-end con caso complejo real
- Diseño alineado con realidad organizacional de Verytel — sin roles inventados
- Módulos independientes (discovery / demand-generation) sin acoplamiento de schema

### Negativas / trade-offs aceptados
- Módulo 2 pasa de "medianamente grande" a "grande" (~2-3 sprints)
- Sin overrides ni reaperturas en Wave 1
- Duplicación de contactos entre leads y OUVs en el 10% de casos con superposición
- Los checklists de zona necesitarán ajuste tras primeras semanas de uso real
- Marketing no ve eventos en tiempo real (Wave 2)
- Migración a modelo unificado de contactos en Módulo 12 tendrá 3 tablas para consolidar

---

## Referencias

- `spec-calificacion.md` v2.1 — enrutamiento SQL + conversión SQL→OUV (con copia de contactos)
- `spec-ouv-funnel.md` v1.2 — ciclo completo del embudo (con Adenda A y B)
- `spec-workflow-engine.md` v1.1 — motor consumido
- `DR-2026-08` — decisión del motor de workflow intermedio incremental
- `FILTROS_EMBUDO_COMERCIAL_v5.pdf` — documento fuente del embudo
- `Frisson_CRM_Blueprint_V2_19062026.pdf` — matriz de actores oficial
- `.cursor/rules/800-workflow-transitions.mdc` — contrato del motor
- `.cursor/skills/workflow-engine-pattern/SKILL.md` — patrón consumidor
