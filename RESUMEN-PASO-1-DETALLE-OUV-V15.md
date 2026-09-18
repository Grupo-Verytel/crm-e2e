# RESUMEN-PASO-1 — Detalle OUV origen/canal (spec v1.5)

**Fecha:** 2026-09-17  
**Spec:** `docs/specs/spec-ouv-funnel.md` v1.5 (APROBADO)  
**Alcance:** requisitos 1–2, **solo backend**. Frontend pendiente de aprobación de este paso.  
**Estado:** completado — esperando aprobación humana antes del PASO 2 (frontend)

---

## Qué se implementó

Snapshot inmutable del origen del lead en la OUV (EARS-01/06/36–38). Sin backfill. Cierre (EARS-30..34) no se tocó.

### Migración

`backend/database/migrations/20260917220000-add-ouv-origin-source-channel.js`

- `ouvs.origin` VARCHAR(80) NULL — columnas nuevas en **inglés**
- `ouvs.source_channel` VARCHAR(80) NULL
- **Sin** UPDATE/backfill de filas existentes

### Modelo / DTO / servicio

| Archivo | Cambio |
|---|---|
| `discovery/models/ouv.model.ts` | `origin`, `sourceChannel` |
| `discovery/dtos/ouv-response.dto.ts` | `origin`, `source_channel` en GET list/detalle |
| `discovery/dtos/actualizar-ouv.dto.ts` | No acepta esos campos (snapshot inmutable) |
| `discovery/lib/ouv-lead-source-snapshot.ts` | Copia `lead.origen` → `origin`, `lead.canal_origen` → `source_channel` |
| `discovery/services/ouvs.service.ts` | `crearDesdeSql` persiste snapshot; `crearDirecta` deja `null`; `toResponse` los expone |

### Endpoints (ninguno nuevo)

Misma superficie REST. El GET de OUV ahora incluye:

```json
{
  "origin": "Email Marketing | null",
  "source_channel": "CAMPANA_DIGITAL | null"
}
```

- `POST` conversión SQL→OUV (vía calificación → `crearDesdeSql`): rellena snapshot
- `POST /discovery/ouvs` (directa): `origin` y `source_channel` = `null`
- `PATCH /discovery/ouvs/:id`: no actualiza origen/canal (whitelist)

### Tests

`backend/src/modules/discovery/lib/ouv-lead-source-snapshot.spec.ts`

### No tocado (congelado)

- `ganar` / `perder` / `descartar`
- `CierreOuvModal` / `WonCelebration` / `OuvConfigMenu`
- Frontend (PASO 2)

---

## Cómo verificar

1. Correr `npm run migration:run` en `backend/`
2. Crear una OUV desde SQL: el GET debe traer `origin` y `source_channel` del lead
3. Crear una OUV directa: ambos campos `null`
4. Una OUV previa a esta migración: ambos `null` (sin backfill)

---

**Siguiente:** PASO 2 frontend (quitar `DiscoveryNav` en detalle, mostrar Origen/Canal, quitar Proyecto) tras tu aprobación.
