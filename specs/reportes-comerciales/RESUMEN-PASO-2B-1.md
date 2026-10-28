# RESUMEN-PASO-2B-1 — Backend de Reportes

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes`
**Alcance:** permiso `CommercialReport` y tres endpoints de lectura en discovery. Sin frontend y sin commit.

`GET /discovery/ouv-dashboard` y su detalle no se tocaron. No hay tablas ni columnas nuevas. La única escritura fue el permiso en `roles.permissions`.

## 1. Migraciones

| Archivo | Qué hace |
|---|---|
| `20261028170000-commercial-report-permissions.js` | Copia de `20261020231100-commercial-goal-permissions.js`. Agrega `{ action: 'read', subject: 'CommercialReport' }` a `Admin` y `SoporteComercial` |
| `20261028170100-gerente-comercial-commercial-report.js` | Copia de `20261020120000-gerente-comercial-manage-high-value.js`. Misma regla en la fila `Gerente Comercial`. Si no existe, avisa y sigue. No crea el rol |

Las dos son idempotentes. El `down` quita solo `read` + `CommercialReport`.

La matriz de `backend/database/seeders/lib/role-permissions.js` da `R` de `commercial-reports` a `Admin` y `SoporteComercial`. `Gerente Comercial` sigue fuera de `BASE_ROLES`: el seeder no reescribe filas vivas, por eso hace falta la migración B.

Corridas con `npm run migration:run` contra `crm_e2e`. `SequelizeMeta` quedó con los dos nombres. El resto de cada JSON no cambió:

| Rol | Antes | Después | Agregado | Quitado |
|---|---|---|---|---|
| `Admin` | 99 reglas, sin `CommercialReport` | 100 | `read` `CommercialReport` | nada |
| `SoporteComercial` | 66, sin la regla | 67 | la misma | nada |
| `Gerente Comercial` | 31, sin la regla | 32 | la misma | nada |

Quien ya tiene sesión tiene que volver a entrar para que el JWT traiga la regla.

## 2. Endpoints

Prefijo `api/v1`. Los tres exigen `CheckAbility({ action: 'read', subject: 'CommercialReport' })`.

| Método | Filtros |
|---|---|
| `GET /discovery/reports/committee` | `year`, `quarter`, `period_from`, `period_to`, `comercial_id`, `segmento`, `fecha_corte` |
| `GET /discovery/reports/pipeline-health` | `comercial_id`, `segmento` |
| `GET /discovery/reports/details` | `report` (`committee` \| `pipeline-health`), `kind`, los filtros del comité, `from_estado`, `to_estado`, `resultado`, `page`, `limit` (máximo 50) |

`canReadAllOuvs` se aplica igual que en el tablero: `EjecutivoComercial` queda forzado a su `userId`. `Gerente Comercial` no está en ese corte y ve todas las OUVs; si manda `comercial_id`, el filtro sí se aplica. El guard niega a quien no tiene la regla antes de llegar al servicio. `buildPermissions('Gerente Comercial')` no incluye la regla, porque el rol no está en la matriz: la autorización del gerente es la fila que escribió la migración B.

Un `kind` de salud pedido con `report=committee` responde 400.

## 3. Contrato

### Comité

```json
{
  "period": { "period_from": "2026-08-01", "period_to": "2026-10-31", "year": 2026, "quarter": 3 },
  "fecha_corte": "2026-10-21",
  "as_of": "2026-10-28",
  "excluded_synthetic": 7,
  "m003": {
    "mobilized": { "ouv_count": 0, "event_count": 0, "amount": 0 },
    "new_ouvs": { "ouv_count": 0, "event_count": 0, "amount": 0 },
    "zone_changes": { "ouv_count": 0, "event_count": 0, "amount": 0 },
    "amount_changes": { "ouv_count": 0, "event_count": 0, "amount": 0 },
    "won": { "ouv_count": 0, "event_count": 0, "amount": 0 },
    "lost": { "ouv_count": 0, "event_count": 0, "amount": 0 }
  },
  "m035": {
    "advances": { "count": 0, "amount": 0, "cells": [{ "from_estado": "UNIVERSO", "to_estado": "EN_FUNNEL", "count": 0, "amount": 0 }] },
    "retreats": { "count": 0, "amount": 0, "cells": [] },
    "closures": { "count": 0, "amount": 0, "cells": [] },
    "reopenings": { "count": 0, "amount": 0, "cells": [] }
  },
  "m025": {
    "by_segment": [{ "segmento": "Industria", "count": 0, "amount": 0 }],
    "by_commercial": [{ "user_id": "", "full_name": "", "count": 0, "amount": 0 }]
  },
  "m013": {
    "by_resultado": [{ "resultado": "EnCurso", "count": 0, "amount": 0, "created_in_period": 0, "created_in_period_amount": 0 }],
    "created_in_period": { "count": 0, "amount": 0 },
    "missing_expected_close": { "count": 0, "amount": 0 }
  }
}
```

`m003.mobilized.amount` es el monto actual de cada OUV movilizada, una vez. No es la suma de los cinco bloques. `event_count` del total es la suma de los `event_count` de los bloques.

`m035.*.amount` es la suma del monto actual de cada evento. Cada celda redondea sus propios eventos.

### Salud

```json
{
  "as_of": "2026-10-28",
  "m023": {
    "ranges": [{ "range": "1_2", "label": "1–2 años", "count": 0, "amount": 0 }],
    "by_segment": [{ "segmento": "Industria", "ranges": [{ "range": "1_2", "count": 0, "amount": 0 }] }],
    "by_commercial": [{ "user_id": "", "full_name": "", "ranges": [] }]
  },
  "average_age": {
    "by_segment": [{ "segmento": "Industria", "count": 0, "amount": 0, "avg_days": 0 }]
  }
}
```

Los rangos de M023 son `1_2` (>365 y ≤730 días), `2_3` (>730 y ≤1095) y `over_3` (>1095). El de más de 3 años viaja siempre, aunque el conteo sea 0.

### Detalle

`{ kind, items, total, amount_total, page, limit }`. `total` y `amount_total` son del conjunto completo; `items` es la página.

Cada ítem: `ouv_id`, `consecutivo`, `titulo`, `empresa`, `comercial`, `segmento`, `zona`, `monto`, `fecha`, y para cambios `from_estado`, `to_estado`, `changed_at`, `changed_by`, `previous_amount`, `new_amount`, `campo`. En un cambio de monto, `monto` es el valor nuevo. El literal JSON `null` sale como `null`. Un cero guardado como `"0.00"` sale como `0`. `amount_total` suma solo los `monto` numéricos.

| `kind` | `report` | Qué lista | La cifra que debe coincidir |
|---|---|---|---|
| `m003_new` | committee | OUVs creadas en la ventana | `m003.new_ouvs` |
| `m003_zone_changes` | committee | avances y retrocesos de la ventana | `event_count` y `amount` |
| `m003_amount_changes` | committee | filas de `audit_log` | `event_count` y `amount` |
| `m003_won` | committee | ganadas de la ventana | `m003.won` |
| `m003_lost` | committee | perdidas de la ventana | `m003.lost` |
| `m003_mobilized` | committee | OUVs distintas | `ouv_count` y `amount` |
| `m035_advances` | committee | avances del periodo. `from_estado` y `to_estado` recortan a una celda | `m035.advances` |
| `m035_retreats` | committee | retrocesos | `m035.retreats` |
| `m035_closures` | committee | cierres | `m035.closures` |
| `m035_reopenings` | committee | reaperturas | `m035.reopenings` |
| `m025_new` | committee | altas del periodo | suma de `m025.by_segment` |
| `m013_expected_close` | committee | embudo por fecha prevista. `resultado` recorta un grupo | suma de `by_resultado` |
| `m013_created_in_period` | committee | las del embudo creadas en el periodo | `created_in_period` |
| `m013_missing_close` | committee | abiertas sin `expected_close_date` | `missing_expected_close` |
| `m023_1_2`, `m023_2_3`, `m023_over_3` | pipeline-health | abiertas de ese rango | el rango |
| `m023_aged` | pipeline-health | las tres juntas | suma de los rangos |
| `open_average_age` | pipeline-health | todas las abiertas | conteo y monto de `average_age`. `avg_days` no es una suma |

## 4. Predicados

Universo igual al tablero: entran `origen_via = directa` y no se lee `ouv_type`. Montos en la moneda guardada. En esta base siguen en COP.

El periodo de M035, M025 y M013 es `resolveOuvDashboardPeriod`. Con año y trimestre usa `verytelFiscalPeriod`. Q3 2026 es del 1 de agosto al 31 de octubre, America/Bogota, intervalo semiabierto.

M003 no usa ese trimestre. La ventana es `[fecha_corte 00:00 Bogota, mañana 00:00 Bogota)`. Si `fecha_corte` no viene, el servidor pone hoy − 7 días.

| Bloque | Regla | Monto |
|---|---|---|
| Abierta | `isDashboardOpen`: `resultado = EnCurso` | `presupuesto_monto` |
| M003 nuevas y M025 | `created_at` en la ventana o en el periodo | `presupuesto_monto`, como `new_ouvs` del tablero |
| M003 cambios de zona | `status_history` OUV, `trigger` `ADVANCE` o `RETREAT`, sin `synthetic_entry`, `changed_at` en la ventana de comité | monto actual, una vez por evento |
| M003 cambios de monto | `audit_log` `tabla = ouvs`, `accion = UPDATE`, `campo_modificado` `presupuesto_monto` o `monto_final` | `JSON.parse` de `valor_nuevo`. `null` no suma |
| M003 ganadas | `isWonInPeriod` sobre la ventana de comité: `Ganada` y `fecha_cierre` adentro | `monto_final` |
| M003 perdidas | `isLostInPeriod` y `lostAmount` | `monto_estimado_perdido` si es > 0; si no, `presupuesto_monto` |
| M003 movilizadas | unión de los cinco bloques. Una OUV con varios eventos cuenta 1 en `ouv_count` y N en `event_count` | monto actual, una vez por OUV |
| M035 avances | `ADVANCE` en el periodo, sin sintéticas | monto actual |
| M035 retrocesos | `RETREAT` | monto actual |
| M035 cierres | `WIN`, `LOSS`, `DISCARD` | monto actual |
| M035 reaperturas | `MANUAL` | monto actual |
| `CREATE` | no es cambio de etapa | no entra |
| Sintéticas | `metadata.synthetic_entry === true` | no entran a M035 ni a los cambios de zona de M003. `excluded_synthetic` cuenta la fila una vez si cae en el periodo o en la ventana de comité |
| M013 embudo | `expected_close_date` dentro del periodo, agrupado por `resultado` | monto actual: ganada `monto_final`, perdida `lostAmount`, el resto `presupuesto_monto` |
| M013 sin fecha | `isDashboardOpen` y `expected_close_date` NULL. No depende del trimestre | `presupuesto_monto` |
| M023 | abiertas. Edad = días de calendario Bogotá entre `created_at` y hoy. 365 exactos no entra | `presupuesto_monto` |
| Edad promedio | todas las abiertas, por `segmento` | promedio de esa edad, un decimal |

Monto actual: `Ganada` → `monto_final`; `Perdida` → `lostAmount`; cualquier otro resultado → `presupuesto_monto`. `monto_estimado_perdido` no se lee en `audit_log`.

El historial de montos sigue incompleto para lo importado: en esta base hay 14 `presupuesto_monto` y 6 `monto_final`.

## 5. Cifras reales

Año fiscal 2026, Q3, `fecha_corte = 2026-10-21`, sin comercial ni segmento. `as_of = 2026-10-28`. Instante del cálculo: `2026-10-28T22:02:08.310Z` (17:02 en Bogotá). 414 OUVs. El detalle de cada `kind` coincidió con el agregado: cero diferencias.

`excluded_synthetic`: **7**. Son las siete `ADVANCE` sintéticas de Q3 del paso 2B.0. Ninguna cae en la ventana del 21 al 28 de octubre.

### M003 — del 21 al 28 de octubre

| Bloque | OUVs | Eventos | Monto COP |
|---|---|---|---|
| Nuevas | 1 | 1 | 0 |
| Cambios de zona | 0 | 0 | 0 |
| Cambios de monto | 1 | 1 | 25.000.000 |
| Ganadas | 0 | 0 | 0 |
| Perdidas | 0 | 0 | 0 |
| Movilizadas | 2 | 2 | 25.000.000 |

Las dos movilizadas son OUVs distintas: un alta con presupuesto 0 y un cambio de monto. Por eso `ouv_count` y `event_count` valen los dos 2.

### M035 — Q3

De las 187 filas OUV del trimestre, 7 son sintéticas y 6 son `CREATE`. Quedan 174.

| Bloque | Eventos | Monto actual COP |
|---|---|---|
| Avances | 100 | 71.727.500.000 |
| Retrocesos | 25 | 51.180.100.000 |
| Cierres | 43 | 33.331.700.000 |
| Reaperturas | 6 | 3.937.000.000 |

Avances: `UNIVERSO → ENCIMA_FUNNEL` 59, `ENCIMA_FUNNEL → EN_FUNNEL` 22, `EN_FUNNEL → MAYOR_PROBABILIDAD` 14, `UNIVERSO → EN_FUNNEL` 4, `ENCIMA_FUNNEL → MAYOR_PROBABILIDAD` 1.

Retrocesos: `EN_FUNNEL → ENCIMA_FUNNEL` 12, `MAYOR_PROBABILIDAD → EN_FUNNEL` 5, `ENCIMA_FUNNEL → UNIVERSO` 5, `EN_FUNNEL → UNIVERSO` 2, `MAYOR_PROBABILIDAD → ENCIMA_FUNNEL` 1.

Cierres: 15 hacia `Ganada`, 27 hacia `Perdida`, 1 `EnCurso → Descartada`.

Reaperturas: 5 `Ganada → EnCurso`, 1 `Perdida → EnCurso`.

Estos cierres son filas de `status_history` en el trimestre. Las ganadas y perdidas de M003 son otra cosa: `fecha_cierre` dentro de la ventana del comité. En esos ocho días no hubo ninguna.

### M025 — altas de Q3

80 OUVs. Monto `presupuesto_monto` 49.621.100.000.

| Segmento | Cantidad | Monto COP |
|---|---|---|
| Gobierno central | 38 | 27.515.000.000 |
| Defensa y seguridad | 28 | 10.656.600.000 |
| Ciudades y gobernaciones | 12 | 11.299.500.000 |
| Industria | 1 | 150.000.000 |
| Otros | 1 | 0 |

Por comercial: Katherine Arandia Rodriguez 36, Carolina Arias 18, Mauricio Velazquez 10, Miguel Rico 9, Evilio Polo 4, Dani Rodríguez 3.

### M013 — fecha prevista en Q3

| Resultado | Cantidad | Monto COP | Creadas en el trimestre |
|---|---|---|---|
| EnCurso | 33 | 55.522.875.210 | 11 |
| Perdida | 28 | 22.780.000.000 | 2 |
| Ganada | 6 | 1.919.600.000 | 2 |

Creadas en el trimestre, dentro de ese embudo: 15 OUVs, 13.064.600.000.

Sin fecha prevista, abiertas de todo el universo filtrado: **27**, monto 6.025.500.000. Es el mismo 27 del paso 2B.0.

### Salud al 28 de octubre

Abiertas con más de 365 días: 11. Ninguna pasa de 3 años.

| Rango | Cantidad | Monto COP |
|---|---|---|
| 1–2 años | 10 | 26.347.025.210 |
| 2–3 años | 1 | 1.918.000.000 |
| Más de 3 años | 0 | 0 |

Por segmento, las de 1–2 años: Gobierno central 6, Ciudades y gobernaciones 2, Defensa y seguridad 2. La de 2–3 años es de Ciudades y gobernaciones.

Edad promedio de todas las abiertas:

| Segmento | Abiertas | Días promedio |
|---|---|---|
| Ciudades y gobernaciones | 24 | 175,1 |
| Defensa y seguridad | 61 | 121,6 |
| Gobierno central | 59 | 147,2 |
| Industria | 2 | 109 |
| Otros | 1 | 7 |

## 6. Pruebas y build

| Chequeo | Resultado |
|---|---|
| Jest `commercial-report` | 4 suites, 30 tests, exit 0 |
| Jest `ouv-dashboard` y `status-history-trigger` | siguen en verde |
| `npm run build` | exit 0 |
| `eslint` sin `--fix` sobre los archivos de este paso | exit 0 |

Cubren: cada `kind` con la suma del detalle igual al agregado; una sintética del periodo fuera de M035 y de M003 y dentro de `excluded_synthetic`; una reapertura `MANUAL` en Reaperturas; `valor_anterior = null` devuelto como `null`; una OUV con alta y cambio de zona que suma 1 en movilizadas y 2 en `event_count`; 403 en las tres rutas para un rol sin la regla; `Gerente Comercial` sin `comercial_id` no restringe el `where`.

## Cierre

Paso 2B.2 (frontend) y el commit esperan aprobación.
