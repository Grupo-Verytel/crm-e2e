# DR — Nuevo rol: ProductManager

**Fecha:** 2026-08-10
**Estado:** Aprobado (adenda analyze 2026-08-10 — `Role.name` PascalCase)
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Dispara desde:** cambio de reglas de negocio comunicado por el cliente (ver hallazgo `speckit-clarify` sobre punto 8, bloque de reglas de negocio de segmentos/subsegmentos/leads)

## Contexto

`CONSTITUTION.md` Artículo VI y `AGENTS.md` §4 fijaban el catálogo de roles como cerrado a `EjecutivoComercial` y `SoporteComercial` (Blueprint V2 label UI “Profesional Soporte Comercial” = mismo rol), según Blueprint V2 (19/06/2026). El cliente introdujo un nuevo rol, **Product Manager** (label UI), con capacidad de crear Leads.

## Decisión

Se agrega **`ProductManager`** al catálogo de roles vigente del sistema.

**Nombre canónico:** `Role.name = 'ProductManager'` (PascalCase sin espacios, igual que `EjecutivoComercial` / `SoporteComercial`). La UI muestra el label **“Product Manager”**.

**Alcance de permisos confirmado hasta ahora:**
- Puede crear Leads.
- Los Leads que crea nacen directamente en `MQL_PENDING` (etiqueta UI “BOFU”).
- Canal de Origen permitido para estos Leads: **BTL** o **Fábrica** únicamente (no Campañas Digitales, Agencia, ni Traductor de Negocio).

**Alcance de permisos NO confirmado (pendiente de `spec-demand-generation.md`):**
- Si `ProductManager` tiene acceso a otras fases del proceso comercial además de creación de Leads.
- Si tiene RBAC/guards propios o hereda de algún rol existente para el resto del sistema.

## Impacto

- `AGENTS.md` §4 se actualiza para incluir el rol.
- Blueprint V2 (documento fuente del cliente, 19/06/2026) queda desactualizado en este punto — este DR es la fuente autoritativa mientras no se actualice el PDF formalmente.
- `spec-demand-generation.md` incorpora los criterios EARS de creación de Lead por `ProductManager` (EARS-24…26).

## Alternativas descartadas

- Tratarlo como alias de `SoporteComercial` — descartado porque el cliente lo describió como un rol distinto, con su propio flujo de creación de Leads (`MQL_PENDING` + canal restringido), no como una variante de permisos de un rol existente.
- `Role.name = 'Product Manager'` (con espacio) — descartado en analyze 2026-08-10: se unifica al patrón PascalCase del seed.
