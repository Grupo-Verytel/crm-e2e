# RESUMEN-PASO-INT-2 — Backend de interacciones SQL

Paso 2 cerrado. La migración no se ejecutó contra la base.

## A1. Máquina de estados

`POST /leads/:id/interactions` no evalúa transiciones. `countByLead` solo se usa cuando alguien llama `transitionToMofu` por su endpoint. El POST de SQL usa `registerSqlInteraction` → `createForSql`, que no toca `leads.estado` ni `mqls.estado`. El camino de Leads queda igual.

## A2. Transacción

El alta de Leads hace el insert y el `update` de `fecha_ultima_interaccion` en dos llamadas, sin transacción. No se modificó. El alta desde SQL envuelve ambas escrituras en `sequelize.transaction`.

## A3. `SqlDetailDto.interactions`

Ningún componente lee el arreglo. `toDetailResponse` ya no llama a `listInteractions` y devuelve `[]`. La asignación sigue cargando interacciones solo para el payload del workflow `sql.asignado`, no para el detalle. Las bandejas agregan `interactions_count` con un `COUNT` agrupado por los `lead_id` de la página.

## Qué quedó

- Migración `20260923223000-add-sql-id-to-interactions.js`: `sql_id` nullable, índice, FK `ON DELETE RESTRICT`. Sin `created_by`.
- `GET/POST /qualification/sqls/:id/interactions`. CASL `Opportunity` (`read` / `update`), igual que el resto de qualification. La regla de negocio está en el servicio: SoporteComercial y Admin pueden registrar; EjecutivoComercial solo si es `comercial_asignado_id`; otro caso, 403. `EnGestion`, `ConvertidoOUV`, `Backlog` y `Descartado` responden 400 `SQL_INTERACTION_READ_ONLY`.
- El autor es `responsable_id` del JWT. `CreateInteractionDto` no lo declara: un `responsable_id` o `lead_id` en el body lo rechaza `forbidNonWhitelisted`.
- El listado (también el de Leads) trae `etapa`, `responsable_nombre` y `responsable_rol` en la misma consulta.
- Auditoría: el `afterCreate` global de `interactions` no cambia.
- Decision record: `specs/decisions/2026-09-23-interacciones-sql.md`.

## Tests

17 tests en verde, incluidos los de la sección 6 más A1 y A2:

- `lead_id` guardado = lead de la cadena; `mqls.estado` no se toca.
- `createForSql` solo actualiza `fecha_ultima_interaccion` y comparte transacción con el insert.
- Autor = usuario del token; `responsable_id` / `lead_id` enviados por el cliente se rechazan.
- Listado con etapa `Previa` / `SQL` y nombre y rol.
- 403 si el Ejecutivo no es el asignado (registro y listado).
- 400 en `ConvertidoOUV` y `EnGestion`.

**STOP.** Sin frontend.
