# RESUMEN-PASO-1 — Modelos + Migraciones + Enums (embudo OUV v1.2)

**Fecha:** 2026-08-07  
**Estado:** completado — esperando aprobación humana antes del PASO 2  
**Decisiones aplicadas:** A1 (8 verticales), A2 (VARCHAR+TS), B1 (`deleted_at` en catálogos)

---

## Qué se hizo

### Enums (`backend/src/modules/discovery/models/enums/ouv.enums.ts`)

| Enum | Valores |
|---|---|
| `OuvOrigenVia` | `desde_sql`, `directa` |
| `OuvVertical` | 8 valores canónicos (ver §2.6 abajo) |
| `InfluenciaTipo` | `Economica`, `Tecnica`, `Fabrica` |
| `InfluenciaEstado` | `Verde`, `Rojo`, `Amarillo`, `SinEvaluar` |
| `PresupuestoMoneda` | `COP`, `USD` |
| `PresupuestoFuente` | `cliente_declaro`, `contrato_previo`, `licitacion_publicada`, `estimacion_comercial`, `sin_verificar` |

`VERTICALES_PROVISIONALES` queda como alias de `Object.values(OuvVertical)` por compatibilidad.

### Modelos

| Archivo | Tabla | Notas |
|---|---|---|
| `ouv.model.ts` (modificado) | `ouvs` | Campos funnel Wave 1; `sqlIdOrigen` nullable; sin Wave 2; sin `cuenta_id` |
| `ouv-contacto.model.ts` | `ouv_contactos` | Soft-delete `deleted_at`; **sin FK** a `lead_contacts` |
| `ouv-influencia.model.ts` | `ouv_influencias` | UNIQUE `(ouv_id, tipo)`; `contacto_ouv_id` → `ouv_contactos`; sin snapshots |
| `ouv-checklist-item.model.ts` | `ouv_checklist_items` | T3: `marcado` / `marcado_at` / `marcado_por` |
| `motivo-perdida.model.ts` | `motivos_perdida` | `paranoid: true`, sin `activo` |
| `motivo-descarte.model.ts` | `motivos_descarte` | idem |
| `zona-checklist-template.model.ts` | `zona_checklist_templates` | UNIQUE `(zona, codigo_item)` |
| `models/index.ts` | — | Barrel exports |

`DiscoveryModule` registra los 7 modelos.

### Ajuste mínimo de servicio (requerido por columnas NOT NULL)

`OuvsService.crearDesdeSql` ahora setea:
- `origenVia = desde_sql`
- `empresaNombre = 'PENDIENTE'` (placeholder; PASO 2 copiará desde el lead)
- `tieneGap = false`, `presupuestoConfirmado = false`

### Spec §2.6 — verticales (para que actualices formalmente)

Lista canónica Wave 1 (**8**, no 7):

1. Seguridad Ciudadana  
2. Defensa  
3. Telecomunicaciones  
4. Smart Cities  
5. Infraestructura Crítica  
6. Educación  
7. Salud  
8. Otros  

Columna DB: **`VARCHAR(80)`** (no ENUM MySQL). Validación en DTO/TS vía `OuvVertical`.

---

## Migraciones ejecutadas (dev)

Orden planeado (8) + reparación (9ª) por fallo de Sequelize `changeColumn`+FK:

| # | Archivo | Resultado |
|---|---|---|
| 1 | `20260807120000-alter-ouvs-add-funnel-columns.js` | OK — columnas funnel; backfill `empresa_nombre='PENDIENTE'` |
| 2 | `20260807120100-alter-ouvs-sql-id-origen-nullable.js` | Corregida a SQL raw (para installs frescos) |
| 3 | `20260807120200-create-ouv-contactos.js` | OK |
| 4 | `20260807120300-create-ouv-influencias.js` | OK |
| 5 | `20260807120400-create-ouv-checklist-items.js` | OK |
| 6 | `20260807120500-create-motivos-perdida.js` | OK |
| 7 | `20260807120600-create-motivos-descarte.js` | OK |
| 8 | `20260807120700-create-zona-checklist-templates.js` | OK |
| 9 | `20260807120800-fix-ouvs-sql-id-origen-nullable.js` | OK — repara nullable + FKs duplicadas |

### Backfill `empresa_nombre`

En esta BD de desarrollo: **0 filas** con `PENDIENTE` (no había OUVs previas).  
Si en otro entorno hay OUVs de PR-1 con `empresa_nombre = 'PENDIENTE'`, el comercial debe actualizarlas manualmente.

---

## Confirmaciones R5 / Adenda B

| Check | Resultado |
|---|---|
| `lead_contacts` alterada | **No** |
| `lead_contacts.lead_id` | **NOT NULL** (`IS_NULLABLE = NO`) |
| `ouvs.sql_id_origen` | **NULLABLE** (`IS_NULLABLE = YES`) |
| Wave 2 columns | **No** creadas |
| `cuenta_id` | **No** creado |
| `npm run build` (backend) | **OK** |

---

## Archivos tocados / creados

**Creados**
- `backend/src/modules/discovery/models/ouv-contacto.model.ts`
- `backend/src/modules/discovery/models/ouv-influencia.model.ts`
- `backend/src/modules/discovery/models/ouv-checklist-item.model.ts`
- `backend/src/modules/discovery/models/motivo-perdida.model.ts`
- `backend/src/modules/discovery/models/motivo-descarte.model.ts`
- `backend/src/modules/discovery/models/zona-checklist-template.model.ts`
- `backend/src/modules/discovery/models/index.ts`
- 9 archivos bajo `backend/database/migrations/20260807120*.js`

**Modificados**
- `backend/src/modules/discovery/models/enums/ouv.enums.ts`
- `backend/src/modules/discovery/models/ouv.model.ts`
- `backend/src/modules/discovery/discovery.module.ts`
- `backend/src/modules/discovery/services/ouvs.service.ts`
- `backend/src/modules/discovery/dtos/crear-ouv.dto.ts`
- `backend/src/modules/discovery/dtos/ouv-response.dto.ts`

**Eliminado**
- `NOTAS-BLOQUEO-PASO-1.md` (resuelto)

---

## Sugerencias post-implementación

1. Formalizar §2.6 en `spec-ouv-funnel.md` con los 8 verticales + nota VARCHAR.
2. Seed inicial de `zona_checklist_templates` y motivos (PASO 2/4 o seeder dedicado) — sin plantillas, `seedChecklistParaZona` no tendrá filas.
3. UNIQUE `(zona, codigo_item)` en plantillas incluye soft-deleted; si se reusa un código tras delete, fallará. Valorar índice parcial / unique solo activos en Wave 2.
4. Migración 9 es solo reparación; en installs limpios es redundante pero idempotente en efecto.

---

## DETENERSE

PASO 1 listo. **No avanzo al PASO 2** hasta tu aprobación explícita.
