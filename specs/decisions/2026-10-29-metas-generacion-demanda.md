# 2026-10-29 — Metas semanales de generación de demanda

Estado: spec aprobado el 2026-10-29 con S1–S4. Cierre del 2026-10-29 con F1 y F2. No cambia el stack ni agrega dependencias.

Descubrimiento: `specs/demand-goals/RESUMEN-PASO-0.md`.

## D1 — Tabla

Se extiende `marketing_dashboard_targets`. No se crea `demand_goals`. El archivo `20260918050000-create-marketing-dashboard-targets.js` no se porta a este repo: en certificación y producción la tabla puede no existir, y en la base local ya está registrada en `SequelizeMeta`.

## D2 — Datos actuales

No se heredan los 50 / 3 / 3. La migración marca las filas vivas del grano viejo con `deleted_at` y no inserta metas vivas. El tablero muestra «Sin meta definida» hasta que el Director cargue metas. El cliente deja de usar 50, 3 y 3 fijos.

## D3 — API y permiso

Rutas bajo el prefijo que ya usa el tablero:

- `GET /api/v1/dashboard/marketing/goals?year=YYYY`
- `PUT /api/v1/dashboard/marketing/goals` — lote de las tres métricas de un trimestre (S1)
- `DELETE /api/v1/dashboard/marketing/goals/:id`

Subject CASL `DemandGoal` con `create`, `read`, `update` y `delete`, solo para `DirectorMercadeo` y `Admin`, en `buildPermissions` y en una migración de permisos al patrón de `CommercialGoal`. El engranaje mira `user.permissions`: se muestra con `create` o `update`. No compara el nombre del rol. `read` solo no lo muestra.

`DELETE` es soft-delete, el mismo verbo que ya usa `CommercialGoal`.

## D4 — Auditoría

Solo `AuditHooksService`. El modelo entra en `SequelizeModule.forFeature` antes de que `onModuleInit` recorra `sequelize.models`. No hay `AuditService.log` en el servicio. El writer sigue fuera de la transacción de negocio; no se abre otro mecanismo.

## D5 — Tarjeta

Copy de la tercera tarjeta: «Convertidos a OUV». Barra de progreso con cortes &lt;70 % (`danger`), 70–99 % (`warning`) y ≥100 % (`semaphore-verde`). La tarjeta deja el donut.

## A1 — Migración en base limpia y en base vieja

Una migración, idempotente, con `down` funcional:

- Si la tabla no existe, la crea ya con el esquema nuevo y sin filas.
- Si existe con `period_type`, vuelca las filas a `marketing_dashboard_targets_legacy_snapshot` (solo para poder deshacer), las deja eliminadas en el grano nuevo y quita las columnas viejas.
- El snapshot no tiene modelo Nest. `down` lo usa para reconstruir el grano viejo y después lo elimina.
- Si ya hay metas vivas del esquema nuevo, `down` aborta y no toca la tabla.

El spec trae un caso de prueba por escenario.

## A2 — Sin periodo

Sin año y sin fechas, la tarjeta dice «Selecciona un período». En el API, `target` y `attainment_pct` son `null`. Eso se distingue de una meta prorrateada 0, que responde `target: 0`, `attainment_pct: null` y en la tarjeta «Sin meta definida».

Los contadores numéricos de `weekly` se conservan. La comparación viaja en `weekly.goals`.

## S1 — PUT en lote

`PUT /api/v1/dashboard/marketing/goals` recibe `{ fiscal_year, quarter, goals: [{ metric, weekly_target }] }` con las tres métricas, en una transacción. Si una fila falla, no se guarda ninguna. Cada fila nueva exige `create` y cada fila viva exige `update`. La auditoría sigue en `AuditHooksService`, una fila por registro.

## S2 — Cero y borrado

`weekly_target = 0` se guarda. En el tablero ese tramo aporta 0, igual que un tramo sin fila. `DELETE /goals/:id` hace soft-delete de esa fila.

## S3 — Una sola fórmula

La meta se define y se mide por semana. Para cualquier rango, `target` es la suma por tramo de Q de `weekly_target × (días ÷ 7)`, redondeada una vez. No hay meta de quincena ni de trimestre. Lo que el formulario muestra para 14 días o para el trimestre es la misma fórmula; no se persiste.

## S4 — Casos P1–P8

Sustituyen los ejemplos que medían un trimestre completo o una quincena como si fueran otra meta. Quedan en la sección 4 del spec, cada uno con rango, metas semanales, `target` y `attainment_pct`.

## A3 — Base compartida con el diseño

Quitar `period_type`, `interactions`, `period_leads` y `converted_ouvs` rompe `crm-e2e-DesignJD` si apunta a la misma base. El detalle está en `specs/demand-goals/RESUMEN-PASO-1.md`. Este cambio no modifica ese repo.

## UI implementada

El modal no copia el acordeón Anual / Trimestre / Quincena / Semana de `crm-e2e-DesignJD`. Edita un año y un trimestre. Las tres métricas salen en un solo PUT. La ayuda bajo cada input es «≈ X por quincena · ≈ Y en el trimestre» y no se guarda. Las tarjetas muestran Real, «Meta del período», el porcentaje y una barra. La tercera dice «Convertidos a OUV». Quitar metas es un botón aparte, con confirmación y un DELETE por id. Vaciar un campo no borra la fila.

## F1 — Mensajes 400

El modal normaliza el cuerpo 400 del `ValidationPipe` global. Si `message` es un arreglo, muestra cada texto sin el prefijo de ruta (`goals.2.`). El pipe y el backend no cambian. El formato de ese cuerpo sigue pendiente: no trae `code: "VALIDATION"`.

## F2 — Tres campos vacíos

Si el trimestre tiene metas vivas y los tres campos quedan vacíos, Guardar se deshabilita y se muestra «Para quitar las metas usa "Quitar metas del Q"». Si el trimestre no tiene metas y los tres están vacíos, Guardar sigue deshabilitado.
