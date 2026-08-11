# DR — Un lead = una sola `account` entre todos sus contactos

**Fecha:** 2026-08-10
**Estado:** Aprobado
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Origen:** Hallazgo de `speckit-clarify` sobre `spec-demand-generation.md` EARS-38/39, cruzado con `spec-ouv-funnel.md` EARS-01

## Contexto

`spec-demand-generation.md` EARS-38/39 dejaba ambiguo si los 1–3 `people` asociados a un mismo `lead` (vía `lead_contacts`) podían pertenecer a `accounts` distintas. Esto afectaba directamente a `spec-ouv-funnel.md` EARS-01, que hereda `empresa_nombre` "vía la account del person principal" — si los contactos podían ser de empresas distintas, "la empresa del lead" quedaba mal definida.

## Decisión

**Un lead pertenece a una sola `account`.** Todos los `people` asociados a `lead_contacts` de un mismo `lead` DEBEN compartir el mismo `account_id`.

- El primer contacto agregado (posición 1, el principal) define la `account` del lead.
- Al agregar un contacto nuevo (posición 2 o 3), si el `person` elegido/creado pertenece a una `account` distinta a la ya establecida por el contacto principal, el sistema DEBE **rechazar** la operación con mensaje de error explícito — no hay reasignación automática en Wave 1.

## Impacto en specs

- **`spec-demand-generation.md`**: agregar criterios EARS nuevos (ver abajo) que reemplazan la ambigüedad de EARS-38/39.
- **`spec-ouv-funnel.md`** EARS-01: queda confirmado sin cambios — "empresa del lead" = la `account` única compartida por todos los contactos, tomada del principal.

### Nuevos criterios EARS para `spec-demand-generation.md`

- **EARS-40.** CUANDO se agrega un `person` a `lead_contacts` de un lead que ya tiene al menos un contacto, el sistema DEBE validar que `person.account_id` coincida con el `account_id` de los contactos ya asociados a ese lead.
- **EARS-41.** SI el `account_id` no coincide, ENTONCES el sistema DEBE rechazar la operación y mostrar un mensaje indicando la empresa ya asociada al lead.
- **EARS-42.** El `account_id` del contacto en `position = 1` (principal) DEBE considerarse la `account` del lead para cualquier herencia posterior (ej. `spec-ouv-funnel.md` EARS-01).

## Alternativas descartadas

- Permitir contactos de empresas distintas por lead, tomando solo la del principal como "empresa del lead" (opción B) — descartado: el arquitecto prefirió la regla más estricta para Wave 1.
- Permitir empresas distintas sin ninguna validación, solo sugerencia visual (opción C) — descartado por la misma razón.
