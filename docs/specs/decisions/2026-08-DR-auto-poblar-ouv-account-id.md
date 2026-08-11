# DR — Auto-poblar `ouvs.account_id` al crear OUV desde SQL (Vía 1)

**Fecha:** 2026-08-10
**Estado:** Aprobado (corregido tras `speckit-analyze`)
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Origen:** Hallazgo 3 de `speckit-clarify` + Inconsistencia 2 de `speckit-analyze` sobre `spec-gestion-cuentas.md` (GC-13)
**Relacionado:** `2026-08-DR-unificacion-contactos-cuentas-wave1.md`, `2026-08-DR-accounts-por-lead.md`, `2026-08-DR-convencion-nombres-ingles.md`
**Reemplaza el borrador** `2026-08-DR-auto-poblar-ouv-cuenta-id.md` (nombre/columna incorrectos: asumía `cuenta_id` preexistente)

## Contexto

En el repo real, `ouvs` **no** tiene columna `cuenta_id` ni `account_id` (migración funnel: *“Does NOT add cuenta_id (Módulo 12)”*). El supuesto de “FK preexistente en español” era falso (Artículo II — el código manda).

Con el adelanto de `accounts`/`people` en Wave 1 y `2026-08-DR-accounts-por-lead.md` (un lead = una `account`), al crear una OUV desde SQL (Vía 1) el `account_id` del contacto principal es determinista.

## Decisión

1. Se **agrega** la columna nueva **`ouvs.account_id`** (UUID, nullable, FK → `accounts.account_id`), en inglés, conforme a `2026-08-DR-convencion-nombres-ingles.md`.
2. **Vía 1 (OUV desde SQL):** en la misma transacción de creación, el sistema DEBE setear `ouvs.account_id` = `account_id` del `person` del contacto principal del lead origen (`lead_contacts.position = 1`).
3. **Vías 2/3/4 (creación directa):** `account_id` permanece **nullable** / seleccionable en el alta; **no** es obligatorio en Wave 1.
4. **Sin sincronización posterior:** si tras la conversión cambian los contactos del lead, `ouvs.account_id` **no** se recalcula automáticamente (coherente con `spec-ouv-funnel.md` EARS-11).
5. **Alcance de implementación:** esta regla (GC-13) se implementa en los prompts de **discovery / calificación**, no en el prompt Wave 1a de `accounts` (GC-01…11).

## Impacto en specs

- **`spec-gestion-cuentas.md`:** GC-13 referencia este DR; Wave 1a no implementa GC-13.
- **`spec-ouv-funnel.md`:** EARS-01 debe setear `account_id`; modelo §2.1 usa `account_id` (no `cuenta_id`).
- **`spec-calificacion.md`:** EARS-12 debe dejar `ouvs.account_id` poblado en la misma transacción.
- **`AGENTS.md`:** corregir el hecho “`ouvs.cuenta_id` ya anticipada” → columna nueva `ouvs.account_id`.

### Criterio EARS de referencia (GC-13)

CUANDO se crea una OUV desde SQL (Vía 1), el sistema DEBE setear `ouvs.account_id` = `account_id` del `person` del contacto principal del lead (`lead_contacts.position = 1`). En creación directa (Vías 2/3/4), `account_id` permanece nullable / seleccionable en el alta; no es obligatorio en Wave 1.

## Alternativas descartadas

- Mantener el nombre `cuenta_id` “por docs previos” — descartado: la columna no existe en el repo; columnas nuevas van en inglés.
- No auto-poblar en Wave 1 — descartado en clarify (opción A del Hallazgo 3).
- Obligatorio en toda vía de creación — descartado para Wave 1 (OUVs directas pueden no tener cuenta al alta).
