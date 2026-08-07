# RESUMEN-PASO-4 — Controllers + Endpoints + DTOs + permisos

**Fecha:** 2026-08-07  
**Estado:** completado — esperando aprobación humana antes del PASO 5  
**Build:** `npm run build` (backend) **OK**  
**Base URL:** `http://localhost:3000/api/v1` (ajustar puerto si aplica)

---

## Endpoints

### OUV (`OuvsController` → `discovery/ouvs`)

| Método | Ruta | CASL | Notas |
|---|---|---|---|
| POST | `/discovery/ouvs` | create Opportunity | OUV directa |
| GET | `/discovery/ouvs` | read Opportunity | Filtros; `?all=true` solo Soporte/Admin |
| GET | `/discovery/ouvs/:id` | read Opportunity | Dueño o Soporte/Admin |
| POST | `/discovery/ouvs/:id/avanzar` | update Opportunity | |
| POST | `/discovery/ouvs/:id/retroceder` | update Opportunity | body `{ motivo }` |
| POST | `/discovery/ouvs/:id/ganar` | close Opportunity | |
| POST | `/discovery/ouvs/:id/perder` | close Opportunity | |
| POST | `/discovery/ouvs/:id/descartar` | close Opportunity | |
| GET | `/discovery/ouvs/:id/influencias` | read Opportunity | |
| PATCH | `/discovery/ouvs/:id/influencias/:tipo` | update Opportunity | tipo=`Economica\|Tecnica\|Fabrica` |
| GET | `/discovery/ouvs/:id/checklist?zona=` | read Opportunity | zona=ENUM OuvZona |
| PATCH | `/discovery/ouvs/:id/checklist/:itemId` | update Opportunity | body `{ marcado }` |
| PATCH | `/discovery/ouvs/:id/presupuesto` | update Opportunity | |

### Contactos (`OuvContactosController`)

| Método | Ruta | CASL |
|---|---|---|
| GET | `/discovery/ouvs/:ouvId/contactos` | read Opportunity |
| POST | `/discovery/ouvs/:ouvId/contactos` | update Opportunity |
| PATCH | `/discovery/ouvs/:ouvId/contactos/:contactoOuvId` | update Opportunity |
| DELETE | `/discovery/ouvs/:ouvId/contactos/:contactoOuvId` | update Opportunity |

### Catálogos admin (SoporteComercial)

| Recurso | Prefijo |
|---|---|
| motivos-perdida | `/admin/motivos-perdida` CRUD |
| motivos-descarte | `/admin/motivos-descarte` CRUD |
| zona-checklist-templates | `/admin/zona-checklist-templates` CRUD |

---

## Permisos (`role-permissions.js`)

- Acción nueva `D` → `delete`
- Subjects: `MotivoPerdida`, `MotivoDescarte`, `ZonaChecklistTemplate`
- **EjecutivoComercial:** `Opportunity` CRUX + read motivos (cierre)
- **SoporteComercial:** `Opportunity` CRU + CRUD catálogos
- **Admin:** CRUD catálogos

**Re-seed roles** en dev para aplicar permisos nuevos:
```bash
cd backend && npm run seed:run
```
(o el seeder de roles que use el proyecto)

---

## Curls happy path

```bash
TOKEN="<jwt EjecutivoComercial>"
SOPORTE="<jwt SoporteComercial>"
BASE=http://localhost:3000/api/v1

# Crear OUV directa
curl -s -X POST "$BASE/discovery/ouvs" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"titulo":"OUV demo","empresa_nombre":"ACME","segmento":"B2B","vertical":"Salud","descripcion":"Outbound"}'

# Listar
curl -s "$BASE/discovery/ouvs?page=1&limit=20" -H "Authorization: Bearer $TOKEN"

# Detalle
curl -s "$BASE/discovery/ouvs/$OUV_ID" -H "Authorization: Bearer $TOKEN"

# Contacto
curl -s -X POST "$BASE/discovery/ouvs/$OUV_ID/contactos" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"nombre":"Ana Pérez","cargo":"CTO","email":"ana@acme.com"}'

curl -s "$BASE/discovery/ouvs/$OUV_ID/contactos" -H "Authorization: Bearer $TOKEN"

# Influencia
curl -s -X PATCH "$BASE/discovery/ouvs/$OUV_ID/influencias/Economica" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"estado":"Verde","contacto_ouv_id":"'$CONTACTO_ID'"}'

# Presupuesto (prerequisito ENCIMA_FUNNEL)
curl -s -X PATCH "$BASE/discovery/ouvs/$OUV_ID/presupuesto" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"presupuesto_confirmado":true,"presupuesto_monto":100000000,"presupuesto_moneda":"COP","presupuesto_fuente":"cliente_declaro"}'

# Avanzar / retroceder
curl -s -X POST "$BASE/discovery/ouvs/$OUV_ID/avanzar" -H "Authorization: Bearer $TOKEN"
curl -s -X POST "$BASE/discovery/ouvs/$OUV_ID/retroceder" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"motivo":"Falta acceso a decisor"}'

# Checklist
curl -s "$BASE/discovery/ouvs/$OUV_ID/checklist?zona=UNIVERSO" -H "Authorization: Bearer $TOKEN"
curl -s -X PATCH "$BASE/discovery/ouvs/$OUV_ID/checklist/$ITEM_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"marcado":true}'

# Cierre (requiere motivos sembrados + zona según caso)
curl -s -X POST "$BASE/discovery/ouvs/$OUV_ID/ganar" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"monto_final":50000000,"moneda_final":"COP"}'

curl -s -X POST "$BASE/discovery/ouvs/$OUV_ID/perder" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"motivo_id":"'$MOTIVO_P'","monto_estimado_perdido":20000000}'

curl -s -X POST "$BASE/discovery/ouvs/$OUV_ID/descartar" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"motivo_id":"'$MOTIVO_D'"}'

# Admin catálogos (Soporte)
curl -s -X POST "$BASE/admin/motivos-perdida" \
  -H "Authorization: Bearer $SOPORTE" -H "Content-Type: application/json" \
  -d '{"nombre":"Ganó competidor","requiere_detalle":false,"orden":1}'

curl -s -X POST "$BASE/admin/motivos-descarte" \
  -H "Authorization: Bearer $SOPORTE" -H "Content-Type: application/json" \
  -d '{"nombre":"Sin fit","orden":1}'

curl -s -X POST "$BASE/admin/zona-checklist-templates" \
  -H "Authorization: Bearer $SOPORTE" -H "Content-Type: application/json" \
  -d '{"zona":"UNIVERSO","codigo_item":"impacto_mision","label":"Impacto en misión","orden":1}'

curl -s "$BASE/discovery/ouvs?all=true" -H "Authorization: Bearer $SOPORTE"
```

---

## Archivos

**Controllers:** `ouvs`, `ouv-contactos`, `motivos-perdida`, `motivos-descarte`, `zona-checklist-templates`  
**Service:** `catalogos-ouv.service.ts`  
**DTOs:** `catalogo.dto.ts`, `ouv-response.dto.ts` ampliado  
**Module:** controllers + `CatalogosOuvService` registrados  
**Permisos:** `role-permissions.js`  
`DiscoveryModule` ya estaba en `app.module.ts`.

---

## Sugerencias post-implementación

1. Re-seed de roles obligatorio en cada entorno tras este PASO.
2. Seed inicial de plantillas UNIVERSO + motivos para poder probar checklist/cierre E2E.
3. `SoporteComercial` no tiene `close` — no puede ganar/perder/descartar (alineado a spec).

---

## DETENERSE

PASO 4 listo. **No avanzo al PASO 5** hasta tu aprobación explícita.
