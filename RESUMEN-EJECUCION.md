# RESUMEN-EJECUCION — EARS-10..13 (SQL→OUV)

**Fecha:** 2026-08-06  
**Alcance:** Conversión SQL→OUV (EARS-10..13). EARS-14 diferido.

---

## Archivos creados

- `backend/src/modules/discovery/discovery.module.ts`
- `backend/src/modules/discovery/models/ouv.model.ts`
- `backend/src/modules/discovery/models/enums/ouv.enums.ts`
- `backend/src/modules/discovery/dtos/crear-ouv.dto.ts`
- `backend/src/modules/discovery/dtos/ouv-response.dto.ts`
- `backend/src/modules/discovery/services/ouvs.service.ts`
- `backend/src/modules/workflow-engine/guards/guard-usuario-es-comercial-del-sql.ts`
- `backend/src/modules/workflow-engine/guards/guard-entidad-en-estado.spec.ts`
- `backend/database/migrations/20260806100000-create-ouvs.js`
- `backend/database/migrations/20260806110000-add-ouv-id-to-sqls.js`
- `frontend/src/modules/qualification/components/ConvertirSqlEnOuvModal.tsx`
- `RESUMEN-EJECUCION.md` (este archivo)

---

## Archivos modificados

- `backend/src/modules/demand-generation/models/sql.model.ts` — campo nullable `ouvId` / `ouv_id`
- `backend/src/modules/workflow-engine/guards/guard-entidad-en-estado.ts` — 3er arg opcional `entityIdResolver`; sin resolver = comportamiento idéntico
- `backend/src/modules/workflow-engine/workflow.rules.ts` — entrada `ouv.creada`
- `backend/src/modules/qualification/services/sqls.service.ts` — `convertirEnOuv` + `ouv` en detalle SQL
- `backend/src/modules/qualification/controllers/sqls.controller.ts` — `POST :id/convertir` (201)
- `backend/src/modules/qualification/dtos/sql-response.dto.ts` — `ouv_id`, `ouv`, `ConvertirSqlResponseDto`
- `backend/src/modules/qualification/qualification.module.ts` — importa `DiscoveryModule`
- `backend/src/app.module.ts` — registra `DiscoveryModule`
- `frontend/src/lib/api/http-client.ts` — propaga `detalle`/`codigo_error` de errores 422 del workflow
- `frontend/src/modules/qualification/api/sqls-api.ts` — `convertirSqlEnOuv` + tipos `ouv`
- `frontend/src/modules/qualification/pages/SqlDetailPage.tsx` — botón Crear OUV, toast, tarjeta OUV

---

## Migraciones ejecutadas

1. `20260806100000-create-ouvs` — `CREATE TABLE ouvs` (campos R2 + índices `comercial_id`, `zona_actual`; FKs a `sqls`/`users`)
2. `20260806110000-add-ouv-id-to-sqls` — `ALTER TABLE sqls ADD COLUMN ouv_id CHAR(36) NULL` + índice único `idx_sqls_ouv_id` + FK a `ouvs`

Ambas corrieron OK en development (`npm run migration:run`).

---

## Endpoints agregados

| Método | Ruta | Input | Respuesta |
|---|---|---|---|
| `POST` | `/api/v1/qualification/sqls/:id/convertir` | `CrearOuvDto`: `{ titulo, descripcion?, segmento, vertical }` | **201** `{ sql: SqlDetailDto, ouv: { ouv_id, consecutivo, titulo, segmento, vertical, zona_actual, resultado } }` |

Guards del motor → HTTP **422** `{ codigo_error, guard, detalle }`.

---

## Regla nueva en workflow.rules.ts

```typescript
{
  eventType: 'ouv.creada',
  guards: [
    guardEntidadEnEstado(EntityType.SQL, 'Asignado', (ctx) =>
      String(ctx.payload.sqlId ?? ''),
    ),
    guardUsuarioEsComercialDelSQL,
  ],
  destinatarios: [
    { tipo: 'rol', resolver: () => 'DirectorComercial' },
    { tipo: 'rol', resolver: () => 'SoporteComercial' },
  ],
  titulo: () => 'Nueva OUV creada',
  mensaje: (ctx) =>
    `Se creó la OUV ${ctx.entityLabel} a partir de un SQL.`,
},
```

---

## Decisiones tomadas sin preguntar

1. **Módulos reales** (`discovery` / `qualification` / `Sql` en demand-generation) según tu override a R6 + AGENTS.md.
2. **`entityIdResolver`**: con resolver se omite el match `ctx.entityType === entityType` (necesario para `transition('OUV')` + guard SQL); el estado se valida vía `ctx.entity` / `estadoAnterior` que el service pasa como el estado del SQL (`Asignado`).
3. **Consecutivo** `OUV-####` vía `MAX(SUBSTRING…)+1 FOR UPDATE` (sin `secuenciadores`).
4. **Segmento** duplicado como `OuvSegmento` en discovery (mismos valores que `Segmento`) para no deep-importar demand-generation.
5. **Verticales provisionales** Wave 1 (lista fija en enum + select del modal).
6. **Tabla `ouvs` sin `deleted_at`/paranoid** — R2 no lo lista.
7. **Tarjeta OUV** no clicable; sin redirect (vista OUV aún no existe).
8. **EARS-14** no implementado (diferido por tu decisión).

---

## Verificaciones pendientes (para Evilio al despertar)

- [ ] `curl` happy path → **201**, OUV creada, `sql.estado = ConvertidoOUV`, `sql.ouv_id` poblado
- [ ] `curl` con usuario ≠ `comercial_asignado_id` → **422** (`guardUsuarioEsComercialDelSQL`)
- [ ] Verificar notificaciones: idealmente 2 filas (`DirectorComercial` + `SoporteComercial`). **Nota:** el rol `DirectorComercial` **no está en el seeder actual** (`role-permissions.js`); sin usuarios de ese rol solo verás notificaciones a SoporteComercial
- [ ] UI: botón “Crear OUV” solo si EjecutivoComercial + `Asignado` + dueño; toast + refetch + tarjeta `OUV asociada: {consecutivo}`
- [ ] **EARS-14 diferido** — requiere decision record previo para el catálogo de motivos de descarte SQL (¿reutilizar `motivos_descarte` de OUV o catálogo separado?)

---

## Sugerencias post-implementación

- **TODO — migrar al patrón del skill `generar-consecutivo` (tabla `secuenciadores`) cuando exista, previsto para Módulos 3-5.** El `MAX…FOR UPDATE` actual no bloquea filas en tabla vacía (carrera teórica en el primer insert concurrente).
- Seedear rol `DirectorComercial` (+ al menos un usuario) para que `ouv.creada` cumpla el check de 2 notificaciones.
- La regla stub `sql.convertido_ouv` sigue en `workflow.rules.ts` sin consumidor; valorar deprecarla cuando EARS-10..13 estén estabilizados.
- Catálogo de verticales debería vivir en seed/admin en vez de constante hardcodeada.

---

## Verificaciones automáticas hechas en esta corrida

- Migraciones: OK  
- `jest --testPathPatterns=guard-entidad-en-estado`: 5/5 OK (legacy + resolver)  
- `backend` `npm run build`: OK  
- `frontend` `npm run build`: OK  
