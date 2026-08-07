# DR-2026-08-B — Embudo Comercial Verytel: descubrimiento y decisiones estructurales del Módulo 2

**Fecha:** 2026-08-05
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Aceptado
**Contexto:** Wave 1 CRM E2E, expansión del alcance del Módulo 2 (Calificación) tras análisis del documento `FILTROS_EMBUDO_COMERCIAL_v5.pdf`

---

## Contexto y descubrimiento

Durante el arranque de Módulo 2 se identificó que el CRM debe soportar **dos embudos coexistentes**, no uno:

1. **Embudo de Marketing** (ya implementado en Módulo 1): `TOFU → MOFU → BOFU → SQL` — lógica de calentamiento de contactos, operado por Director/Gestor de Mercadeo.

2. **Embudo Comercial** (recién descubierto en el PDF v5): `UNIVERSO → ENCIMA_FUNNEL → EN_FUNNEL → MAYOR_PROBABILIDAD → Cierre` — lógica de calificación de oportunidad tipo MEDDIC / Miller Heiman, operado por el Ejecutivo Comercial una vez recibe un SQL asignado.

Estos embudos son **secuenciales**: Marketing termina en SQL; Comercial arranca cuando ese SQL se convierte en OUV. No son alternativos, no son intercambiables. Son dos ciclos de vida distintos sobre entidades distintas (LEAD/MQL/SQL vs OUV).

Este descubrimiento amplió sustancialmente el alcance del Módulo 2, que originalmente solo cubría el enrutamiento SQL→comercial (spec-calificacion.md v1.0).

---

## Decisiones estructurales tomadas

### 1. Las 4 zonas del PDF son estados formales de la OUV
No son fases informales ni etiquetas visuales — son valores de un enum `ouv.zona_actual` con guards de transición gestionados por el motor de workflow. Esto habilita trazabilidad, reportería y RBAC por zona.

### 2. Modelo de cierre: zona + resultado separados
- `ouv.zona_actual` (ENUM 4 zonas) — dónde está la OUV en el funnel
- `ouv.resultado` (ENUM: EnCurso, Ganada, Perdida, Descartada) — cómo terminó (o si sigue activa)

Separar los dos ejes preserva la información de en qué zona se cerró, útil para reportería (¿cuántas Ganadas se cerraron desde EN_FUNNEL con override vs desde MAYOR_PROBABILIDAD?).

### 3. Avance y retroceso: ambos manuales
- **Avance:** el comercial declara "quiero pasar" y el motor valida el checklist de la zona destino
- **Retroceso:** el comercial degrada con motivo obligatorio; el sistema **alerta automáticamente** ante pérdida de criterios pero NO degrada solo

**Rechazado:** degradación automática. Habría creado asimetría con el avance manual, quitado control al comercial, y ensuciado la auditoría (ver alternativa rechazada 4.1).

### 4. Ganada solo desde MAYOR_PROBABILIDAD, con override justificado
Guard duro: `ouv.zona_actual === 'MAYOR_PROBABILIDAD'`. Excepción: rol Director Comercial puede aplicar override con motivo obligatorio. Cada override queda registrado en `audit_log` con flag `override_ganada_aplicado = true` para KPI derivado "% Ganadas con override" — señal de proceso mal calibrado si el número es alto.

### 5. Criterios de zona: Camino B (guards para duros + checklist para subjetivos)
Los criterios objetivamente validables (presupuesto confirmado, 2 influencias en verde, posibilidad de OC) se codifican como campos estructurados validados por guards del motor. Los criterios subjetivos (reputación, ubicación geográfica, encaje ICP) se marcan como items de checklist declarados por el comercial, sin validación automática.

**Rechazados:** codificar todos los criterios (Camino A — algunos son inherentemente subjetivos), placeholders para taller adicional (Camino C — atrasa el arranque sin ganar claridad real).

### 6. Influencias compradoras: 3 fijas + tabla propia
Económica, Técnica, Fábrica — sin variación por segmento en Wave 1. Tabla `ouv_influencias` con estado semáforo (Verde/Rojo/Amarillo/SinEvaluar).

**Rechazado:** catálogo administrable de tipos de influencia. Sobredimensiona Wave 1 sin caso de uso conocido. Si el negocio pide más tipos en Wave 2, se agregan con migración simple.

### 7. Influencias vinculadas a contactos: FK opcional + snapshots
`ouv_influencias.contacto_id` es FK opcional a la tabla `contactos` existente (del ciclo de leads). Además se guardan snapshots inmutables (`contacto_nombre_snapshot`, `contacto_cargo_snapshot`, `contacto_email_snapshot`) para preservar histórico y proteger reportería de cambios posteriores en `contactos`.

**Postergado:** modelo unificado de contactos (Lead → OUV → Cuenta como en Salesforce). Requiere primero definir Módulo 12 (Gestión de Cuentas). Cuando ese módulo llegue, los snapshots facilitan la migración.

### 8. Motivos de cierre: catálogos administrables
Dos catálogos separados: `motivos_perdida` (competimos y no ganamos) y `motivos_descarte` (nosotros decidimos no seguir). Administrables por Director. Soft-delete + snapshot en la OUV al momento del cierre para preservar reportería histórica.

**Rechazados:** enum fijo (rigidez), texto libre con tags (contamina reportería agrupada).

### 9. Campos obligatorios al cerrar: R1 estricto, lista mínima
- **Ganada:** motivo + monto final + moneda
- **Perdida:** motivo + monto estimado perdido + competidor (solo si motivo = "Ganó competidor")
- **Descartada:** solo motivo

Sin borrador de 48h ni otros mecanismos de dispensa. Fricción baja (máximo 3 campos), datos limpios para reportería.

### 10. Monto final desacoplado del pricing PRI-####
El comercial captura el monto real tras negociación en el cierre Ganada. Habilita KPI derivado "descuento aplicado en negociación" = `pricing_aprobado - monto_final`.

### 11. Reapertura: solo Director + KPIs con snapshot mensual
Rol Director Comercial puede reabrir OUV cerrada con motivo obligatorio del catálogo `motivos_reapertura`. La OUV vuelve a `zona_antes_cierre` guardado al cerrar. Los KPIs mensuales (WinRate) se calculan con snapshot al cierre del mes, no se ven afectados por reaperturas posteriores.

**Rechazados:** inmutable (contamina con OUVs duplicadas), historial completo E3 (complejidad de reportería sin payoff claro en Wave 1).

### 12. Trabajo por hacer: T3 (checklist con timestamp), no tabla de actividades
Los "trabajos por hacer" del PDF v5 (análisis de ajuste, identificar OC, presentar oferta, defender oferta) se materializan como items del checklist de zona con campo `marcado_at`. **No** se crea tabla `ouv_actividades` en Wave 1.

**Rechazado:** T2 (tabla de actividades formales). Sobredimensiona el modelo, agrega fricción operativa (comerciales marcando tareas), y no hay evidencia de que Verytel opere hoy con tracking formal de actividades. Si en 2-3 meses de producción el negocio demuestra necesidad, la migración a T2 es directa usando los timestamps del checklist como semilla.

### 13. Alerta de criterios perdidos: A2 reactivo por eventos
El sistema evalúa criterios en cada evento relevante (`ouv.influencia_cambio`, `ouv.checklist_item_marcado`, `ouv.presupuesto_actualizado`) via `CriteriosZonaEvaluator`. Persiste `ouv.tiene_gap` (BOOLEAN) y `ouv.criterios_faltantes` (JSON) para render eficiente en bandeja. Notifica al comercial dueño la primera vez que se detecta el gap, con `dedup_key` para no repetir.

**Rechazados:** on-demand al abrir OUV (pasivo, comercial no se entera hasta que abra), cron periódico (contamina arquitectura event-driven ya construida).

### 14. Presupuesto: P2 objeto estructurado sin tabla propia
Campos en la OUV: `presupuesto_confirmado` (BOOLEAN, guard duro), `presupuesto_monto` (opcional), `presupuesto_moneda`, `presupuesto_fecha_captura`, `presupuesto_fuente` (ENUM con confiabilidad).

**Rechazados:** solo booleano (pierde valor de reportería), tabla histórica (sobredimensiona), monto obligatorio (fricción sin ganancia real — el guard sigue siendo el booleano).

### 15. Bandeja del comercial: vista dual + orden por última actividad + filtros mínimos
Lista (default) + Kanban guiado por zona. Kanban permite arrastre pero abre modal de transición — no transiciona directo (respeta guards duros). Consistente con el patrón ya establecido en Módulo 1 para leads.

Filtros Wave 1: zona (multi), gap sí/no, texto libre, rango fecha creación. Segmento, vertical, monto, orden manual quedan para Wave 2.

### 16. Bandeja del Director Comercial reutiliza el componente
Misma vista con CASL relajado: ve OUVs de todos los comerciales + columna "comercial dueño" + filtro por comercial. Puede aplicar override y reapertura desde ahí.

---

## Reglas de negocio consolidadas

| Regla | Enforcement |
|---|---|
| No hay atajos entre zonas | Guard duro por zona destino |
| Presupuesto es prerequisito para ENCIMA_FUNNEL | `guardPresupuestoConfirmado` |
| 2 influencias en verde son prerequisito para EN_FUNNEL y MAYOR_PROBABILIDAD | `guard2InfluenciasEnVerde` |
| Ganada requiere MAYOR_PROBABILIDAD (excepto override Director) | `guardOUVEnZonaMayorProbabilidad` + excepción por rol |
| Retroceso requiere motivo obligatorio | Guard sobre el DTO de degradación |
| Reapertura solo Director | CASL + guard de rol |
| Motivos de cierre desde catálogo | FK + snapshot inmutable |
| Alerta de gap sin degradar solo | Motor evalúa reactivo pero solo notifica, no transiciona |

---

## Consecuencias

### Positivas
- Trazabilidad completa del ciclo comercial en el CRM
- WinRate, tasa de descarte, motivos de pérdida como KPIs derivables directamente
- Motor de workflow (Fase A) validado end-to-end con un caso complejo real, no solo enrutamiento simple
- Los guards del motor demuestran su valor: encapsulan reglas del negocio que antes vivían en Excel y memoria de los comerciales

### Negativas / trade-offs aceptados
- Módulo 2 pasa de "medianamente grande" (solo enrutamiento) a "grande" (enrutamiento + embudo completo + cierre + reapertura). Estimación de esfuerzo: ~2-3 sprints
- La ausencia del modelo unificado de contactos genera duplicación de datos hasta que llegue Módulo 12
- Los checklists de zona necesitarán ajuste tras las primeras semanas de uso real (los criterios subjetivos del PDF v5 son propuesta, no ley)
- El override justificado de Ganada requiere disciplina de Director — si se abusa, contamina el KPI de WinRate; se mitiga con visibilidad en dashboard

---

## Referencias

- `spec-calificacion.md` v2.0 — enrutamiento SQL + conversión SQL→OUV
- `spec-ouv-funnel.md` v1.0 — ciclo completo del embudo comercial
- `spec-workflow-engine.md` v1.1 — motor consumido por ambas specs
- `DR-2026-08` — decisión del motor de workflow intermedio incremental
- `FILTROS_EMBUDO_COMERCIAL_v5.pdf` — documento fuente del embudo comercial Verytel
- `Frisson_CRM_Blueprint_V2_19062026.pdf` — WF002 y siguientes
