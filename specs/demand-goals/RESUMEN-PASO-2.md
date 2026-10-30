# RESUMEN-PASO-2 — Metas semanales de generación de demanda (backend)

Fecha: 2026-10-29. Rama de trabajo actual. Sin cambios de frontend. `npx tsc --noEmit -p tsconfig.build.json` en verde. ESLint de los archivos nuevos en verde.

Spec: `specs/demand-goals/spec.md` (S1–S4). Decisiones: `specs/decisions/2026-10-29-metas-generacion-demanda.md`.

## Endpoints

Prefijo `http://localhost:3000/api/v1`. JWT. Estos ejemplos no se ejecutaron por HTTP; los cubren las pruebas del servicio y del guard.

### GET `/dashboard/marketing/goals?year=2026`

`read` sobre `DemandGoal`.

```json
{
  "fiscal_year": 2026,
  "quarters": [
    { "quarter": 1, "days": 89 },
    { "quarter": 2, "days": 92 },
    { "quarter": 3, "days": 92 },
    { "quarter": 4, "days": 92 }
  ],
  "items": []
}
```

Con la base recién migrada, `items` está vacío. Q1 2024 devolvería 90 días.

### PUT `/dashboard/marketing/goals`

Lote de las tres métricas, una transacción. 201 si crea alguna fila, 200 si las tres ya existían.

```json
{
  "fiscal_year": 2026,
  "quarter": 2,
  "goals": [
    { "metric": "INTERACTIONS", "weekly_target": 10 },
    { "metric": "LEADS", "weekly_target": 3 },
    { "metric": "CONVERTED_OUV", "weekly_target": 0 }
  ]
}
```

Respuesta 201:

```json
{
  "fiscal_year": 2026,
  "quarter": 2,
  "items": [
    {
      "target_id": "uuid",
      "fiscal_year": 2026,
      "quarter": 2,
      "metric": "INTERACTIONS",
      "weekly_target": 10,
      "created_at": "2026-10-29T17:00:00.000Z",
      "updated_at": "2026-10-29T17:00:00.000Z"
    },
    {
      "target_id": "uuid",
      "fiscal_year": 2026,
      "quarter": 2,
      "metric": "LEADS",
      "weekly_target": 3,
      "created_at": "2026-10-29T17:00:00.000Z",
      "updated_at": "2026-10-29T17:00:00.000Z"
    },
    {
      "target_id": "uuid",
      "fiscal_year": 2026,
      "quarter": 2,
      "metric": "CONVERTED_OUV",
      "weekly_target": 0,
      "created_at": "2026-10-29T17:00:00.000Z",
      "updated_at": "2026-10-29T17:00:00.000Z"
    }
  ]
}
```

Un lote con la tercera meta en `-1` responde 400 `{ "code": "VALIDATION", "message": "La meta semanal debe ser un entero entre 0 y 2147483647." }` y no abre transacción. GestorMercadeo responde 403 `{ "code": "FORBIDDEN", "message": "Insufficient permissions" }` y no escribe. Quien solo tiene `update` no puede crear el trimestre. Quien solo tiene `create` no puede editar filas vivas.

`GET /dashboard/marketing` sigue pidiendo `read` de `Lead`. Agrega `weekly.goals` (`interactions`, `leads`, `converted_ouv`) con `actual`, `target` y `attainment_pct`. Los contadores numéricos siguen. Sin periodo, `target` y `attainment_pct` son `null`.

### DELETE `/dashboard/marketing/goals/:id`

`delete` sobre `DemandGoal`. Soft-delete. 200 `{ "deleted": true }`. El mismo id otra vez: 404 `{ "code": "NOT_FOUND", "message": "No se encontró la meta." }`. Un PUT posterior del trimestre crea de nuevo esa métrica y conserva los otros `target_id`.

## T1–T5

Jest contra un esquema MySQL aparte (`crm_e2e_dg_migtest`), borrado al final. 5 pruebas, todas en verde.

| Caso | Resultado |
|---|---|
| T1 | `up` crea el esquema nuevo vacío, sin snapshot. El segundo `up` sigue en 0 filas. `down` elimina la tabla. Otro `up` la vuelve a crear vacía. |
| T2 | Cuatro filas viejas con números distintos. `up` deja 0 vivas, `weekly_target = 0` en las eliminadas y el snapshot con los números originales. El segundo `up` no duplica el snapshot. `down` restaura `target_id`, `period_type` y los números, y borra el snapshot. Otro `up` vuelve a 0 vivas. |
| T3 | Una fila viva con `weekly_target = 8` sobre el esquema nuevo. El segundo `up` la deja en 8 y no crea snapshot. |
| T4 | `down` lanza `Down bloqueado: hay metas de demanda vivas.` y la fila sigue en 8. |
| T5 | Grano viejo a medias, snapshot ya cargado y columnas nuevas en NULL. `up` termina el esquema nuevo, 0 vivas, snapshot con 4 `target_id` distintos. |

En `crm_e2e` (RDS de desarrollo):

1. `npm run migration:run` aplicó el reshape y los permisos. 0 metas vivas. El snapshot guardó las cuatro filas originales (50 / 3 / 3) con sus `target_id`. `DemandGoal` quedó en `Admin` y `DirectorMercadeo`. `GestorMercadeo` no.
2. El `down` del reshape, ejecutado sobre esa base, restauró esas cuatro filas vivas (`annual`, `quarter`, `biweekly`, `weekly`) y eliminó el snapshot.
3. El `up` siguiente dejó otra vez 0 metas vivas y el snapshot con las mismas cuatro filas. Ese es el estado actual.

`DirectorMercadeo` y `Admin` tienen que cerrar sesión y volver a entrar para recibir el permiso.

## P1–P8

`weekly-goal-attainment.spec.ts`, 8 casos más el conteo de días del trimestre. Todos en verde.

| Caso | `target` | `attainment_pct` |
|---|---:|---:|
| P1 semana 4–10 may 2026, semanal 10, real 5 | 10 | 50 |
| P2 28 oct–3 nov 2026, Q3=10 y Q4=8, real 5 | 9 | 56 |
| P3 28 dic 2026–3 ene 2027, Q4 2026=14 (Q1 2027=99 no entra), real 7 | 14 | 50 |
| P4 27 ene–2 feb 2027, Q4 2026=7 y Q1 2027=14, real 18 | 9 | 200 |
| P5 el rango de P2, solo Q3=7, real 2 | 4 | 50 |
| P6 sin rango, real 0 | `null` | `null` |
| P7 semana de P1 con semanal 0, real 4 | 0 | `null` |
| P8 semana de P1, semanal 10, real 25 | 10 | 250 |

## Auditoría

Los hooks del modelo, no el servicio. Prueba `marketing-dashboard-target.audit.spec.ts`, actor `99999999-9999-4999-8999-999999999999`, meta `55555555-5555-4555-8555-555555555555`.

Alta, una fila:

```json
{
  "tabla": "marketing_dashboard_targets",
  "registroId": "55555555-5555-4555-8555-555555555555",
  "accion": "INSERT",
  "usuarioId": "99999999-9999-4999-8999-999999999999",
  "valorAnterior": null
}
```

Cambio de `weekly_target` de 10 a 12, una fila. Un lote que no toca las otras métricas no deja `UPDATE` de esas:

```json
{
  "tabla": "marketing_dashboard_targets",
  "registroId": "55555555-5555-4555-8555-555555555555",
  "accion": "UPDATE",
  "campoModificado": "weekly_target",
  "valorAnterior": "10",
  "valorNuevo": "12",
  "usuarioId": "99999999-9999-4999-8999-999999999999"
}
```

Eliminación, una fila:

```json
{
  "tabla": "marketing_dashboard_targets",
  "registroId": "55555555-5555-4555-8555-555555555555",
  "accion": "DELETE",
  "usuarioId": "99999999-9999-4999-8999-999999999999",
  "valorNuevo": null
}
```

La migración no dispara hooks: el soft-delete del grano viejo no escribió `audit_log`.

## Pruebas

```text
npx jest --forceExit --no-coverage src/modules/demand-generation/lib/weekly-goal-attainment.spec.ts src/modules/demand-generation/services/marketing-dashboard-targets.service.spec.ts src/modules/demand-generation/services/marketing-dashboard-targets.permissions.spec.ts src/modules/demand-generation/models/marketing-dashboard-target.audit.spec.ts --runInBand
Test Suites: 4 passed, 4 total
Tests:       29 passed, 29 total

npx jest --forceExit --no-coverage src/modules/demand-generation/migrations/reshape-marketing-dashboard-targets.spec.ts --runInBand
Test Suites: 1 passed
Tests:       5 passed
```

## Incidente al deshacer en la base de desarrollo

`npm run migration:undo` deshace la última migración por nombre, no esta. En esa base las últimas eran las de invitados de la cita SQL, posteriores a las de metas. Se revirtieron y se volvieron a aplicar enseguida:

- `20261029220100-create-sql-cita-attendees`
- `20261029220200-default-meeting-attendee-permission`

El `down` de la primera borra `sql_cita_attendees`. Al recrearla quedó en 0 filas. Siguen 7 filas en `sql_citas` y 5 en `default_meeting_attendees`. Si había snapshots de invitados en `sql_cita_attendees`, se perdieron. El permiso de Admin se reaplicó. El `down` de las metas se ejecutó después llamando el `down` de ese archivo, no con `migration:undo`.

## Riesgo de base compartida

El esquema nuevo ya está en `crm_e2e`. `crm-e2e-DesignJD` sigue leyendo `period_type`, `interactions`, `period_leads` y `converted_ouvs`. Contra esta base, su tablero de metas deja de funcionar. El snapshot conserva el grano viejo por si hace falta el `down`, y ese `down` aborta si ya hay metas vivas.

El cliente de este repo todavía muestra el donut con 50 / 3 / 3. Eso es el paso de frontend.

## STOP

Sin paso de frontend hasta aprobar este resumen.
