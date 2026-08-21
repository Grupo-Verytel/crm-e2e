# DR — Convención de nomenclatura: tablas/campos nuevos en inglés

**Fecha:** 2026-08-10
**Estado:** Aprobado
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)

## Decisión

1. Toda tabla o columna **nueva**, creada a partir de esta fecha (2026-08-10 en adelante), se nombra en **inglés**.
2. El esquema **ya implementado o ya especificado antes de esta fecha** (`leads`, `ouvs`, `sqls`, `mqls`, `campaigns`, `interactions`, `notifications`, `ouv_contactos`, `ouv_influencias`, `lead_contacts`, `lead_checklist`, `motivos_perdida`, `motivos_descarte`, `zona_checklist_templates`, `audit_log`, etc.) **mantiene sus nombres en español** — no se retro-traduce sin decision record explícito que lo justifique módulo por módulo.
3. Los **valores de datos** (ENUM, catálogos, contenido) se mantienen en español en ambos regímenes — esto aplica únicamente a nombres de tabla y columna, no a los datos que contienen.
4. Cuando se agrega una columna nueva a una tabla existente en español (ej. una FK nueva), la **columna nueva** va en inglés aunque la tabla que la contiene esté en español — ej. `ouv_contactos.person_id` (columna nueva, inglés) dentro de `ouv_contactos` (tabla existente, español).

## Glosario de esta sesión (traducciones aplicadas retroactivamente a los DRs ya emitidos)

| Nombre usado en DRs previos | Nombre final (inglés) | Tipo |
|---|---|---|
| `cuentas` | `accounts` | tabla nueva |
| `cuenta_id` | `account_id` | columna nueva |
| `personas` | `people` | tabla nueva |
| `persona_id` | `person_id` | columna nueva |
| `segmentos` | `segments` | tabla nueva |
| `segmento_id` | `segment_id` | columna nueva |
| `subsegmentos` | `subsegments` | tabla nueva |
| `subsegmento_id` | `subsegment_id` | columna nueva |
| `nombre` (en `accounts`/`people`/`segments`/`subsegments`) | `name` | columna nueva |
| `activo` (en `segments`/`subsegments`) | `active` | columna nueva |
| `cargo` (en `people`) | `job_title` | columna nueva |
| `nit` (en `accounts`) | `tax_id` | columna nueva |
| `traductor_negocio_id` (en `leads`) | `business_referrer_id` | columna nueva |

**No se traducen** (regímenes existentes o valores): `leads`, `ouvs`, `sqls`, `ouv_contactos`, `lead_contacts`, `segmento` (columna existente en `leads`/`ouvs`, ENUM viejo — coexiste con `segment_id` hasta que se resuelva la migración), valores como `Gobierno`, `Asignado`, `EjecutivoComercial`, `TraductorDeNegocio`, `ProductManager`.

## Nota de coexistencia

Durante la transición, `leads`/`ouvs` tendrán tanto el campo viejo `segmento` (ENUM, español) como el nuevo `segment_id` (FK, inglés) hasta que la migración de datos (ya marcada como pendiente en `2026-08-DR-subsegmentos.md`) se ejecute y se retire el ENUM viejo.

## Alternativas descartadas

- Traducir también los valores de ENUM — descartado explícitamente por el arquitecto: los datos/catálogos se mantienen en español.
- Retro-traducir el esquema ya implementado — descartado: alto riesgo de romper Módulo 1 ya en producción/desarrollo activo, sin beneficio inmediato que lo justifique.
