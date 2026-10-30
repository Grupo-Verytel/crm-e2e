# Spec — Metas semanales de generación de demanda

Estado: aprobado el 2026-10-29, con S1–S4. Cierre del 2026-10-29 (F1–F2). Frontend implementado.
Decisiones: `specs/decisions/2026-10-29-metas-generacion-demanda.md`.
Descubrimiento: `specs/demand-goals/RESUMEN-PASO-0.md`.

Alcance: metas semanales por año fiscal Verytel, trimestre y métrica, sobre la tabla `marketing_dashboard_targets`, y la comparación en las tres tarjetas de `/demand/dashboard`.

Fuera de alcance: el embudo (TOFU, MOFU, BOFU, MQL pendientes, SQL), el tiempo promedio, las barras por canal y las barras por segmento. Sus cálculos no cambian. El detalle de «Ver datos» sigue en `ModalShell`. La ruta `/demand/dashboard` para roles sin pestaña queda como pendiente en el resumen del Paso 1; este spec no la cierra.

## 1. Modelo

Tabla existente o, en una base limpia, creada por esta migración: `marketing_dashboard_targets`. Nombres de columna en inglés. `paranoid: true`.

| Columna | Tipo | Notas |
|---|---|---|
| `target_id` | `CHAR(36)` PK | UUID v4 |
| `fiscal_year` | `SMALLINT` NOT NULL | Año fiscal en que empieza el trimestre. Sin DEFAULT |
| `quarter` | `TINYINT` NOT NULL | 1–4. Sin DEFAULT |
| `metric` | `ENUM('INTERACTIONS','LEADS','CONVERTED_OUV')` NOT NULL | Una fila por métrica. Códigos en inglés, como el `period_type` que esta tabla ya tenía |
| `weekly_target` | `INT` NOT NULL | Entero ≥ 0. Sin DEFAULT |
| `created_at` / `updated_at` | `DATE` NOT NULL | UTC |
| `deleted_at` | `DATE` NULL | Soft-delete |
| `active_marker` | `TINYINT` generada STORED | `IF(deleted_at IS NULL, 1, NULL)` |

Índice único `uq_marketing_dashboard_targets_active` sobre `(fiscal_year, quarter, metric, active_marker)`.

El modelo Sequelize no declara `active_marker` como atributo escribible. No hay `created_by`.

Columnas que el esquema nuevo ya no tiene: `period_type`, `interactions`, `period_leads`, `converted_ouvs`.

Métrica y contador del tablero:

| `metric` | Contador que ya existe | Etiqueta de UI |
|---|---|---|
| `INTERACTIONS` | `weekly.interactions` | Interacciones |
| `LEADS` | `weekly.new_leads` | La que ya calcula `periodLeadsLabel` |
| `CONVERTED_OUV` | `weekly.converted_ouvs` | Convertidos a OUV |

## 2. Migración de esquema

Archivo `backend/database/migrations/20261029120000-reshape-marketing-dashboard-targets.js`. No se agrega `20260918050000-create-marketing-dashboard-targets.js`.

Inspecciona `information_schema` en `DATABASE()`. Cada paso comprueba si la tabla, la columna o el índice ya están, al estilo de `20261020231000-create-commercial-goals.js`.

DDL de MySQL hace commit implícito. Por eso `up` tiene que poder retomarse a medias.

### 2.1 Camino limpio

La tabla no existe.

`up` crea el esquema de la sección 1, con cero filas, y no crea la tabla snapshot. Un segundo `up` no inserta filas ni cambia columnas.

### 2.2 Camino grano viejo

La tabla existe y tiene la columna `period_type`.

1. Si no existe `marketing_dashboard_targets_legacy_snapshot`, crearla con el grano viejo: `target_id`, `period_type` ENUM `annual|quarter|biweekly|weekly`, `interactions`, `period_leads`, `converted_ouvs`, `created_at`, `updated_at`, `deleted_at`.
2. Copiar ahí cada fila de la tabla principal que aún no esté en el snapshot (misma `target_id`). La copia ocurre antes de tocar `deleted_at`, para que el snapshot guarde el estado previo, incluidos los números y un `deleted_at` que ya viniera poblado.
3. `UPDATE` de las filas vivas: `deleted_at` = ahora. No se insertan filas nuevas.
4. Agregar `fiscal_year`, `quarter`, `metric` y `weekly_target` si faltan. En las filas ya existentes (todas eliminadas a esta altura, o ya eliminadas de antes) rellenar solo para poder poner NOT NULL: `fiscal_year = 2026`, `quarter = 1`, `metric = 'INTERACTIONS'`, `weekly_target = 0`. Esos valores no son una meta de negocio. No se copia 50, 3 ni 3 a `weekly_target`.
5. Quitar el índice único de `period_type`, sea cual sea su nombre (`SHOW INDEX` / `information_schema.STATISTICS`, columna `period_type`, único).
6. Quitar `period_type`, `interactions`, `period_leads` y `converted_ouvs`.
7. Dejar las columnas nuevas en NOT NULL y sin DEFAULT.
8. Agregar `active_marker` y el índice único de la sección 1 si faltan.

La aplicación Nest no mapea el snapshot. Un segundo `up`, ya sin `period_type`, no vuelve a copiar ni borra metas vivas que se hayan cargado después.

### 2.3 `down`

1. Si la tabla principal no existe, termina.
2. Si hay alguna fila con `deleted_at IS NULL`, lanza `Down bloqueado: hay metas de demanda vivas.` y no modifica nada. El snapshot, si existe, se queda.
3. Si no hay filas vivas, no existe el snapshot y hay alguna fila (también eliminada), lanza `Down bloqueado: la tabla ya tiene filas del esquema nuevo.` y no modifica nada.
4. Si existe el snapshot y no hay filas vivas: elimina la tabla principal, recrea el grano viejo (único de `period_type` incluido), inserta las filas del snapshot con sus `target_id`, números y `deleted_at` originales, y elimina el snapshot.
5. Si no existe el snapshot y la tabla principal no tiene filas: elimina la tabla principal.

### 2.4 Casos de prueba

Cada caso llama `up` y `down` exportados por la migración, contra un esquema MySQL aislado. No se ejecutan contra la base de `backend/.env` si el host no es local.

**T1 — Limpia.** La tabla no existe. Tras `up`: esquema nuevo, 0 filas, snapshot ausente. Un segundo `up` sigue en 0 filas. `down` deja la tabla y el snapshot ausentes. Un `up` posterior vuelve a crear el esquema nuevo vacío.

**T2 — Grano viejo.** Cuatro filas vivas con `target_id` fijos y números distintos (la fila `weekly` puede ser 50 / 3 / 3; `annual`, `quarter` y `biweekly` llevan otros enteros). Tras `up`: 0 filas con `deleted_at IS NULL`; no quedan las columnas viejas; están `fiscal_year`, `quarter`, `metric`, `weekly_target` y `active_marker`; existe `uq_marketing_dashboard_targets_active`; el snapshot tiene las cuatro filas con los mismos `target_id`, `period_type`, números y `deleted_at` NULL; toda fila que quede en la tabla principal tiene `deleted_at` poblado y `weekly_target = 0`. Un segundo `up` deja el snapshot en cuatro filas y sigue sin filas vivas. `down` restaura el grano viejo con esos cuatro `target_id` y esos números, y borra el snapshot. Otro `up` vuelve a dejar 0 filas vivas.

**T3 — Ya migrada.** Esquema nuevo con una fila viva `weekly_target = 8` y sin snapshot. `up` no la borra, no cambia el 8 y no crea snapshot.

**T4 — `down` con metas vivas.** El estado de T3. `down` lanza el mensaje de la sección 2.3 y la fila sigue viva con 8.

**T5 — Retoma.** Grano viejo, snapshot ya cargado con las cuatro filas, columnas nuevas ya agregadas y filas todavía vivas. `up` termina en el esquema nuevo, con 0 filas vivas y el snapshot sin duplicar `target_id`.

## 3. Permisos

Segunda migración: `backend/database/migrations/20261029120100-demand-goal-permissions.js`.

Agrega a las filas `DirectorMercadeo` y `Admin` las cuatro reglas `{ action, subject: "DemandGoal" }` para `create`, `read`, `update` y `delete`, solo si esa regla no está. No inserta roles. Si `DirectorMercadeo` no existe, no lo crea. `down` quita solo esas cuatro reglas de esos dos nombres.

`buildPermissions` (`backend/database/seeders/lib/role-permissions.js`): subject `DemandGoal` bajo la clave `demand-goals`, con `CRUD` en `Admin` y en `DirectorMercadeo`. Ningún otro rol de la matriz.

| Rol | `DemandGoal` |
|---|---|
| DirectorMercadeo | create, read, update, delete |
| Admin | create, read, update, delete |
| GestorMercadeo y cualquier otro | ninguno |

Quien puede `read` de `Lead` sigue pudiendo abrir `GET /dashboard/marketing`. La comparación va dentro de esa respuesta. No necesita `DemandGoal` para ver las tarjetas.

## 4. Prorrateo

La meta se define y se mide por semana. No hay meta almacenada de quincena ni de trimestre. Cualquier rango usa la misma fórmula.

Función pura. El rango es el mismo que ya usa `getActiveLeadDateRange`: si vienen `period_from` y `period_to`, ese intervalo manda; si no, y `year` ≥ 2000, manda `marketingFiscalRange`; si no hay ninguno, no hay rango.

El fin es exclusivo. Las fechas del tablero siguen ancladas a la medianoche de America/Bogota.

Se cuenta cada día de calendario Bogota cuyo inicio cae en `[inicio, fin)`. El día entero pertenece al trimestre de `verytelQuarterOf`. Enero pertenece al Q4 del año fiscal anterior. Diciembre y enero del mismo trimestre fiscal usan la meta de ese Q4.

Para cada métrica:

`suma = Σ (weekly_target del tramo × días del tramo ÷ 7)`

Un tramo sin fila viva aporta 0. Un `weekly_target` de 0 aporta 0: para el tablero equivale a no tener meta en ese tramo. `target = Math.round(suma)` una sola vez, sobre el total.

| Condición | `target` | `attainment_pct` |
|---|---|---|
| No hay rango | `null` | `null` |
| Hay rango y `target` queda 0 | `0` | `null` |
| Hay rango y `target` > 0 | ese entero | `Math.round(actual / target × 100)`, sin tope |

`actual` es el contador que el tablero ya calcula para esa métrica.

Los días de cada trimestre solo alimentan la ayuda del formulario y salen del calendario: Q1 no bisiesto 89, Q1 bisiesto 90, Q2 92, Q3 92, Q4 92. Esa ayuda aplica esta misma fórmula; no guarda otra meta.

### Casos P1–P8

Rango `[inicio, fin)` en medianoche America/Bogota. Métrica `INTERACTIONS`. `actual` es el dato del caso.

| Caso | Rango | Metas semanales vivas | `actual` | `target` | `attainment_pct` |
|---|---|---|---|---:|---:|
| P1 Semana dentro de un solo Q | 4 may 2026 → 11 may 2026 | Q2 2026 = 10 | 5 | 10 | 50 |
| P2 Semana que cruza Q3→Q4 | 28 oct 2026 → 4 nov 2026 (4 días de Q3 y 3 de Q4) | Q3 2026 = 10, Q4 2026 = 8 | 5 | 9 | 56 |
| P3 Semana dic→ene, mismo Q4 fiscal | 28 dic 2026 → 4 ene 2027 | Q4 2026 = 14. Una fila de Q1 2027 = 99 no entra | 7 | 14 | 50 |
| P4 Semana ene→feb, cambia el año fiscal | 27 ene 2027 → 3 feb 2027 (5 días de Q4 2026 y 2 de Q1 2027) | Q4 2026 = 7, Q1 2027 = 14 | 18 | 9 | 200 |
| P5 Un tramo sin meta | El rango de P2 | Solo Q3 2026 = 7 | 2 | 4 | 50 |
| P6 Sin rango | ninguno | Q2 2026 = 10 | 0 | `null` | `null` |
| P7 Meta total 0 | El rango de P1 | Q2 2026 = 0 | 4 | 0 | `null` |
| P8 Real por encima de la meta | El rango de P1 | Q2 2026 = 10 | 25 | 10 | 250 |

P2: `Math.round(10 × 4 / 7 + 8 × 3 / 7) = Math.round(9.142…) = 9`, y `Math.round(5 / 9 × 100) = 56`. P4: `7 × 5 / 7 + 14 × 2 / 7 = 9`. P5: `7 × 4 / 7 = 4`.

## 5. API

Prefijo `api/v1`. Módulo Nest ya existente `demand-generation`. Controlador de dashboard, rutas literales `marketing/goals` declaradas de forma que no las capture otro parámetro. JWT en todas.

### 5.1 `GET /dashboard/marketing/goals?year=`

Ability `read` sobre `DemandGoal`. `year` es obligatorio, entero 2000–2100.

```json
{
  "fiscal_year": 2026,
  "quarters": [
    { "quarter": 1, "days": 89 },
    { "quarter": 2, "days": 92 },
    { "quarter": 3, "days": 92 },
    { "quarter": 4, "days": 92 }
  ],
  "items": [
    {
      "target_id": "uuid",
      "fiscal_year": 2026,
      "quarter": 1,
      "metric": "INTERACTIONS",
      "weekly_target": 10,
      "created_at": "2026-10-29T18:00:00.000Z",
      "updated_at": "2026-10-29T18:00:00.000Z"
    }
  ]
}
```

`quarters` siempre trae los cuatro trimestres de ese año fiscal. `days` sale del calendario (Q1 2024 → 90). `items` solo incluye filas vivas. Un año sin metas devuelve `items: []`.

### 5.2 `PUT /dashboard/marketing/goals`

Un solo cuerpo, con las tres métricas del trimestre:

```json
{
  "fiscal_year": 2026,
  "quarter": 1,
  "goals": [
    { "metric": "INTERACTIONS", "weekly_target": 10 },
    { "metric": "LEADS", "weekly_target": 3 },
    { "metric": "CONVERTED_OUV", "weekly_target": 0 }
  ]
}
```

`goals` trae exactamente una entrada de cada métrica. El 0 es válido.

Todo el lote corre en una transacción. Si una fila no pasa validación, le falta el permiso que le corresponde o el índice único rechaza el alta, no queda ninguna escritura de ese request.

Cada métrica sin fila viva exige `create`. Cada métrica con fila viva exige `update`. Si falta uno de esos permisos, 403 y la transacción no escribe. DirectorMercadeo y Admin tienen las cuatro acciones.

La escritura es `create` o `update` del modelo, para que corran `afterCreate` y `afterUpdate`. No se usa `Model.upsert`. Cada registro deja su propia fila de auditoría.

Respuesta 201 si el lote creó al menos una fila, 200 si las tres ya existían. Cuerpo `{ fiscal_year, quarter, items }` con las tres metas, en orden Interacciones, Leads, Convertidos a OUV.

Dos altas simultáneas de la misma combinación: el índice único decide. La perdedora responde 409 `{ code: "CONFLICT", message, existing_goal_id }` y su lote no queda guardado. Mensaje: `Ya existe una meta semanal de {etiqueta} para Q{n} {año}.` Etiquetas: Interacciones, Leads, Convertidos a OUV.

Si una fila viva recibe el mismo `weekly_target`, responde dentro del lote y no deja fila de auditoría de UPDATE para esa métrica.

### 5.3 `DELETE /dashboard/marketing/goals/:id`

Ability `delete` sobre `DemandGoal`. Soft-delete. Responde 200 `{ deleted: true }`. Id desconocido o ya eliminado: 404 `{ code: "NOT_FOUND", message: "No se encontró la meta." }`. Id que no es UUID: 400.

Después del delete, un PUT del trimestre vuelve a crear esa métrica. Las otras dos filas del trimestre no se borran.

### 5.4 Errores

Cuerpo `{ code, message }`. El 409 agrega `existing_goal_id`.

| Caso | HTTP | code | message |
|---|---|---|---|
| `weekly_target` ausente, decimal, negativo o mayor que 2147483647 | 400 | `VALIDATION` | `La meta semanal debe ser un entero entre 0 y 2147483647.` |
| `quarter` fuera de 1–4 | 400 | `VALIDATION` | `El trimestre debe estar entre 1 y 4.` |
| `year` o `fiscal_year` fuera de 2000–2100 | 400 | `VALIDATION` | `El año fiscal debe estar entre 2000 y 2100.` |
| `goals` sin las tres métricas, con una métrica repetida o con una métrica fuera del ENUM | 400 | `VALIDATION` | `La métrica no es válida.` |
| Sin la ability que corresponde a alguna fila del lote, o sin `delete` en el DELETE | 403 | | El cuerpo que ya responde `CaslGuard`: `{ code: "FORBIDDEN", message: "Insufficient permissions" }` |
| Id de delete inexistente | 404 | `NOT_FOUND` | `No se encontró la meta.` |
| Duplicado vivo en el PUT | 409 | `CONFLICT` | El mensaje de la sección 5.2 |

Un lote con una sola métrica inválida responde 400 y no guarda las otras. El 0 se guarda. En el prorrateo ese tramo aporta 0.

### 5.5 `GET /dashboard/marketing`

Sigue con ability `read` sobre `Lead`. Los contadores numéricos de `weekly` siguen igual (`interactions`, `new_leads`, `converted_ouvs` y el resto de campos de canal). Se agrega `weekly.goals`:

```json
{
  "interactions": { "actual": 12, "target": 10, "attainment_pct": 120 },
  "leads": { "actual": 4, "target": 8, "attainment_pct": 50 },
  "converted_ouv": { "actual": 0, "target": 2, "attainment_pct": 0 }
}
```

`goals.interactions.actual` es `weekly.interactions`. `goals.leads.actual` es `weekly.new_leads`. `goals.converted_ouv.actual` es `weekly.converted_ouvs`. El objeto `goals` va siempre. Sin rango, los tres `target` y `attainment_pct` son `null` (P6). Con rango y total 0, `target` es 0 y `attainment_pct` es `null` (P7). `GET /dashboard/marketing/details` no cambia.

## 6. Auditoría

Al registrar el modelo en el módulo, `AuditHooksService.onModuleInit` le cuelga `afterCreate`, `afterUpdate` y `afterDestroy`. El servicio de metas no escribe `audit_log`.

La migración corre en SQL y no dispara esos hooks: el soft-delete del grano viejo no deja filas de auditoría.

El alta deja `INSERT` con `usuario_id` del actor. Cambiar `weekly_target` deja `UPDATE` con `campo_modificado = weekly_target`, `valor_anterior` y `valor_nuevo`. El soft-delete deja `DELETE`. `updated_at` no genera fila, que es lo que el hook ya omite.

## 7. Requisitos EARS

### REQ-01 (Ubicuo)

El sistema deberá persistir cada meta con año fiscal, trimestre (1–4), métrica y meta semanal entera ≥ 0.

Criterio: un PUT de un trimestre sin filas vivas crea tres filas y responde 201 con `fiscal_year`, `quarter` y tres `items`. Un `weekly_target` de 0 queda guardado.

### REQ-02 (No deseado)

Si ya existe una meta viva para alguna métrica del lote, el sistema deberá actualizarla cuando el actor tiene `update`, y deberá rechazar con 409 una inserción concurrente de la misma combinación, sin dejar escrituras de ese lote.

Criterio: el segundo PUT del mismo trimestre responde 200, conserva los tres `target_id` y cambia los `weekly_target` enviados. Una métrica que llega con el mismo valor no deja `UPDATE` de auditoría.

### REQ-03 (No deseado)

Si el año está fuera de 2000–2100, el trimestre no está entre 1 y 4, el lote no trae las tres métricas distintas o alguna meta semanal no es un entero entre 0 y 2147483647, el sistema deberá rechazar con 400 y no guardar ninguna fila del lote.

Criterio: año 1999 y 2101, Q 0 y 5, una métrica repetida, una métrica ausente, métrica `WEEKLY`, decimal, negativo y 2147483648 responden 400. En un lote donde solo la tercera métrica es negativa, las dos primeras no quedan persistidas.

### REQ-04 (No deseado)

Si el actor no tiene `create` para una métrica nueva del lote, o no tiene `update` para una métrica viva, o no tiene `DemandGoal`, el sistema deberá responder 403 y no escribir.

Criterio: un ability con solo `update` recibe 403 en un PUT de trimestre vacío y no crea filas. Un ability con solo `create` recibe 403 en un PUT de tres filas vivas y no las modifica. `GestorMercadeo` recibe 403 en GET, PUT y DELETE. `DirectorMercadeo` y `Admin` en `buildPermissions` tienen las cuatro. `CaslGuard` niega `read DemandGoal` y `delete DemandGoal` a quien no traiga la regla.

### REQ-05 (Ubicuo)

La eliminación por id deberá ser lógica y deberá permitir volver a crear esa métrica.

Criterio: tras DELETE, `deleted_at` queda poblado, un GET del año ya no trae ese `target_id` y las otras métricas del trimestre siguen vivas. Un PUT del trimestre crea de nuevo la métrica borrada. Un DELETE del mismo id responde 404.

### REQ-06 (Evento)

Cuando la migración corra sobre una base sin la tabla, el sistema deberá crear el esquema nuevo vacío, y el `down` de ese estado deberá dejar la base sin la tabla.

Criterio: T1.

### REQ-07 (Evento)

Cuando la migración corra sobre el grano viejo, el sistema deberá dejar cero metas vivas, conservar el estado previo en el snapshot y restaurarlo en el `down`.

Criterio: T2. Ninguna fila viva queda con `weekly_target` 50, 3 o 3 por copia del seed.

### REQ-08 (Estado)

Mientras el esquema nuevo ya esté aplicado, un nuevo `up` deberá dejar las metas vivas como están.

Criterio: T3. La retoma a medias cumple T5.

### REQ-09 (No deseado)

Si hay metas vivas del esquema nuevo, el `down` deberá abortar sin modificar la tabla.

Criterio: T4.

### REQ-10 (Ubicuo)

El sistema deberá calcular `target` y `attainment_pct` con la sección 4, sobre el mismo rango que ya usan los tres contadores.

Criterio: P1–P8. `actual` coincide con el contador numérico del mismo payload. P3 no usa la fila de Q1 2027. P4 parte el enero del Q4 anterior y el febrero del Q1 siguiente. P8 deja el porcentaje en 250.

### REQ-11 (Estado)

Mientras el tablero no tenga año ni fechas, `weekly.goals` deberá traer `target` y `attainment_pct` en `null` para las tres métricas.

Criterio: la respuesta con el query vacío trae los contadores en 0, como hoy, y los tres `target` en `null`. Con año y sin filas, los tres `target` son 0 y los tres `attainment_pct` son `null`.

### REQ-12 (Evento)

Cuando se cree, modifique o elimine una meta por el API, el sistema deberá registrar la operación en `audit_log` mediante los hooks del modelo.

Criterio: un PUT que crea las tres métricas deja tres filas `INSERT`, cada una con el `registro_id` de su meta y el `usuario_id` del actor. Cambiar solo `weekly_target` de Interacciones de 10 a 12 deja una fila `UPDATE` con `campo_modificado = weekly_target`, `valor_anterior` 10 y `valor_nuevo` 12, y no deja `UPDATE` de las métricas que no cambiaron. El DELETE deja una fila `DELETE` de ese id. El servicio no llama al writer.

### REQ-13 (Estado)

Mientras el usuario tenga `create` o `update` sobre `DemandGoal`, el tablero deberá mostrar el engranaje. Si no tiene ninguna de las dos, el engranaje no se muestra. `read` solo no lo muestra.

Criterio: el botón usa el ícono `Settings`, va en la prop `actions` de `DemandNav`, área táctil de al menos 36 px, `title` y `aria-label` «Metas de generación de demanda», y solo consulta `user.permissions`. No compara `role_name`. GestorMercadeo ve las tarjetas y no ve el botón.

### REQ-14 (Ubicuo)

Las tres tarjetas del periodo deberán mostrar el avance contra `weekly.goals` y deberán retirar los enteros fijos 50, 3 y 3.

Criterio: la tarjeta de interacciones lee `goals.interactions`, la de leads lee `goals.leads` y la tercera lee `goals.converted_ouv`. Ningún componente de la página vuelve a pasar 50 ni 3 como meta. La tercera tarjeta y el título de su detalle dicen «Convertidos a OUV». El ícono `List` sigue abriendo el detalle.

### REQ-15 (Estado)

Mientras `target` sea `null`, la tarjeta deberá decir «Selecciona un período». Mientras `target` sea 0, deberá decir «Sin meta definida». Mientras `target` sea mayor que 0, deberá mostrar la meta prorrateada, la pastilla del porcentaje y la barra.

Criterio: sin periodo, el texto es «Selecciona un período» y no aparece la barra ni el porcentaje. Con periodo y target 0, el texto es «Sin meta definida» y no aparece la barra ni el porcentaje. Con target 10 y actual 12, el número grande es el real, con el rótulo «Real», se lee «Meta del período: 10», el porcentaje dice 120% y el ancho de la barra es 100 %.

### REQ-16 (Ubicuo)

La barra deberá usar el tono del porcentaje ya redondeado: menos de 70 `bg-danger` y `text-danger`, de 70 a 99 `bg-warning` y `text-warning`, y 100 o más `bg-semaphore-verde` y `text-semaphore-verde`.

Criterio: 69 % danger, 70 % warning, 99 % warning, 100 % verde. Esas clases salen de un `Record`. No hay hex ni fuente sueltos. Con `prefers-reduced-motion` la barra aparece sin transición. El filtro del tablero, incluido `FiscalQuarterSelect`, permanece con sus etiquetas actuales.

### REQ-17 (Evento)

Cuando el usuario abra el engranaje, el sistema deberá editar las metas semanales de un año fiscal y de un trimestre, con las tres métricas. La ayuda aplica la fórmula de la sección 4 a 14 días y a los días de ese trimestre; esos números no se guardan.

Criterio de pantalla, en `MarketingDashboardPage` y `MarketingDashboardGoalsModal`:

1. Overlay fijo, encabezado, cuerpo con scroll (`min-h-0`) y pie. Cierre con `X`, clic en el fondo y «Cancelar». Clases `ghostButtonClass` y `primaryButtonClass` de `frontend/src/modules/demand-generation/components/ui.ts`. No hay acordeón de periodo.
2. Título «Metas semanales». Subtítulo «La meta se define por semana. Quincena y trimestre usan esa misma cuenta.»
3. Año fiscal. Si el tablero ya tiene año, ese es el inicial. Si no, el año fiscal de hoy: enero cuenta para el año anterior. El trimestre inicial es el del tablero, o el de hoy si el tablero no tiene trimestre. El módulo de demanda no importa el módulo de metas comerciales.
4. Un selector de trimestre, con las mismas etiquetas que `FiscalQuarterSelect`: «Q1 · 01 feb – 30 abr», «Q2 · 01 may – 31 jul», «Q3 · 01 ago – 31 oct», «Q4 · 01 nov – 31 ene». Tres enteros con etiqueta «Meta semanal»: Interacciones, Leads del período, Convertidos a OUV.
5. Al abrir, y al cambiar año o trimestre, `GET` del año. Los campos sin fila llegan vacíos. Los `days` del response alimentan la ayuda.
6. Con un semanal escrito, la ayuda bajo ese input dice «≈ X por quincena · ≈ Y en el trimestre». Quincena = `semanal × 2`. Trimestre = `Math.round(semanal × días / 7)`. Semanal 10 en un Q de 92 días: «≈ 20 por quincena · ≈ 131 en el trimestre». Esos valores no se envían al API.
7. «Guardar metas» queda deshabilitado si no hay cambios, si los tres campos están vacíos, o mientras se envía. Las tres cifras completas, incluido el 0, salen en un solo PUT. Un trimestre con una o dos cifras muestra «Completa las tres metas del trimestre o déjalas vacías.» y no llama al API. Si el trimestre tiene metas vivas y los tres campos quedan vacíos, Guardar sigue deshabilitado y se muestra «Para quitar las metas usa "Quitar metas del Q"». Ese botón pide confirmación y hace DELETE de cada `target_id` vivo. Vaciar un campo no llama DELETE.
8. Cerrar o cambiar de año o de trimestre con cambios sin guardar pide `window.confirm`: «Hay cambios sin guardar. ¿Cerrar sin guardar?»
9. Cada campo tiene `<label>` y foco visible. El botón primario dice «Guardar metas».
10. Un 400 cuyo `message` es un arreglo se muestra en el modal, una línea por mensaje, sin el prefijo de ruta (`goals.2.`). Un 403 muestra `message`. El modal no se cierra. El `ValidationPipe` global no se modifica.

## 8. UX de la tarjeta

Se conserva `cardClass`, el número grande y el ícono `List`. El donut SVG sale de estas tres tarjetas. Bajo el número va el rótulo «Real». La meta se lee «Meta del período: N». La pista de la barra usa `bg-border`. El relleno usa el tono de REQ-16. El porcentaje usa el texto del mismo tono.

El ancho es `min(attainment_pct, 100)` por ciento. El porcentaje muestra el valor real, sin tope.

La segunda tarjeta conserva el rótulo que el tablero ya calculaba (`periodLeadsLabel`). La tercera y el título de su detalle dicen «Convertidos a OUV».

Estados de carga y de error del tablero siguen los que la página ya tiene. El modal, si el GET falla, muestra el error y no inventa días ni metas.
