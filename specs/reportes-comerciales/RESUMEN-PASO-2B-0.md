# RESUMEN-PASO-2B-0 — Diagnóstico de Reportes

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes`
**Alcance:** solo lectura. No hay migración, no hay cambio de `roles.permissions` y no hay código de los endpoints.

La base es la misma de `RESUMEN-PASO-2A-1.md`: `crm_e2e` en el host de `backend/.env`. Sesión MySQL en `+00:00`, igual que `timezone: '+00:00'` de `database.config.ts`. Q3 fiscal 2026 sale de `verytelQuarterRange(2026, 3)`: desde `2026-08-01 05:00:00.000` UTC (1 ago 00:00 America/Bogota) hasta antes de `2026-11-01 05:00:00.000` UTC (1 nov 00:00 America/Bogota).

## 1. Permisos vivos

`roles.permissions` es `JSON`. El seeder `backend/database/seeders/20250626120000-seed-base-roles.js` inserta un rol de `BASE_ROLES` solo cuando ese `name` todavía no existe. No reescribe el JSON de una fila ya creada. Lo que llega a las filas de este ambiente lo escriben migraciones: leen el arreglo, agregan la regla si falta y hacen `UPDATE` de esa fila. Son idempotentes y el `down` quita solo esa regla.

| Permiso | Dónde queda para un ambiente nuevo | Qué parchó las filas vivas | Roles |
|---|---|---|---|
| `CommercialGoal` `create/read/update/delete` | `MATRIX` de `backend/database/seeders/lib/role-permissions.js`, clave `commercial-goals: CRUD` | `20261020231100-commercial-goal-permissions.js` | `Admin`, `SoporteComercial` |
| `manage_high_value` sobre `Account` | `buildPermissions`, después de la matriz, porque la acción no entra en `C/R/U/A/X/D` | `20261018120100-account-high-value-permission.js` | `Admin`, `SoporteComercial` |
| El mismo `manage_high_value` para el gerente | No está en `BASE_ROLES` ni en `MATRIX` | `20261020120000-gerente-comercial-manage-high-value.js` | `Gerente Comercial` |

La migración del gerente importa `GERENTE_COMERCIAL_ROLE_NAME` (`Gerente Comercial`, con espacio) desde `backend/src/modules/auth/constants/commercial-role-names.js`. Si la fila no está, escribe un `console.warn` y termina. No crea el rol y no lo renombra. El spec de ese archivo está en `backend/src/modules/auth/constants/commercial-roles.spec.ts`.

`SequelizeMeta` de esta base tiene las tres migraciones. El JSON vivo coincide:

| Rol | `role_id` | Reglas | Lo que ya tiene | `CommercialReport` |
|---|---|---|---|---|
| `Admin` | `e1e06161-6277-42c2-b9a2-3bab07926d15` | 99 | `manage_high_value` + CRUD de `CommercialGoal` | ausente |
| `SoporteComercial` | `4e539af2-2a6e-45a0-96a6-439c43327696` | 66 | lo mismo | ausente |
| `Gerente Comercial` | `c306c9d3-1a8c-470a-8eb3-4c2f80abbaa9` | 31 | `manage_high_value`. Sin `CommercialGoal` | ausente |

`Gerente Comercial` existe, `is_system = 1`, y sigue fuera de `BASE_ROLES`.

### Propuesta para `CommercialReport` (se escribe después de aprobar este paso)

Misma pareja que `manage_high_value`, con una sola regla `{ action: 'read', subject: 'CommercialReport' }`.

1. En `role-permissions.js`, subject nuevo y `R` en la matriz de `Admin` y de `SoporteComercial`. `read` sí cabe en `ACTION_MAP`, así que va en `MATRIX` y no en el bloque especial de `manage_high_value`. `Gerente Comercial` no entra a `BASE_ROLES`.
2. Migración al estilo de `20261020231100-commercial-goal-permissions.js` para las filas vivas de `Admin` y `SoporteComercial`.
3. Migración al estilo de `20261020120000-gerente-comercial-manage-high-value.js` para la fila viva `Gerente Comercial`: misma constante de nombre, mismo aviso si falta, sin alta ni renombre, sin duplicar la regla. El test va junto al de `manage_high_value` en `commercial-roles.spec.ts`.

Ningún otro rol recibe la regla. El seeder no alcanza para este ambiente: hace falta la migración. Después de correrla, quien ya tiene sesión tiene que volver a entrar para que el JWT traiga el permiso, igual que con metas y con la marca de alto valor.

## 2. `status_history` de OUV

`entity_type = 'OUV'`: 710 filas. Valores reales de `trigger`:

| `trigger` | Filas | Lectura para M035 |
|---|---|---|
| `ADVANCE` | 337 | avance |
| `LOSS` | 208 | cierre |
| `RETREAT` | 80 | retroceso |
| `WIN` | 72 | cierre |
| `MANUAL` | 6 | ni avance, ni retroceso, ni cierre. 5 son `Ganada → EnCurso` y 1 es `Perdida → EnCurso` |
| `CREATE` | 6 | alta. 4 con `from_estado` nulo y 2 con `Asignado`, todas hacia `UNIVERSO` |
| `DISCARD` | 1 | cierre. `EnCurso → Descartada` |

El enum de `status-history-trigger.ts` también define `APPROVAL`, `REJECTION`, `ASSIGNMENT`, `CONVERSION` y `RECYCLE`. En filas OUV esas cinco valen cero. `APPROVAL` aparece en LEAD y `ASSIGNMENT` en SQL.

`metadata.synthetic_entry` es booleano JSON `true`. No hay otro tipo ni otro valor. Las 107 filas OUV con esa clave son `ADVANCE`. El código de esta rama no escribe la clave. Van de `2023-05-30 23:08:22` UTC a `2026-09-16 20:30:10` UTC.

En Q3 2026 hay 187 filas OUV y **7** traen `synthetic_entry`. Las siete son `ADVANCE`:

| `changed_at` (UTC) | `from_estado` | `to_estado` |
|---|---|---|
| 2026-08-06 21:37:42 | `UNIVERSO` | `EN_FUNNEL` |
| 2026-08-20 18:04:07 | `UNIVERSO` | `ENCIMA_FUNNEL` |
| 2026-08-21 02:08:32 | `UNIVERSO` | `ENCIMA_FUNNEL` |
| 2026-08-24 11:15:59 | `UNIVERSO` | `ENCIMA_FUNNEL` |
| 2026-09-03 01:24:20 | `UNIVERSO` | `ENCIMA_FUNNEL` |
| 2026-09-04 16:04:56 | `UNIVERSO` | `ENCIMA_FUNNEL` |
| 2026-09-16 20:30:10 | `UNIVERSO` | `ENCIMA_FUNNEL` |

M035, al separar por `trigger`, deja `CREATE` y `MANUAL` fuera de avance, retroceso y cierre. Esas 12 filas se excluyen de los tres bloques y se pueden listar aparte si el detalle las pide. Las 7 sintéticas de Q3 salen por D7.

## 3. `audit_log` de montos

`tabla = 'ouvs'`. `campo_modificado` es `varchar(80)`. `valor_anterior` y `valor_nuevo` son `text`. `accion` de estas filas es `UPDATE`.

Nombres exactos de monto, que coinciden con las columnas de `ouvs`:

| `campo_modificado` | Filas | Uso en D7 |
|---|---|---|
| `presupuesto_monto` | 14 | historial de monto |
| `monto_final` | 6 | historial de monto |
| `monto_estimado_perdido` | 1 | existe; D7 no lo incluye |

Un filtro `LIKE '%presupuesto%'` o `LIKE '%monto%'` también trae columnas que no son el monto: `presupuesto_confirmado` (10), `presupuesto_fecha_captura` (14), `presupuesto_fuente` (13), `presupuesto_moneda` (2) y `moneda_final` (6). El reporte usa los dos nombres de D7, tal cual.

Formato, escrito por `AuditHooksService.serializeValue` con `JSON.stringify`. El decimal de Sequelize llega como string, así que el texto guardado es un string JSON, comillas incluidas:

| `campo_modificado` | `valor_anterior` | `valor_nuevo` |
|---|---|---|
| `presupuesto_monto` | `"7142.00"` | `"7563025210"` |
| `presupuesto_monto` | `"3600000000.00"` | `"3600000000"` |
| `presupuesto_monto` | `"0.00"` | `"25000000"` |
| `monto_final` | `null` | `"1000000000"` |
| `monto_final` | `null` | `"250"` |
| `monto_estimado_perdido` | `null` | `"517"` |

Ninguna de esas 21 filas tiene SQL `NULL` en las dos columnas. El `null` de arriba es el literal JSON de cuatro caracteres: 2 veces en `valor_anterior` de `presupuesto_monto`, las 6 de `monto_final` y la única de `monto_estimado_perdido`. El valor nuevo de las 21 es un string JSON numérico, a veces con `.00` y a veces sin decimales. Para leerlo: `JSON.parse` y después número. `null` parseado es ausencia de monto anterior.

## 4. M013 — abiertas sin fecha prevista

`isDashboardOpen` en `ouv-dashboard-metrics.ts` es `resultado === 'EnCurso'`. En esta base:

| | Filas |
|---|---|
| OUVs | 414 |
| `EnCurso` | 147 |
| `EnCurso` con `expected_close_date` NULL | **27** |
| `EnCurso` con fecha | 120 |

Las otras 74 fechas vacías están en `Perdida` (49) y `Ganada` (25). `Descartada` tiene su única fila con fecha. El conteo de M013 usa las 27.

## Cierre

Sin bloqueo. El paso 2B.1 espera esta aprobación: la pareja de migraciones de `CommercialReport`, y el trato de `CREATE` y `MANUAL` fuera de los tres bloques de M035.
