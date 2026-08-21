# DR — Modelo de contactos unificado (corregido: usa tablas ya existentes en Blueprint V2)


> ⚠️ **SUPERSEDIDO** por `2026-08-DR-unificacion-contactos-cuentas-wave1.md` (2026-08-10) — este DR asumía tablas `organizations`/`people` que no existen en el repo real. Se conserva por trazabilidad histórica, no usar como referencia técnica.
**Fecha:** 2026-08-10
**Estado:** Aprobado — corrige versión anterior del mismo DR
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Enmienda a:** hecho registrado en `AGENTS.md` §4: *"`ouv_contactos`: tabla independiente, sin FK a `lead_contacts`"*
**Corrige:** versión previa de este mismo DR, que proponía crear una tabla `contactos` nueva

## Contexto

El modelo previo trataba los contactos de lead y los contactos de OUV como entidades independientes, sin relación entre sí.

Al verificar contra Blueprint V2 (Artículo II de `CONSTITUTION.md`: el repo/blueprint manda sobre supuestos), se confirmó que **ya existen tablas maestras**, referenciadas hoy como FK opcional desde `leads`:
- `leads.empresa_id` → FK `organizations.org_id`
- `leads.contacto_id` → FK `people.person_id`
- `postventa.org_id` → también referencia `organizations`

La versión anterior de este DR proponía crear una tabla nueva `contactos` — **error, corregido aquí**: el maestro de personas ya existe y se llama `people`.

## Decisión

1. **No se crea tabla `contactos` nueva.** Se usa `people` (ya existente) como maestro de persona.
2. **No se crea tabla `empresas` nueva.** Se usa `organizations` (ya existente) como maestro de empresa.
3. Se crean **dos tablas intermedias nuevas**:
   - `lead_people` (`lead_id` FK + `person_id` FK)
   - `ouv_people` (`ouv_id` FK + `person_id` FK, conserva `nivel_influencia` del panel de influenciadores de OUV en Blueprint V2)
4. `lead_people` y `ouv_people` no tienen FK directa entre sí — comparten `person_id` como fuente única.
5. `AGENTS.md` §4 se corrige para reflejar `people`/`organizations`, no `contactos`/`empresas`.

## Pendiente

- `leads` hoy tiene campos denormalizados (`contacto_nombre`, `cargo`, `email`, `telefono`, `empresa_nombre`) además del FK opcional. Falta decidir si se conservan como snapshot histórico al momento de captura, o se deprecan en favor de leer siempre desde `people`/`organizations`. Ver DR de administración de empresas/contactos para el resto de este punto.

## Alternativas descartadas

- Crear tablas `contactos`/`empresas` nuevas — descartado: ya existen `people`/`organizations` en Blueprint V2, crear nuevas sería duplicar el maestro.
