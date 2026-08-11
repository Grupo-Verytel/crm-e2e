# DR — Nuevo rol: Traductor de Negocio + campo condicional en leads

**Fecha:** 2026-08-10
**Estado:** Aprobado (adenda clarify 2026-08-10 — alcance de permisos Wave 1)
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Relacionado:** `specs/decisions/2026-08-DR-rol-product-manager.md` (mismo patrón: rol nuevo fuera de Blueprint V2)

## Contexto

El canal de origen "Traductor de Negocio" ya estaba anotado como TBD en `spec-demand-generation.md` v2.0 (canal 5 de 5). El cambio de reglas de negocio confirma que el Traductor de Negocio es un **usuario del sistema con rol propio** — no un contacto de cliente (`people`) ni un catálogo separado.

## Decisión

1. Se agrega el rol **`TraductorDeNegocio`** al catálogo de roles vigente, junto a `EjecutivoComercial`, `SoporteComercial` (UI: “Profesional Soporte Comercial”), `ProductManager` (UI: “Product Manager”).
2. Se agrega `leads.business_referrer_id` — FK opcional a `users.user_id`. En la UI, el select solo lista usuarios cuyo rol sea `TraductorDeNegocio`.
3. **Campo condicional**: visible y obligatorio únicamente cuando `canal_origen = TRADUCTOR_NEGOCIO` (ENUM del spec). Para cualquier otro canal, el campo se oculta y su valor debe quedar `null`.
4. El KAM / responsable del lead (`leads.responsable_id`) no cambia — el Traductor de Negocio es el origen/referente, no quien lo gestiona.
5. **Alcance Wave 1 (clarify):** login permitido + **lectura limitada** de leads donde `business_referrer_id` = su `user_id`. **Sin** create/update de leads ni campañas. Sin pantallas operativas de mercadeo propias más allá de esa vista de lectura.

## Impacto

- `AGENTS.md` §4 incluye el rol.
- `spec-demand-generation.md` EARS-31..33 + EARS de lectura limitada (ver v2.4).
- Seed/CASL: `read` sobre `Lead` con condición de ownership por `business_referrer_id` (o filtro equivalente en service).

## Alternativas descartadas

- Modelarlo como tipo dentro de `people` — descartado.
- Catálogo separado (`traductores_negocio`) — descartado.
- Solo seleccionable sin permisos de lectura de leads — descartado en clarify (opción A).
- Mismos permisos que `GestorMercadeo` — descartado en clarify (opción C).
