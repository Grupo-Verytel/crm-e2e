# RESUMEN-PASO-1 — Reportes comerciales (matriz TD/WinCAV)

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes` (creada desde `develop` en `803d078`, sin commit)
**Alcance:** solo lectura. No hay cambios de código, migraciones ni librerías.
**Conteo:** el encargo dice 18 métricas; la matriz trae **20 IDs**. Este cruce cubre los 20.

El tablero de `/opportunities/dashboard` es una sola respuesta HTTP. Las tarjetas y tablas salen de ese JSON en el cliente. **No hay modal «Ver detalle»** en esta página. El único salto a una OUV es el enlace de la tabla «OUVs estancadas».

Volúmenes citados más abajo salen de una consulta `SELECT` a la base `crm_e2e` del entorno local, el 2026-10-28. No son un contrato de producción.

---

## Inventario del dashboard

| Pieza | Ruta real |
|---|---|
| Página | `frontend/src/modules/discovery/pages/OuvDashboardPage.tsx` |
| Paneles | `frontend/src/modules/discovery/components/OuvDashboardPanels.tsx` |
| Cliente | `fetchOuvDashboard` → `GET /discovery/ouv-dashboard` (`frontend/src/modules/discovery/api/ouv-dashboard-api.ts`) |
| Controlador | `OuvDashboardController.getDashboard` (`backend/src/modules/discovery/controllers/ouv-dashboard.controller.ts`) |
| Servicio | `OuvDashboardService.getDashboard` (`backend/src/modules/discovery/services/ouv-dashboard.service.ts`) |
| Cálculo | `buildOuvDashboard` (`backend/src/modules/discovery/lib/ouv-dashboard-metrics.ts`) |
| DTO de filtros | `OuvDashboardQueryDto`: `year`, `quarter` (1–4), `period_from`, `period_to`, `comercial_id` (UUID), `segmento` (`OuvSegmento`) |

**Consulta Sequelize.** Un `Ouv.findAll` con `comercialId` y/o `segmento` si vienen en el filtro. Trae atributos de la OUV más `User` (`fullName`) como `comercial`. No hay `GROUP BY`, no hay join a `accounts`, no hay `segment_id`, no hay `expected_close_date`, no hay `status_history`. El periodo se aplica en memoria. `ouvs` no tiene `deleted_at` ni `paranoid`.

**Filtros de la UI.** Año (calendario actual y dos anteriores; vacío = todo el historial), trimestre fiscal (`FiscalQuarterSelect`), rango desde/hasta (si ambos vienen, anulan año y trimestre), ejecutivo (solo si `canReadAllOuvs`), sector (`ouvs.segmento`). El engranaje lleva a `/dashboard/metas-comerciales` si el usuario tiene `read` sobre `CommercialGoal`.

**RBAC del endpoint.** `@CheckAbility({ action: 'read', subject: 'Opportunity' })`. Después, `canReadAllOuvs` (`backend/src/modules/discovery/lib/ouv-access.ts`): si el rol compactado es `ejecutivocomercial`, `comercialId` queda forzado al actor y se ignora el query. Cualquier otro rol que ya pasó CASL ve todas las OUVs y puede filtrar `comercial_id`.

**Controles (todos el mismo endpoint).**

| Control | Campo del JSON | Qué mide |
|---|---|---|
| Pipeline ponderado en venta | `pipeline_weighted` | Suma de `presupuesto_monto` de abiertas × peso fijo de zona (10 / 25 / 50 / 75 %) |
| Valor del pipeline | `pipeline_value` | Suma y cantidad de abiertas, más delta contra el periodo anterior de igual largo |
| Tasa de cierre | `close_rate` | `ganadas / (ganadas + perdidas)` por cantidad, con `fecha_cierre` en el periodo |
| Ciclo de venta promedio | `sales_cycle` | Promedio de días `fecha_cierre − created_at` de las **ganadas** del periodo. El API trae el corte por `segmento`; la tarjeta muestra solo los dos primeros |
| OUVs nuevas en el periodo | `new_ouvs` | Cantidad y suma de `presupuesto_monto` con `created_at` en el periodo |
| Embudo por etapa | `funnel`, `bottleneck` | Valor y cantidad **abiertas ahora** por `zona_actual`. La conversión es de la cohorte creada en el periodo, asumiendo camino lineal de zona. Barras CSS, sin librería |
| Ganadas vs. perdidas | `won_vs_lost` | Cantidad y monto del periodo, más top 5 de `motivo_snapshot` (+ «Otros») |
| Pipeline por sector | `pipeline_by_sector` | Valor abierto, participación y win rate por `ouvs.segmento` |
| Origen de OUVs nuevas | `new_origins` | Conteo por `origin`, o «Desde SQL» / «Directa» / «Sin origen». Top 8 |
| Desempeño por ejecutivo | `executives` | Abiertas, pipeline, win rate y valor ganado por `comercial_id` |
| OUVs estancadas | `stalled` | Abiertas con `updated_at` anterior a 30 días. Top 8. Enlace a `/opportunities/:id` |

**Abierta en este cálculo** (`isOpenAt`): ya existía en el instante T y `resultado = EnCurso`, o ya se cerró pero `fecha_cierre` es posterior a T. El comentario del archivo dice que no hay tabla de historial de etapa. Eso es falso para el repo: `status_history` existe y el detalle de la OUV sí la usa. El tablero no la consulta y reconstruye el pipeline abierto solo con `created_at` y `fecha_cierre`.

**Gráficos.** No hay librería de charts en `frontend/package.json`. Este tablero dibuja barras con un `div` de ancho porcentual (`Meter`). El donut SVG vive en el tablero de calificación, no aquí.

**Modal «Ver detalle».** No existe en `/opportunities/dashboard`. El patrón sí existe en calificación: `QualificationDashboardCharts` abre `ModalShell` + `QualificationDashboardDetailTable` contra `GET /qualification/dashboard/details`. Esa población es otra: solo `origen_via = desde_sql`. No se debe leer como la misma cifra del tablero de OUVs.

---

## Tabla A — Cruce

Destino propuesto = el de la matriz, sin rediseñarlo. «Dato nuevo» = hace falta una columna o una entidad que hoy no está, o el historial no guarda el valor que la métrica pide.

| ID | Métrica | Estado | Control actual | Endpoint / servicio | Ajuste requerido | Destino propuesto | ¿Requiere dato nuevo? |
|---|---|---|---|---|---|---|---|
| M001 | Win Rate | Parcial | «Tasa de cierre» y columnas Win rate de sector y de ejecutivo | `GET /discovery/ouv-dashboard` → `OuvDashboardService` → `closeStats` | La tasa es de **cantidad**. No hay conteo abierta/ganada/perdida por segmento en una sola vista, ni tasa por monto | Dashboard | No, si la fórmula oficial es la actual. Sí, si negocio pide otra fórmula (ver sección Win Rate) |
| M015 | Montos y cantidad de OUVs por segmento (UN) | Parcial | «Pipeline por sector» (solo valor **abierto**) y «Ganadas vs. perdidas» (global, sin segmento) | mismo | Falta cantidad por segmento y el corte abierto / ganado / perdido con sus montos | Dashboard | No |
| M019 | Mayor probabilidad por segmento (UN) | Parcial | Fila «Mayor Probabilidad» del embudo: cantidad y valor **globales** de abiertas en esa zona | mismo, `funnel` | Falta el corte por segmento y el detalle OUV, empresa, comercial, valor | Dashboard | No |
| M029 | Valor OUVs ganadas | Parcial | «Ganadas vs. perdidas» → monto ganado del periodo (`monto_final`) | mismo, `won_vs_lost.won` | El año y el trimestre ya filtran el total. Falta el detalle por segmento | Dashboard | No |
| M039 | Número de OUVs abiertas | Parcial | «Valor del pipeline» (cantidad y valor globales). El sector trae valor, sin cantidad | mismo, `pipeline_value` + `pipeline_by_sector` | Falta cantidad y valor de abiertas **por segmento** | Dashboard | No |
| M009 | OUVs abiertas por KAM | Existe | «Desempeño por ejecutivo»: `open_count` y `pipeline_amount` | mismo, `executives` | No duplicar. No hay listado de OUVs detrás de la fila | Dashboard | No |
| M003 | Movilización de OUVs y nuevas | No existe | «OUVs nuevas» solo cuenta altas del periodo. No compara etapa ni monto contra una fecha de corte | — | Definir la fecha de corte (no hay entidad Comité) y cruzar altas, cambios de zona y cambios de monto | Reportes › Comité | La fecha de corte es un parámetro. El monto histórico de cada cambio no está completo (ver Historial) |
| M035 | Cambios de etapa | No existe | El embudo asume camino lineal sobre la zona **actual**. No lista cambios del trimestre | El detalle de una OUV sí lee `StatusHistoryService.findByEntity` para `dias_por_zona`. El tablero no | Listar filas de `status_history` del Q, con el valor. El valor en el momento del cambio no está en la mayoría de las filas | Reportes › Comité | El evento de etapa existe. El monto en ese instante, no (salvo parte de los cierres ganados) |
| M025 | Nuevas OUVs en el Q | Parcial | KPI «OUVs nuevas»: cantidad y suma. Sin filas | mismo, `new_ouvs` | Falta el detalle: OUV, monto, KAM, `created_at`. El trimestre fiscal ya existe como filtro | Reportes › Comité | No |
| M013 | Embudo del Q por fecha prevista de cierre | Parcial | «Embudo por etapa» usa zona actual de abiertas y cohorte de `created_at`. No usa `expected_close_date` | mismo, `funnel` | Rehacer el corte por `expected_close_date` dentro del Q, más las creadas en el Q | Reportes › Comité | No. `expected_close_date` existe; en este ambiente 101 de 414 OUVs la tienen vacía |
| M006 | Ganadas por unidad de negocio | No existe | El monto ganado es un total del periodo, sin serie mensual ni corte por segmento | — | Serie mes a mes de `monto_final` con `resultado = Ganada` y `fecha_cierre` en el mes, agrupada por `segmento` | Reportes › Cierres | No |
| M021 | Ganadas por KAM | Parcial | Columna «Valor ganado» por ejecutivo, sin el detalle de cada OUV | mismo, `executives.won_amount` | Agregar el detalle (nombre de la OUV y valor) o enlazar un listado. No repetir la columna del tablero | Reportes › Cierres | No |
| M037 | Ganadas por año × segmento | No existe | Solo hay delta contra el periodo anterior de igual largo, global, no año contra año por segmento | `pipeline_value.delta_ratio` no sirve para esto | Serie de años fiscales (o calendario: pregunta abierta) por `segmento` | Reportes › Cierres | No |
| M051 | OUVs ganadas del año | Parcial | Con el año seleccionado y sin trimestre, «Ganadas vs. perdidas» es el total del **año fiscal** Verytel (1 feb – 31 ene) | mismo | Confirmar si «año» es fiscal o calendario. No hace falta otra pantalla si se enlaza ese KPI | Reportes › Cierres | No |
| M032 | Tiempo de ciclo | Parcial | «Ciclo de venta promedio»: solo Creado → Cierre de **ganadas**, por segmento en el API | mismo, `sales_cycle` | Falta el promedio Creado → hoy de las abiertas. La tarjeta no muestra todos los segmentos | Reportes › Cierres / Salud | No |
| M011 | Valor por empresa | No existe | Ningún control agrupa por `account_id` ni por `empresa_nombre` | — | Conteo y suma por cuenta | Reportes › Cuentas | No. Definir qué monto (abierta = `presupuesto_monto`, ganada = `monto_final`) |
| M050 | OUVs en cuentas de alto valor | No existe | `accounts.is_high_value` no entra al tablero. El detalle de OUV sí expone `account_is_high_value` | `AccountsService.findHighValueByAccountIds` ya existe para el detalle | Top 10 de OUVs cuya cuenta tiene la marca | Reportes › Cuentas | No como columna. En este ambiente las 438 cuentas están en `false`, así que el top saldría vacío |
| M052 | Suma de FCV (alto valor) | No existe | — | — | Serie mensual de ganadas y abiertas en cuentas de alto valor, **después** de definir FCV | Reportes › Cuentas | FCV no existe como columna. La marca de alto valor sí |
| M053 | Suma de FCV | No existe | El pipeline abierto es un primo lejano (suma de `presupuesto_monto`), sin corte por segmento × responsable × cuenta | — | Cubo por segmento, comercial y cuenta, con la definición de FCV | Reportes › Cuentas | FCV no existe como columna |
| M023 | Edad de OUVs abiertas > 365 días | No existe | «OUVs estancadas» es otra regla: `updated_at` mayor a 30 días, top 8 | mismo, `stalled` | Listar `resultado = EnCurso` con `created_at` anterior a 365 días. No reutilizar la lista de 30 días como si fuera esta métrica | Reportes › Salud | No |

---

## Tabla B — Fuentes

«UN» de la matriz no tiene columna propia. El campo poblado y el que ya usa el tablero es `ouvs.segmento`. `ouvs.segment_id` existe y en este ambiente está vacío en 408 de 414 filas. `ouvs.vertical` es otro catálogo.

| Campo de negocio | Tabla.columna real |
|---|---|
| Identificador OUV | `ouvs.ouv_id`, `ouvs.consecutivo`, `ouvs.titulo` |
| Estado abierta / ganada / perdida | `ouvs.resultado` enum `EnCurso` \| `Ganada` \| `Perdida` \| `Descartada`. No existe el valor «abierta»: abierta = `EnCurso` |
| Etapa | `ouvs.zona_actual` enum `UNIVERSO` \| `ENCIMA_FUNNEL` \| `EN_FUNNEL` \| `MAYOR_PROBABILIDAD` |
| Unidad de negocio / segmento | `ouvs.segmento` enum `Ciudades y gobernaciones` \| `Gobierno central` \| `Defensa y seguridad` \| `Industria` \| `Otros`. Catálogo paralelo: `segments.id` + `segments.name` vía `ouvs.segment_id` (casi sin datos). Subsegmento: `ouvs.subsegment_id` → `subsegments` |
| Vertical | `ouvs.vertical` varchar(80). No es el segmento |
| Comercial / KAM | `ouvs.comercial_id` → `users.user_id` / `users.full_name`. No hay entidad KAM. El seed describe a `EjecutivoComercial` como KAM. En la base viva también existe un rol llamado `KAM`; el tablero no lo usa |
| Cuenta | `ouvs.account_id` → `accounts.account_id`. Snapshot de nombre: `ouvs.empresa_nombre`. En este ambiente `account_id` está poblado en las 414 OUVs |
| Probabilidad propia de la OUV | `ouvs.close_probability` tinyint unsigned **existe en MySQL** y está documentada en `docs/modelo-destino-migracion.md` como columna fuera del código. Las 414 filas están en NULL. El modelo `Ouv` no la declara. El tablero no la lee: aplica pesos fijos por zona (0.10, 0.25, 0.50, 0.75) |
| Monto abierto / potencial | `ouvs.presupuesto_monto` decimal(18,2), moneda `ouvs.presupuesto_moneda` (`COP` \| `USD`) |
| Monto ganado | `ouvs.monto_final` decimal(18,2), moneda `ouvs.moneda_final` |
| Monto perdido | `ouvs.monto_estimado_perdido` decimal(18,2). Si viene en 0, el tablero sustituye `presupuesto_monto` |
| FCV | **NO EXISTE** |
| Fecha de creación | `ouvs.created_at` |
| Fecha prevista de cierre | `ouvs.expected_close_date` date. 101 de 414 vacías en este ambiente |
| Fecha real de cierre | `ouvs.fecha_cierre` datetime. Las 147 `EnCurso` la tienen vacía; el resto, no |
| Último movimiento | `ouvs.updated_at` (cualquier campo, no solo etapa o monto) |
| Cuenta de alto valor | `accounts.is_high_value` boolean NOT NULL default false. Modelo `Account`. 438 cuentas, todas en false en este ambiente |
| Origen SQL vs directa / Pipedrive | `ouvs.origen_via` enum `desde_sql` \| `directa`. `ouvs.sql_id_origen` nullable. `ouvs.origin` y `ouvs.source_channel` son snapshot del lead. **No existe `pipedrive_id`.** La carga Pipedrive y el alta directa comparten `origen_via = directa` |
| Cómo se creó (conteo de este ambiente) | `directa` 412, `desde_sql` 2 |
| Soft-delete de OUV | **NO EXISTE** `ouvs.deleted_at` |
| Columnas en MySQL que el modelo `Ouv` de `develop` no declara | `close_probability`, `project_type`, `execution_term_months`, `origen`, `canal_origen`, `ouv_type`, `parent_ouv_id`. El mapa de migración ya advertía las tres primeras. `ouv_type` (`OUV directa` \| `Adiciones` \| `Prorrogas`) y `parent_ouv_id` están en la base y no aparecen en el código de esta rama |

El tablero suma montos sin convertir `COP` y `USD`.

---

## Historial

Hay dos fuentes. No son equivalentes.

### `status_history` — línea de tiempo de estado

Modelo `StatusHistory` (`backend/src/modules/workflow-engine/models/status-history.model.ts`). Tabla append-only, sin `updated_at`. La escribe `StatusHistoryService.record` desde `workflowEngine.transition`. Si `from_estado = to_estado`, no inserta: un cambio solo de monto no deja fila.

| Columna | Uso |
|---|---|
| `history_id` | PK |
| `entity_type` | `OUV`, `LEAD`, `SQL`, … |
| `entity_id` | `ouvs.ouv_id` |
| `root_lead_id` | nullable |
| `from_estado`, `to_estado` | zona (`UNIVERSO` …) o resultado (`Ganada`, `Perdida`, `Descartada`, `EnCurso`) |
| `trigger` | `ADVANCE`, `RETREAT`, `WIN`, `LOSS`, `DISCARD`, `CREATE`, `MANUAL` |
| `motivo` | texto, sobre todo en retroceso y pérdida |
| `changed_by` | usuario |
| `changed_at` | datetime(3) |
| `metadata` | JSON. En avance de zona: `zona_anterior`, `zona_nueva`, `comercial_id`. En parte de las ganadas: `monto_final` y a veces `presupuesto_monto`. No guarda el monto en cada cambio de etapa |

Índices en esta base: PK `history_id`; `idx_status_history_entity (entity_type, entity_id, changed_at)`; `idx_status_history_root_lead (root_lead_id, changed_at)`; `changed_by`; `idx_status_history_to_estado (to_estado, changed_at)`. La migración del repo (`20260903010000-create-status-history.js`) solo crea los dos primeros índices secundarios. Los otros dos están en la base y no en esa migración.

Volumen medido: **753** filas (OUV 710, LEAD 29, SQL 14). Cambios de OUV entre 2026-08-01 y 2026-11-01: **187**, consulta en ~90 ms. `to_estado` de OUV: Perdida 208, ENCIMA_FUNNEL 187, EN_FUNNEL 110, MAYOR_PROBABILIDAD 80, Ganada 72, UNIVERSO 46, EnCurso 6, Descartada 1.

107 filas de zona traen `metadata.synthetic_entry`. En esta rama no hay código que escriba esa clave. Parte de la línea de tiempo fue cargada fuera del flujo actual.

El detalle de OUV (`OuvsService.computeDiasPorZona`) ya lee este historial por `entity_id` para días por zona. No sirve, tal cual, para «cambios del trimestre de todas las OUVs»: el índice principal lleva `entity_id` antes de `changed_at`. A este volumen da igual.

### `audit_log` — un renglón por campo

Modelo `AuditLog`. Append-only. Hooks globales `afterCreate` / `afterUpdate` / `afterDestroy` (`AuditHooksService`): en un update, una fila por campo cambiado, `campo_modificado` = nombre de columna, valores en JSON texto. El motor de workflow además escribe `accion = STATE_CHANGE`.

Columnas: `audit_id`, `tabla`, `registro_id`, `accion` (`INSERT`, `UPDATE`, `DELETE`, `STATE_CHANGE`, `LOGIN`, `EXPORT`), `campo_modificado`, `valor_anterior`, `valor_nuevo`, `usuario_id`, `ip_address`, `user_agent`, `timestamp`, `contexto`.

Índices: `tabla`, `registro_id`, `usuario_id`, `accion`, `timestamp`, cada uno por separado. No hay índice compuesto `(tabla, campo_modificado, timestamp)`.

Volumen medido: **4.850** filas en total. Sobre `tabla = 'ouvs'`: **292**, todas con `timestamp` en el mismo trimestre consultado. De esas, `presupuesto_monto` 14, `monto_final` 6, `monto_estimado_perdido` 1, `resultado` 8, `zona_actual` **2**. La consulta de montos del trimestre devolvió 21 filas en ~90 ms.

`zona_actual` casi no está en `audit_log` (2 filas) y sí está en `status_history` (cientos). El historial de etapa útil es `status_history`. El de monto es `audit_log`, y está incompleto: 14 cambios de presupuesto contra 414 OUVs, coherente con una carga masiva que no pasó por los hooks de Sequelize.

### Recomendación

Consulta directa, sin tabla nueva de snapshot, para el volumen actual.

- **M035 (cambios de etapa del Q):** leer `status_history` con `entity_type = 'OUV'` y `changed_at` en el trimestre fiscal, y unir la OUV viva para segmento, comercial y monto **actual**. Cabe holgadamente bajo 2 s (la prueba del trimestre devolvió en menos de 100 ms).
- **M003 (movilización contra una fecha de corte):** altas por `ouvs.created_at`; cambios de etapa por `status_history`; cambios de monto por `audit_log` donde existan. Una OUV importada que nunca se editó en la app no tiene ni etapa histórica real ni monto histórico.
- **No usar `audit_log` como fuente de etapas.** Tiene 2 de cientos.
- **No crear snapshot todavía.** El trade-off: la consulta directa es suficiente en velocidad y no pide migración, y a cambio el monto «en el momento del cambio de etapa» no se puede reconstruir. Un snapshot (monto + zona + fecha, escrito en cada avance y en cada cambio de `presupuesto_monto` / `monto_final`) haría fieles M003 y M035 hacia adelante y dejaría ciego el pasado ya importado. Conviene decidirlo cuando negocio confirme si el valor del cambio es el monto de hoy o el monto de aquel día.

Si el historial crece a decenas de miles de filas de OUV, el índice que haría falta para el reporte del trimestre es `(entity_type, changed_at)`, no el actual `(entity_type, entity_id, changed_at)`. Hoy no hace falta.

---

## Win Rate

La fórmula del tablero es de **cantidad**, no de monto. Está en `closeStats` y se repite para el sector y para el ejecutivo.

```
ganadas = OUVs con fecha_cierre dentro del periodo y resultado = Ganada
perdidas = OUVs con fecha_cierre dentro del periodo y resultado = Perdida
tasa = ganadas / (ganadas + perdidas)    si el denominador es > 0
tasa = null                               si no hay cerradas ganadas ni perdidas
```

`roundRatio` guarda 4 decimales. La UI muestra `Math.round(tasa × 100)` más el signo `%`.

La misma tasa alimenta:

- `close_rate.rate` (tarjeta «Tasa de cierre»), con `won_count` y `lost_count`.
- `pipeline_by_sector.win_rate`, por `ouvs.segmento`. El monto de esa tabla es el pipeline **abierto**, no el monto ganado.
- `executives.win_rate`, por `comercial_id`.

Quedan fuera del numerador y del denominador: `EnCurso`, `Descartada`, y cualquier ganada o perdida cuya `fecha_cierre` caiga fuera del periodo. Con el año por defecto, el periodo es el año fiscal Verytel (1 feb – 31 ene), no el año calendario.

**Pipedrive y alta directa entran.** `getDashboard` no filtra `origen_via`. En este ambiente 412 de 414 OUVs son `directa`, que es la marca compartida por la carga Pipedrive y por el alta directa. No se pueden separar. El tablero de calificación sí excluye `directa`; este no.

El monto ganado que se muestra al lado (`won_vs_lost.won.amount`, `executives.won_amount`) es `SUM(monto_final)` de las ganadas del periodo. No participa en la tasa. El monto perdido es `monto_estimado_perdido` si es mayor que 0; si no, `presupuesto_monto`.

---

## Trimestre fiscal

Sí existe.

- Backend: `backend/src/common/time/verytel-quarter.ts`. Q1 feb–abr, Q2 may–jul, Q3 ago–oct, Q4 nov–ene del año siguiente. El año fiscal es el año en que empieza el trimestre. Límites con `bogota-day.ts` (America/Bogota, UTC−5). `verytelFiscalPeriod(año)` sin trimestre es el año fiscal completo, 1 feb → 1 feb siguiente, intervalo semiabierto.
- UI compartida: `frontend/src/components/FiscalQuarterSelect.tsx` y la copia de metas en `frontend/src/modules/commercial-goals/lib/verytel-quarter.ts`.
- Lo usan el tablero de OUVs, el de calificación (`QualificationDashboardService`), el de mercadeo (`marketing-fiscal-period.ts`) y las metas comerciales.

El selector de año de la página usa `new Date().getFullYear()` (año calendario) y el backend lo interpreta como año fiscal. Con la fecha de hoy, el default «2026» sin trimestre es 1 feb 2026 – 31 ene 2027.

---

## Navegación / RBAC

| Archivo | Papel |
|---|---|
| `frontend/src/lib/navigation.ts` | `NAV_ITEMS`. Ítem plano: clave, label, path, icono, grupo, `subjects` CASL. No hay hijos |
| `frontend/src/layout/Sidebar.tsx` | Muestra el ítem si `canAccessNavItem`: el usuario tiene **cualquier** permiso sobre alguno de los `subjects` |
| `frontend/src/routing/AppRoutes.tsx` | Rutas. `/opportunities/dashboard` está envuelta solo en `ProtectedRoute` (sesión). No hay chequeo CASL en la ruta |
| `frontend/src/modules/auth/components/ProtectedRoute.tsx` | Redirige a `/login` si no hay sesión |
| `frontend/src/modules/auth/components/RoleRoute.tsx` | Lista de nombres de rol. La usan catálogos admin de OUV, no el tablero |
| `frontend/src/modules/discovery/components/DiscoveryNav.tsx` | Pestañas internas: Bandeja, Dashboard, ganadas, perdidas, descartadas. Visibles para quien abre Oportunidades |
| `backend/database/seeders/lib/role-permissions.js` | Matriz que siembra permisos. El sujeto del menú Oportunidades es `Opportunity` |
| `backend/src/modules/auth/casl/check-ability.decorator.ts` | El API niega por defecto. El tablero exige `read` + `Opportunity` |

**Quién ve `/opportunities/dashboard`.** Cualquier sesión puede abrir la URL. Los datos responden 200 solo con `read` sobre `Opportunity`. En el seed esos roles son: `Admin` (CRUX), `DirectorMercadeo` (R), `GestorMercadeo` (R), `EjecutivoComercial` (CRUX), `SoporteComercial` (CRU), `Preventa` (R), `Pricing` (R). `EjecutivoComercial` ve solo sus OUVs. El resto ve todas.

`Gerente Comercial` no está en `BASE_ROLES`. El spec `specs/gerente-comercial-ouvs` documenta que la fila viva ya trae `create`, `read`, `update` y `close` sobre `Opportunity`, y `canReadAllOuvs` es verdadero para ese nombre. En esta base la fila existe y tiene `read` sobre `Opportunity`.

La misma consulta a `roles` muestra más roles con `read Opportunity` que el seed (entre ellos `KAM`, `Consulta Ejecutiva`, `Planeación Comercial`, `Auditor` y varios de operaciones). Esos permisos están en la fila de `roles.permissions`, no en `buildPermissions`. Hallazgo: el menú real de este ambiente es más ancho que la matriz del código.

**`/dashboard` no existe.** La ruta de metas es `/dashboard/metas-comerciales`, también solo con `ProtectedRoute`. La página se corta en cliente con `hasCommercialGoalPermission(user, 'read')`. En el seed ese permiso lo tienen `SoporteComercial` y `Admin`. Un usuario sin el permiso entra a la URL y la pantalla no muestra la gestión.

No hay sujeto CASL `Report` ni ítem de menú Reportes. Un menú con hijos no tiene patrón en `NavItem`. El patrón más cercano de segundo nivel es `DiscoveryNav` (pestañas bajo un ítem plano del sidebar).

---

## Reutilización

No agregar librería de gráficos. El proyecto no tiene una.

| Pieza | Dónde | Sirve para |
|---|---|---|
| `FiscalQuarterSelect` | `frontend/src/components/FiscalQuarterSelect.tsx` | Mismo Q fiscal |
| `DatePickerField` | `frontend/src/components/DatePickerField.tsx` | Rangos |
| `Pagination` | `frontend/src/components/Pagination.tsx` | Detalle paginado |
| `ModalShell` | `frontend/src/modules/demand-generation/components/ModalShell.tsx` | El «Ver detalle» que el tablero de OUVs no tiene y el de calificación sí |
| `QualificationDashboardDetailTable` | calificación | Tabla de detalle dentro del modal. Acoplada a los `kind` de ese tablero; se copia el patrón, no el componente |
| `KpiCard`, `Meter`, tablas `<table>` | locales en `OuvDashboardPanels.tsx` | No están exportados. El card visual del módulo es `cardClass` en `frontend/src/modules/discovery/components/ui.ts` |
| `formatCompactMoney`, `formatRate` | `frontend/src/modules/discovery/lib/ouv-dashboard-format.ts` | Montos y tasas de este tablero |
| Donut SVG | `QualificationDashboardCharts.tsx` | Único gráfico que no es una barra CSS. Vive en calificación |
| `verytel-quarter.ts` | backend `common/time` | Cualquier corte Q nuevo debe usar este helper, no uno paralelo |
| `AccountsService.findHighValueByAccountIds` | módulo `accounts`, ya inyectado en discovery | M050 / M052 sin leer el modelo `Account` desde discovery |

---

## Preguntas abiertas

1. **Win Rate oficial.** ¿Se queda la fórmula actual (cantidad, `fecha_cierre` en el periodo, denominador ganadas + perdidas, sin descartadas y sin abiertas)? ¿O el denominador incluye abiertas, descartadas, o es por monto (`monto_final` / (`monto_final` + perdido))?
2. **Pipedrive.** ¿Las 412 OUVs `directa` entran al Win Rate y a los cierres? Hoy entran, y no hay columna para sacarlas sin sacar también las altas directas de la app.
3. **FCV.** No hay columna. ¿FCV es `presupuesto_monto` en abiertas y `monto_final` en ganadas, u otro concepto (valor de contrato, recurrente × plazo, moneda única)?
4. **Unidad de negocio.** ¿Es `ouvs.segmento` (lo único poblado), `vertical`, o `segments` cuando se termine de llenar `segment_id`?
5. **Año.** ¿Los reportes de «año» usan el año fiscal Verytel (feb–ene) que ya usa el tablero, o el año calendario?
6. **Último comité (M003).** No existe una fecha guardada. ¿La elige el usuario en cada consulta, o hay que persistir la fecha del comité?
7. **Valor del cambio de etapa (M035).** ¿Basta el monto actual de la OUV, o hace falta el monto del día del cambio? Lo segundo no está en el historial, salvo en una parte de las ganadas.
8. **`close_probability`.** La columna existe en MySQL, está vacía y el código no la lee. ¿Se ignora y se siguen usando los pesos 10/25/50/75, o pasa a ser la probabilidad oficial cuando se llene?
9. **Edad > 365 (M023).** ¿Desde `created_at` hasta hoy, solo `EnCurso`, en días calendario de Bogotá? La lista de «estancadas» (30 días sin `updated_at`) es otra métrica.
10. **Moneda.** ¿Se suman COP y USD como hoy, o hay tipo de cambio?
11. **`ouv_type` / `parent_ouv_id`.** Están en la base (`OUV directa`, `Adiciones`, `Prorrogas`) y no en el modelo de esta rama. ¿Adiciones y prórrogas entran a estas métricas?
12. **Quién ve Reportes.** ¿El mismo `read Opportunity` del tablero, o un permiso nuevo? En este ambiente hay roles operativos con `read Opportunity` que el seed no lista.
13. **18 vs 20.** Confirmar que los 20 IDs de la tabla son el alcance (no hay un recorte a 18).

---

## Propuesta de plan

Sin implementar. Cada paso espera aprobación del anterior.

1. **Cerrar las preguntas 1 a 7** (fórmula de Win Rate, FCV, UN, año, fecha de comité, monto histórico). Sin eso, M003, M035, M052 y M053 no tienen contrato.
2. **Servicio de lectura compartido en `discovery`.** Un cálculo reutilizable al lado de `ouv-dashboard-metrics.ts`, que reciba periodo fiscal, comercial y segmento, y devuelva agregados. Sigue en el módulo que ya posee `ouvs`. La marca de alto valor se pide al servicio público de `accounts`, como ya hace el detalle de OUV. No hace falta un módulo backend nuevo ni una librería de charts.
3. **Endpoints bajo el prefijo ya usado** (`/discovery/...`), con `CheckAbility` `read` + `Opportunity` y el mismo corte `canReadAllOuvs`. Uno por pantalla de reporte, más un detalle paginado al estilo `GET /qualification/dashboard/details` donde la matriz pide filas (M019, M021, M025, M035, M023, M050). El tablero actual se queda en `GET /discovery/ouv-dashboard`.
4. **Ajustar el tablero, no copiarlo.** En `/opportunities/dashboard` completar lo que la matriz deja ahí y está parcial: conteos por estado y segmento (M001, M015, M039), mayor probabilidad por segmento (M019), ganado por segmento (M029). M009 ya está. Lo demás se enlaza al reporte que corresponda.
5. **Menú Reportes.** Un ítem de sidebar con `subjects: ['Opportunity']` y, debajo, una navegación de pestañas como `DiscoveryNav`: Comité comercial, Cierres y desempeño, Cuentas, Salud del pipeline. El sidebar de hoy no tiene hijos; inventar un acordeón sería un patrón nuevo.
6. **Pantallas**, en este orden, porque comparten el mismo servicio: Comité (M003, M035, M025, M013) → Cierres (M006, M021, M037, M051, M032) → Cuentas (M011, M050, M052, M053) → Salud (M023 y el Creado→hoy de M032).
7. **Historial.** M035 y la parte de etapa de M003 leen `status_history`. La parte de monto lee `audit_log` y se documenta como incompleta para lo importado. Snapshot nuevo solo si la respuesta a la pregunta 7 es «monto del día del cambio».

---

STOP. No se avanza al Paso 2 hasta aprobar este resumen.
