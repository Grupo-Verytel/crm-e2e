# CONSTITUTION.md — CRM Frisson / Grupo Verytel

**Versión:** 2.0
**Fecha:** 2026-08-10
**Alcance:** `crm-e2e/` (backend + frontend) — Lead-to-Cash, 8 fases comerciales + Auth/RBAC + Auditoría

> Este documento contiene únicamente **reglas de gobierno**: principios que no cambian aunque cambie el detalle técnico del repo. El inventario técnico vigente (stack, versiones, wrappers, convenciones de archivo) vive en `AGENTS.md`, que esta constitución referencia pero no duplica. `speckit-analyze` valida que specs y decision records no contradigan estos artículos antes de cada gate de implementación.

---

## Artículo I — Especificación antes que código

1. No se genera código sin un spec revisado y **aprobado explícitamente** por el arquitecto.
2. Todo spec funcional se escribe en notación **EARS**. Un criterio de aceptación sin formato EARS no es un criterio válido.
3. El flujo por módulo es fijo: **Spec → aprobación humana → Backend → aprobación humana → Frontend → aprobación humana**. El orden interno del backend (Models → migración → DTOs → services → controllers) es inventario y vive en `AGENTS.md`; el hecho de que existan gates humanos obligatorios entre fases es la regla de gobierno.
4. Los specs ejecutables (`spec-<módulo>.md`) se mantienen limpios; las decisiones puntuales y su justificación van en `specs/decisions/YYYY-MM-<tema>.md`, con fecha en el nombre.

## Artículo II — La realidad del repo manda sobre los supuestos del spec

1. Ante una contradicción entre lo que dice un spec/prompt y lo que existe verificado en el código, **el código gana**. El spec se corrige, no al revés.
2. Ningún nombre de tabla, relación, enum o convención se asume por analogía — se confirma leyendo el repo antes de generar código.
3. Cualquier hallazgo de este tipo (p. ej. qué tablas tienen o no FK entre sí) se documenta como hecho verificado en `AGENTS.md`, no se re-litiga cada vez sin evidencia nueva.

## Artículo III — Simplicidad ante todo (anti-over-engineering)

1. Ante la duda entre una solución simple/incremental y una "robusta"/general, se elige la simple. La carga de la prueba para justificar complejidad adicional es de quien la propone.
2. Ninguna capa de abstracción, motor genérico o generalización se introduce sin que el camino simple haya sido explícitamente descartado y quede registrado en un decision record.
3. Los precedentes de simplicidad ya decididos (qué se rechazó y por qué) se documentan en `specs/decisions/`, no se repiten en este documento — esta constitución fija la regla, los decision records fijan los casos.

## Artículo IV — Consistencia de patrones

1. Se reutilizan patrones y componentes ya existentes en el repo antes de crear nuevos.
2. Los nombres de módulo son siempre de dominio, nunca genéricos.
3. Ninguna dependencia nueva (librería de estado, fetching, UI kit, ORM auxiliar, etc.) se agrega sin decision record explícito que la justifique frente al stack ya verificado — el inventario de qué está permitido hoy vive en `AGENTS.md`.
4. Toda entidad auditable usa el mecanismo de soft-delete estándar del proyecto, documentado en `AGENTS.md` — no se introducen variantes sin decision record.

## Artículo V — Invariantes del modelo de dominio

1. La espina de identificadores consecutivos que atraviesa el proceso comercial es inmutable en su secuencia: todo módulo que genere una entidad transaccional debe encajar en ella o justificar la excepción vía decision record.
2. El eje de segmentación del negocio (segmento/vertical) es estructural: ningún flujo puede asumir un único segmento como default implícito.
3. Las oportunidades pueden originarse sin un lead/SQL previo — ningún flujo puede forzar un origen obligatorio.
4. La lógica del embudo comercial y sus zonas proviene de un documento de referencia de negocio (ver `AGENTS.md` § Documentos clave); cambios a esa lógica requieren decision record, no interpretación libre en un prompt.

## Artículo VI — Roles, seguridad y auditoría

1. El catálogo de roles vigente es el de Blueprint V2 — ningún spec, migración o seed introduce un rol que no exista ahí, aunque "suene lógico" tenerlo.
2. Todo cambio a una entidad auditable registra fecha, usuario ejecutor y cambio realizado, sin excepción por tratarse de un módulo "interno".
3. Las reglas de validación de entrada (whitelisting, forbid-non-whitelisted, etc.) son obligatorias en todo endpoint nuevo — el mecanismo exacto vive en `AGENTS.md`.

## Artículo VII — Comunicación con el equipo y con Cursor

1. **Una decisión a la vez**: antes de implementar, las decisiones abiertas se confirman con el arquitecto vía preguntas de opción múltiple. Nunca se presenta una implementación antes de que las opciones estén confirmadas.
2. Todo prompt de Cursor en modo autónomo multi-paso incluye condiciones de parada explícitas, documento de bloqueo obligatorio si Cursor se detiene, y resumen obligatorio en cada gate — el formato exacto de estos artefactos vive en `AGENTS.md`.
3. Un mismatch estructural detectado por Cursor es una condición de parada válida — no se fuerza continuidad para "no perder tiempo".
4. El trabajo técnico y de BA se conduce en español.
5. En discovery/BA con stakeholders: no se muestra documentación de solución detallada antes de tiempo, para no anclar la conversación; los desacuerdos en taller se registran, no se resuelven en la sala.

## Artículo VIII — Alcance de Wave 1 vs Wave 2

1. Wave 1 cubre los 8 módulos comerciales + Auth/RBAC + Auditoría. Integración de facturación/ERP, dashboards ejecutivos y migración de datos externos son, por regla, alcance de Wave 2.
2. Ninguna capacidad de Wave 2 se adelanta a Wave 1 sin decision record que reabra el alcance explícitamente. Las fechas de referencia viven en `AGENTS.md`, no en este documento — la regla de gobierno es la separación de alcance, no la fecha en sí.

---

## Gobernanza

- Esta constitución tiene precedencia sobre cualquier prompt, sugerencia de Cursor o convención implícita en el código que la contradiga.
- Toda enmienda requiere: (a) decision record en `specs/decisions/` explicando el motivo, (b) aprobación explícita del arquitecto, (c) incremento de versión en el encabezado.
- Si una regla aquí necesita un dato técnico concreto para aplicarse (una librería, un nombre de archivo, una fecha), ese dato vive en `AGENTS.md` y esta constitución solo lo referencia — nunca lo duplica, para evitar que ambos documentos queden desincronizados.
- `speckit-analyze` valida esta versión al chequear consistencia spec↔plan↔constitución; un spec no puede aprobarse si contradice un artículo vigente sin una enmienda registrada primero.
