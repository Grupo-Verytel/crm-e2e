# DR — Lead creado directo por KAM / Product Manager (dos rutas distintas)

**Fecha:** 2026-08-10
**Estado:** Aprobado
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Relacionado:** `specs/decisions/2026-08-DR-rol-product-manager.md`

## Contexto

El cliente definió que `EjecutivoComercial` (KAM) y el nuevo rol `Product Manager` pueden crear Leads de forma manual, saltándose parte del pipeline normal `TOFU→MOFU→MQL→SQL`. Inicialmente se trató como un solo comportamiento; se corrigió porque **son dos rutas distintas** según quién crea el lead.

Blueprint V2 documenta `leads.estado` como ENUM cerrado: `Nuevo|TOFU|MOFU|MQL|SQL|Reciclaje|Descartado`. No se agrega ningún valor nuevo a este ENUM — "BOFU" que aparece en el Kanban de Generación de Demanda es una **etiqueta visual de frontend para el estado `MQL`**, no un estado nuevo de backend.

## Decisión

### Ruta 1 — Lead creado por `EjecutivoComercial` (KAM)

1. Se crea en la tabla `leads`, con el checklist ICP diligenciado manualmente por el KAM (no se calcula por scoring automático).
2. `lead.estado` nace **directo en `SQL`** — salta `TOFU`, `MOFU`, `MQL`.
3. Dispara el equivalente de `WF002`: se crea el registro `sql` con `comercial_asignado_id` = el mismo KAM que lo creó, `estado = Asignado`.
4. Aparece de inmediato en la bandeja propia del KAM ("Mis SQL asignados").
5. Canales de origen permitidos: `BTL`, `Fábrica`, `Traductor de Negocio`.

### Ruta 2 — Lead creado por `Product Manager`

1. Se crea en la tabla `leads`, con el checklist ICP diligenciado manualmente por el Product Manager.
2. `lead.estado` nace **directo en `MQL`** (mostrado en UI como "BOFU" — es el mismo estado `MQL`, solo cambia la etiqueta visual en el Kanban de Generación de Demanda).
3. **No queda auto-asignado a ningún comercial.** Sigue el enrutamiento normal `MQL→SQL` (aprobación Director Mercadeo + asignación comercial vía `WF002`) para determinar a qué KAM llega.
4. Canales de origen permitidos: `BTL`, `Fábrica` (sin Traductor de Negocio).

## Pendiente para `spec-demand-generation.md`

- Criterios EARS del checklist ICP manual, para ambos roles.
- Confirmar si `sql_score`/`lead_score` quedan en null o con un flag de "calificación manual" para no distorsionar los KPIs `MQL Rate`/`SQL Rate` de Blueprint V2 (los leads Ruta 1 nunca pasan por `MQL`, así que no deberían contar en `SQL Rate = sqls/mqls*100` con el mismo criterio que los que sí calificaron por scoring).
- Confirmar en el Kanban de Generación de Demanda que la columna "BOFU" mapea 1:1 a `estado = MQL` en el backend, para que no haya doble fuente de verdad entre la etiqueta visual y el dato real.

## Adenda 2026-08-10 — resuelve conflicto `sqls.mql_id` (Ruta 1)

Al verificar contra el schema real (`spec-demand-generation.md` v2.2 §3.7), `sqls.mql_id` es **obligatorio y UNIQUE**. La Ruta 1 (KAM) no genera un `mql` por el camino normal, lo cual impedía crear el `sql` sin violar esa restricción.

**Resuelto:** el sistema crea un `mql` **automático** en el mismo acto de creación del lead por `EjecutivoComercial`:
- `mqls.estado = ConvertidoSQL` (nace ya resuelto, no pasa por `Activo`)
- `mqls.calificado_por` = el mismo `EjecutivoComercial` que crea el lead
- `mqls.motivo_calificacion` = `"Auto-calificado — creación directa comercial"`
- `mqls.checklist_id` = el `lead_checklist` diligenciado en el mismo acto (no queda NULL)

El `sql` se crea sobre ese `mql_id` recién generado. **No se modifica el schema existente** (`sqls.mql_id` sigue obligatorio) — se evita así tocar una tabla ya especificada/implementada, consistente con el Artículo II.

Esto queda reflejado como **EARS-29** en `spec-demand-generation.md` v2.3 §5, ya sin el flag 🔴.

## Alternativas descartadas

- Un solo comportamiento para ambos roles — descartado: el negocio distingue explícitamente asignación automática (KAM, ya es comercial) vs. enrutamiento normal (Product Manager, no es un rol comercial-asignatario).
- Agregar `BOFU` como valor nuevo del ENUM `leads.estado` — descartado: es redundante con `MQL`, confirmado por el arquitecto.
- Volver `sqls.mql_id` nullable — descartado: mayor impacto sobre schema ya implementado/especificado; el `mql` automático logra lo mismo sin tocarlo.
