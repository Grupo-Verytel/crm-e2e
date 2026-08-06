# DR-2026-08 — Motor de Workflow: alcance intermedio incremental

**Fecha:** 2026-08-05
**Autor:** Evilio Díaz (Frisson Technologies / Grupo Verytel)
**Estado:** Aceptado
**Contexto:** Wave 1 CRM E2E, previo al inicio de implementación del Módulo 2 (Calificación)

---

## Contexto

El Blueprint V2 define ~11 transiciones críticas entre bandejas y roles a lo largo de las 8 fases del proceso comercial. El polling actual del frontend cubre parcialmente la necesidad de "bandeja actualizada" pero no cubre:

- Trazabilidad centralizada de por qué una entidad cambió de dueño
- Reglas de transición unificadas (hoy dispersas en services de cada módulo)
- Notificación en tiempo real cuando una entidad cambia de bandeja

Se identificaron 3 alternativas de arquitectura para resolver esto.

---

## Alternativas evaluadas

### A) Solo sistema de notificaciones
- **Alcance:** event bus + WebSocket + tabla `notificaciones` ya existente
- **Rechazada porque:** 6 de 11 transiciones críticas del blueprint requieren guards de "usuario tiene rol X" y "entidad en estado Y". Si esos guards viven dispersos en cada service, la trazabilidad (requisito explícito del blueprint) se rompe y hay lógica duplicada. El sistema quedaría corto contra requisitos ya conocidos.

### B) Motor de workflow avanzado (BPMN, workflow instances persistidas, retry queues, dead-letter, timers, editor visual)
- **Alcance:** motor completo tipo Camunda/Temporal
- **Rechazada porque:** las 3 transiciones más complejas del blueprint (validar margen en M5, validar documentación en M7, hitos RFS/RFB en M8) no son complejas por el motor — son complejas por sus **reglas de negocio de dominio**. Un motor BPMN no ayuda a calcular margen; solo agrega ceremonia. La complejidad se resuelve con guards que llaman services de dominio (`PricingValidatorService.validarMargen()`), no con más sofisticación de motor. Además, construir esto ahora consume 4-6 semanas contra requisitos no validados (Talleres T2 y T3 aún pendientes) y compromete la fecha de Go-Live de octubre 2026.

### C) Motor intermedio incremental — **elegida**
- **Alcance Fase A (ahora):** event bus + WebSocket + registro declarativo de transiciones + guards simples (rol + estado) + side effects encadenados (notificar es uno de ellos)
- **Alcance Fase B (condicional, cuando llegue Módulo 4 o 5):** guards que llaman services externos, hooks arbitrarios post-transición (llamar ERP, generar consecutivos)
- **Aceptada porque:** cubre completamente las 6 transiciones simples ya conocidas, respeta la disciplina SDD (no diseña contra requisitos no validados), deja punto de extensión abierto explícitamente para Fase B, y es entregable en 1-2 semanas sin bloquear el resto del roadmap.

---

## Decisión

Se adopta **Motor de workflow intermedio incremental** en dos fases:

**Fase A (ahora, junto con Módulo 2):**
- Módulo NestJS `platform/workflow-engine` transversal, fuera de los 8 módulos de proceso
- Registro declarativo de reglas: `{ evento, guards[], sideEffects[], destinatarios_rol[] }`
- `WorkflowEngineService` — API pública consumida por services de dominio
- Guards simples: verificación de rol y de estado actual de la entidad
- Persistencia de notificaciones sync-transaccional (dentro de la transacción de Sequelize)
- Push WebSocket async post-commit (fire-and-forget usando el hook `afterCommit` de Sequelize)
- Frontend: toast + badge + refresh de lista, sin polling
- Migración del polling: coexistencia temporal, retirado cuando WS demuestre estabilidad

**Fase B (condicional, cuando se especifiquen Módulos 4-5 y talleres T2/T3 estén completos):**
- Guards asincrónicos que delegan a services de dominio (`PricingValidatorService`, `DocumentacionValidator`, etc.)
- Hooks arbitrarios post-transición para integraciones externas (ERP, generación de consecutivos)
- El diseño de Fase A ya deja este punto de extensión abierto (guards tipados como `(entity, payload) => boolean | Promise<boolean>`)

---

## Reglas técnicas derivadas

1. **Persistencia de notificaciones es transaccional; push WebSocket no lo es.** El listener `NotificationsPersister` escribe en `notificaciones` dentro de la misma transacción que la operación de negocio. El `NotificationsGateway` emite el push por WebSocket usando el hook `sequelize.afterCommit`, garantizando que el frontend nunca vea un estado pre-commit.

2. **Guards que fallan revierten la operación completa.** Un guard rechazado dispara excepción, la transacción se revierte, el service llamador recibe HTTP 422 con `codigo_error` claro. Los services de dominio dejan de validar transiciones por su cuenta y delegan al motor. Este cambio de patrón se documenta en el skill `workflow-engine-pattern`.

3. **El estado del workflow vive en la entidad de dominio, no en el motor.** No hay tabla de "workflow instances". `sqls.estado`, `ouvs.estado`, etc. siguen siendo la fuente de verdad. El motor solo orquesta la transición.

4. **Las reglas viven en código, no en BD.** El registro declarativo es un objeto TypeScript en `workflow.rules.ts`. Esto es la decisión estándar para motores livianos: versionable con git, revisable en PR, sin panel de administración. Si Wave 2 lo requiere, se migra a BD.

---

## Consecuencias

**Positivas:**
- Una sola fuente de verdad para "cuándo una entidad cambia de dueño y quién se entera"
- Los 3 developers del equipo consumen el motor con un patrón uniforme (documentado en skill)
- Trazabilidad centralizada — el motor registra toda transición en `audit_log`
- Sin sobreingeniería: cero infraestructura contra requisitos no validados

**Negativas / trade-offs aceptados:**
- Un module dev que ignore el skill puede seguir escribiendo transiciones a mano por fuera del motor. Mitigación: revisión en PR + regla Cursor `800-workflow-transitions.mdc`.
- Fase B no está diseñada aún; cuando llegue, requerirá su propio DR y ajuste al spec.
- Sin retry automático en push WebSocket. Si un cliente está desconectado al momento del push, la notificación queda persistida en `notificaciones` pero el toast no aparece — se verá al recargar. Aceptable para Wave 1.

---

## Referencias

- `spec-workflow-engine.md` v1.0 (Fase A)
- `.cursor/skills/workflow-engine-pattern/SKILL.md`
- Blueprint V2 secciones WF001-WF008 (transiciones inter-fase)
- `spec-calificacion.md` v1.0 (primer consumidor del motor)
