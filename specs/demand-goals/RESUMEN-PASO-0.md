# RESUMEN-PASO-0 — Metas de generación de demanda (semanales por año/Q)

Fecha: 2026-10-29. Solo lectura. Sin spec, sin código de producto, sin bloqueo R3/R4.

El repo de implementación es `crm-e2e`. La referencia gráfica es `crm-e2e-DesignJD` (en el prompt, `@crm-e2e-design`). De ese repo no se copia lógica, datos mock, servicios ni dependencias.

## 1. Botón y panel de metas

**En `crm-e2e` el botón de parametrizar no existe.** El tablero está en `frontend/src/modules/demand-generation/pages/MarketingDashboardPage.tsx`, ruta `/demand/dashboard` (`frontend/src/routing/AppRoutes.tsx`). Las tres tarjetas usan `DonutMetric` con metas fijas en el cliente: interacciones `50`, leads `3`, OUV `3` (líneas 399-421). El único control de esas tarjetas es el ícono `List` («Ver datos»), que abre el detalle en `ModalShell`. El `div.min-h-0` de `frontend/src/modules/demand-generation/components/ModalShell.tsx` (línea 49) es el cuerpo con scroll de ese detalle, no un formulario de metas.

`DemandNav` (`frontend/src/modules/demand-generation/components/DemandNav.tsx`) acepta un slot `actions` alineado a la derecha. Hoy el tablero no se lo pasa.

**El botón y el panel que describe el prompt están en el diseño**, no en este repo:

| Pieza | Archivo en `crm-e2e-DesignJD` |
|---|---|
| Botón `.icon-btn` (ícono `Settings`) | `frontend/src/modules/demand-generation/pages/MarketingDashboardPage.tsx` (aprox. líneas 289-300). Visible si el rol es Director de Mercadeo o `Admin` (`isDirectorMercadeoRole`). |
| Dónde se monta | Prop `trailing` de `frontend/src/modules/demand-generation/components/DemandNav.tsx`. |
| Panel | `frontend/src/modules/demand-generation/components/MarketingDashboardTargetsModal.tsx`. Overlay `fixed`. El `div.min-h-0` (línea 104) es el cuerpo con scroll del modal. |
| Qué guarda | Cuatro bloques: Anual, Trimestral (Q), Quincenal y Semanal. Cada uno tiene tres enteros: interacciones, leads del periodo y convertidas a OUV. Al abrir, el acordeón deja expandido **Anual**. `PUT /dashboard/marketing/targets` reemplaza las cuatro filas. |

Ese formulario no pide año ni número de trimestre. La meta «trimestral» es un solo número global, no una meta por Q1–Q4.

## 2. Modelo, endpoints y datos actuales

### Código de `crm-e2e`

No hay modelo, DTO, controlador ni migración en el árbol de `crm-e2e` para metas de demanda. `GET /api/v1/dashboard/marketing` (`backend/src/modules/demand-generation/controllers/dashboard.controller.ts`) no devuelve meta. El cliente no llama ningún endpoint de metas (`frontend/src/modules/demand-generation/api/dashboard-api.ts`).

### Base que usa este backend

La tabla **sí existe** en la base, aunque este working tree no tenga el archivo de migración. `SequelizeMeta` registra `20260918050000-create-marketing-dashboard-targets.js`. El archivo está en `crm-e2e-DesignJD/backend/database/migrations/` y el modelo en `crm-e2e-DesignJD/backend/src/modules/demand-generation/models/marketing-dashboard-target.model.ts`. Este repo no los tiene, así que la aplicación de `crm-e2e` no lee ni escribe la tabla.

Esquema vivo: `marketing_dashboard_targets`.

| Columna | Tipo | Regla |
|---|---|---|
| `target_id` | `CHAR(36)` PK | |
| `period_type` | `ENUM('annual','quarter','biweekly','weekly')` | único |
| `interactions` | `INT NOT NULL` default 50 | |
| `period_leads` | `INT NOT NULL` default 3 | |
| `converted_ouvs` | `INT NOT NULL` default 3 | |
| `created_at`, `updated_at` | `DATETIME` | |
| `deleted_at` | `DATETIME NULL` | soft-delete |

Cuatro filas vivas, creadas y sin edición posterior el 2026-09-18. Las cuatro tienen los mismos números:

| `period_type` | interacciones | leads | OUV |
|---|---:|---:|---:|
| `annual` | 50 | 3 | 3 |
| `quarter` | 50 | 3 | 3 |
| `biweekly` | 50 | 3 | 3 |
| `weekly` | 50 | 3 | 3 |

No hay año, ni Q 1–4, ni una fila por métrica. El `50/3/3` del tablero de `crm-e2e` está hardcodeado en React y coincide con ese seed; no sale de la base.

Endpoints que existen solo en el diseño (prefijo real `api/v1`):

- `GET /dashboard/marketing/targets` — `read` sobre `Lead`.
- `PUT /dashboard/marketing/targets` — `DirectorMercadeoGuard` (compara el nombre del rol con `DirectorMercadeo` o `Admin`) más `update` sobre `Lead`.

No hay `DELETE`. El servicio del diseño no escribe auditoría a mano. El guard compara rol, no un subject propio.

## 3. Cómo se calculan los tres indicadores

Servicio: `backend/src/modules/demand-generation/services/dashboard.service.ts`, método `buildWeeklyMetrics`. El rango activo lo resuelve `getActiveLeadDateRange` sobre `resolveRanges`. El fin del rango es exclusivo. Las fechas de `period_from` / `period_to` se anclan a la medianoche de America/Bogota (`T05:00:00.000Z`).

Prioridad del rango:

1. Si vienen `period_from` y `period_to`, ese intervalo manda. Año y trimestre no entran al cálculo.
2. Si no, y `year` es un entero ≥ 2000, se usa `marketingFiscalRange` (`backend/src/modules/demand-generation/lib/marketing-fiscal-period.ts`), que delega en `verytelFiscalPeriod` (`backend/src/common/time/verytel-quarter.ts`). Sin `quarter`, el rango es el año fiscal completo (1 feb → 1 feb del año siguiente, fin exclusivo). Con `quarter` 1–4, es ese trimestre fiscal: Q1 feb–abr, Q2 may–jul, Q3 ago–oct, Q4 nov–ene del año siguiente.
3. Si no hay fechas ni año, no hay rango. Los tres contadores responden `0`.

| Indicador en UI hoy | Campo | Cálculo | Qué fecha filtra |
|---|---|---|---|
| Interacciones | `weekly.interactions` | `COUNT` de `interactions` no eliminadas | `interactions.fecha` en `[inicio, fin)` |
| Leads del periodo (la etiqueta cambia: semana, 15 días, Q o año) | `weekly.new_leads` | `COUNT` de `leads` no eliminados | `leads.fecha_captura` en `[inicio, fin)` |
| OUV convertidas | `weekly.converted_ouvs` | `OuvMarketingMetricsService.countConvertedFromMarketing` | `ouvs.created_at` en `[inicio, fin)` y `ouvs.origen_via = 'desde_sql'` |

El detalle usa el mismo rango: `kind=interactions`, `kind=period_leads`, `kind=ouvs` en `GET /api/v1/dashboard/marketing/details`.

Los filtros del tablero se aplican al cambiar el control. No hay botón «Aplicar». Elegir un año limpia las fechas. Elegir una fecha limpia año y trimestre. El selector de trimestre del repo ya muestra el rango de meses (`FiscalQuarterSelect`: «Q1 · 01 feb – 30 abr», etc.). El diseño usa un `<select>` con solo «Q1»…«Q4».

El embudo (TOFU, MOFU, BOFU, MQL pendientes, SQL), el tiempo promedio, las barras por canal y las barras por segmento no usan estas metas. No se tocan sus cálculos (R7).

## 4. Rol y sujeto CASL

El rol existe. En `roles.name` y en `BASE_ROLES` el nombre exacto es `DirectorMercadeo` (`backend/database/seeders/lib/role-permissions.js`). La constante del módulo es `DEMAND_GENERATION_ROLES.DIRECTOR_MERCADEO`. La descripción de UI es «Director de Mercadeo». R3 no bloquea.

No hay subject de metas de demanda. El tablero exige `read` sobre **`Lead`** (`DashboardController`). Quien tiene esa acción en la matriz: `Admin`, `DirectorMercadeo`, `GestorMercadeo`, `EjecutivoComercial`, `ProductManager`, `TraductorDeNegocio`, `SoporteComercial`. La ruta `/demand/dashboard` solo pide sesión. `TraductorDeNegocio` y `ProductManager` no ven la pestaña, pero la URL responde si el API les deja leer `Lead`.

`DirectorMercadeo` tiene `CRUA` sobre `Lead` y `Campaign`. `Admin` también. Ninguno tiene hoy un permiso distinto para metas de mercadeo. El patrón vigente para un permiso nuevo es el de metas comerciales: subject `CommercialGoal` en `SUBJECTS` / `buildPermissions`, más una migración que reescribe el JSON de permisos de los roles ya sembrados. El cliente mira `user.permissions`, no el nombre del rol (`can-read-commercial-goals.ts`).

## 5. Propuesta de modelo (pendiente de aprobación)

No crear una tabla paralela. La tabla que ya está en la base es `marketing_dashboard_targets`. Extenderla con una migración `ALTER`. El archivo de creación no está en este repo; la migración nueva solo altera.

Grano nuevo, en inglés, con soft-delete:

| Columna | Tipo | Notas |
|---|---|---|
| `target_id` | `CHAR(36)` PK | se conserva |
| `fiscal_year` | `SMALLINT` | año fiscal en que empieza el Q |
| `quarter` | `TINYINT` | 1–4 |
| `metric` | `ENUM('INTERACTIONS','LEADS','CONVERTED_OUV')` | una fila por métrica |
| `weekly_target` | `INT NOT NULL` | entero ≥ 0 |
| `created_at`, `updated_at`, `deleted_at` | | `paranoid: true` |
| `active_marker` | `TINYINT` generada | `IF(deleted_at IS NULL, 1, NULL)`, igual que `commercial_goals` |

Índice único `uq_marketing_dashboard_targets_active` sobre `(fiscal_year, quarter, metric, active_marker)`. Hay que quitar el único de `period_type`. Después de migrar los datos, quitar `period_type`, `interactions`, `period_leads` y `converted_ouvs`: ese grano no puede representar año + Q + métrica.

**Datos existentes.** Las cuatro filas son el seed, nunca editadas, y repiten 50 / 3 / 3. No son una meta anual distinta de la semanal. Convertir `annual = 50` en un semanal (dividir por las semanas del año) daría ~1 interacción por semana y chocaría con la fila `weekly = 50`.

Propuesta de conversión, para validar:

- Tomar solo la fila `weekly` como meta semanal: interacciones 50, leads 3, convertidos a OUV 3.
- Materializarla en los cuatro trimestres del año fiscal **2026** (doce filas: 4 Q × 3 métricas).
- Soft-delete de las filas `annual`, `quarter` y `biweekly`. RN3 deriva la quincena y el trimestre desde el valor semanal; dejarlas como metas absolutas contradice el prompt.

Alternativa, si esos números no deben heredarse: soft-delete de las cuatro filas y no copiar valores. El tablero queda en «Sin meta definida» hasta que alguien las cargue. Los `50/3/3` hardcodeados del cliente se retiran en el Paso 3 en ambos casos.

### API propuesta

El prefijo del módulo es `dashboard`, no `demand`. Los ejemplos `/demand/goals` del prompt se adaptan a:

- `GET /api/v1/dashboard/marketing/goals?year=YYYY` — las metas de los 4 Q de ese año fiscal.
- `PUT /api/v1/dashboard/marketing/goals` — upsert de `{ fiscal_year, quarter, metric, weekly_target }`.
- `DELETE /api/v1/dashboard/marketing/goals/:id` — soft-delete.

`GET /api/v1/dashboard/marketing` se extiende, sin endpoint paralelo. Dentro de `weekly`, además de los contadores actuales, tres objetos:

```json
{
  "interactions": { "actual": 12, "target": 10, "attainment_pct": 120 },
  "leads": { "actual": 4, "target": 0, "attainment_pct": null },
  "converted_ouv": { "actual": 1, "target": 2, "attainment_pct": 50 }
}
```

`actual` es el mismo conteo de hoy. `target` = suma, por cada tramo de Q que cruce el rango, de `weekly_target × (días del tramo ÷ 7)`, redondeada a entero. Un Q sin fila aporta 0. Si el total es 0, `attainment_pct` es `null` y la tarjeta dice «Sin meta definida» (no se divide por cero). Si hay meta, `attainment_pct` = `round(actual / target × 100)`.

El día se asigna entero al trimestre de `verytelQuarterOf`. Enero pertenece al Q4 del año fiscal anterior. Sin rango activo (el tablero abre sin año ni fechas), `target` es 0.

Días de cada Q, para el texto de ayuda del formulario (semanas ≈ días ÷ 7): Q1 no bisiesto 89 días (~12,7 semanas; bisiesto 90), Q2 92, Q3 92, Q4 92. La ayuda muestra quincena = semanal × 2 y trimestre ≈ semanal × (días del Q ÷ 7).

### Permisos

Subject nuevo `DemandGoal`, acciones `create`, `read`, `update`, `delete`. En `buildPermissions` y en una migración de permisos, para `DirectorMercadeo` y `Admin`. El botón mira `user.permissions`, no el nombre del rol. El resto de roles con `read` `Lead` no llama al CRUD; ve la comparación porque viene dentro de `GET /dashboard/marketing`. Un `PUT` o `DELETE` sin el permiso responde 403.

`PUT` de una fila nueva exige `create`; el de una fila viva exige `update`. `DELETE` exige `delete`. Los dos roles tienen las cuatro acciones, así que el formulario no cambia de comportamiento entre alta y edición.

### Auditoría

El skill `registrar-auditoria` muestra un `AuditService.log` escrito a mano dentro de la transacción. En este repo el camino real es `AuditHooksService`: al registrar el modelo, un `afterCreate` guarda el snapshot, un `afterUpdate` guarda una fila por campo (`valor_anterior` → `valor_nuevo`, omite `updated_at`) y un `afterDestroy` guarda el `DELETE`. El usuario y la fecha salen de `AuditContextInterceptor`. Es el mismo camino que `commercial_goals`. Propuesta: no llamar al writer a mano, para no duplicar filas. El modelo tiene que registrarse en Sequelize antes de que corran esos hooks.

El writer no une la fila de auditoría a la transacción de negocio. Es una limitación ya aceptada en metas comerciales; no se abre un segundo mecanismo en este paso.

## 6. Diseño de referencia

### Archivos

Tablero y panel:

- `crm-e2e-DesignJD/frontend/src/modules/demand-generation/pages/MarketingDashboardPage.tsx`
- `crm-e2e-DesignJD/frontend/src/modules/demand-generation/components/MarketingDashboardTargetsModal.tsx`
- `crm-e2e-DesignJD/frontend/src/modules/demand-generation/components/DemandNav.tsx`
- `crm-e2e-DesignJD/frontend/src/modules/demand-generation/components/ui.ts`
- `crm-e2e-DesignJD/frontend/src/modules/demand-generation/components/MarketingDashboardDetailModal.tsx` (detalle al pulsar la tarjeta; no es el panel de metas)

No se portan: `lib/marketing-dashboard-targets.ts`, el contrato de `api/dashboard-api.ts` de targets, el modelo, el DTO, el guard por nombre de rol ni el servicio. Esa librería elige un cubo absoluto (≤7 días → semanal, ≤15 → quincenal, si no → anual) y no prorratea.

### Qué se reutiliza, qué se adapta, qué no aplica

| Elemento | Decisión | Motivo |
|---|---|---|
| Overlay del modal, encabezado, cuerpo `min-h-0`, pie con `ghostButtonClass` y `primaryButtonClass` | Reutilizar el aspecto | Ya usa `card`/tokens y `ui.ts`. En `crm-e2e` el cierre con `X` y el clic en el fondo se copian de ese modal; `ModalShell` de este repo no trae el botón cerrar. |
| Botón engranaje `.icon-btn` + `Settings` | Adaptar el sitio | El diseño lo pasa como `trailing`. Este repo tiene `actions` en `DemandNav`. Misma esquina, otro nombre de prop. Visible solo con permiso `DemandGoal`, no comparando el rol. |
| Acordeón Anual / Q / Quincena / Semana | No aplica | El prompt pide año + Q + meta semanal. El acordeón guarda cuatro metas absolutas. |
| Selector de Q del diseño («Q1»…«Q4») | No aplica | Este repo ya tiene `FiscalQuarterSelect` con los meses. El panel de metas usa esas mismas etiquetas. El filtro del tablero no se degrada al select corto del diseño. |
| Tarjeta de los 3 indicadores (`cardClass`, número, «Meta:», pastilla de %) | Adaptar | El diseño es un donut SVG con cortes en 50 % y 90 %. El prompt pide barra de progreso y cortes &lt;70 % / 70–99 % / ≥100 %. Se conserva la tarjeta y se cambia el gráfico y los cortes. |
| «Sin meta definida» | Nuevo, no está en el diseño | Cuando `target` es 0. El diseño siempre muestra un número (default 50/3/3). |
| Embudo de 5 columnas del diseño | No aplica | El diseño no tiene la tarjeta «MQL pendientes». Este tablero sí (6 columnas). R7: el embudo no cambia. |
| Barras de canal (`bg-turquoise`) y de segmento (`bg-accent`) | Ya están en `crm-e2e` | Mismos datos. No se reescriben. |
| Clic en toda la tarjeta para abrir el detalle, con `ring-accent` | No aplica en este paso | Este repo abre el detalle con el ícono `List`. Cambiarlo no es la meta semanal. |
| `MarketingDashboardDetailModal` | No aplica | El detalle sigue en `ModalShell`. |

### Clases y tokens

`ui.ts` de demanda es el mismo contrato en los dos repos: `inputClass`, `labelClass`, `primaryButtonClass` (`btn-glow`), `ghostButtonClass` (`btn-glow-outline`), `cardClass`. El ejemplo del skill que pinta `bg-brand` en el botón primario no es el `ui.ts` real. Los botones del panel siguen `ui.ts`. La barra de progreso sí puede usar `bg-brand` y los tonos semánticos, como pide el prompt.

Tokens compartidos y ya mapeados en los dos `tailwind.config.js`: `bg-brand`, `text-ink`, `bg-surface`, `bg-bg`, `border-border`, `text-muted`, `text-accent`, `bg-turquoise`, `text-semaphore-verde`, `text-warning`, `text-danger`, `shadow-card`.

Diferencias de `crm-e2e` que el diseño no tiene y que no se importan al revés: `--high-value`, `--mep-partial`, `--estado-verde-*`, `--estado-amarillo-*`, `--estado-rojo-*`. `--semaphore-amarillo` en este repo es un hex (`#B8860B` claro, `#F0B429` oscuro); en el diseño es un `color-mix`. No hace falta igualarlos para esta pantalla.

Mapa de tono de la barra, `Record` sobre tokens que ya existen:

| Rango | Clases |
|---|---|
| &lt; 70 % | `bg-danger` / texto `text-danger` |
| 70–99 % | `bg-warning` / texto `text-warning` |
| ≥ 100 % | `bg-semaphore-verde` / texto `text-semaphore-verde` |
| Sin meta | sin barra de cumplimiento; texto «Sin meta definida» |

La etiqueta de la tercera tarjeta hoy es «OUV convertidas». El diseño dice «Convertidas a OUV». El prompt dice «Leads convertidos a OUV». Propuesta de copy en esa tarjeta: **Convertidos a OUV**. El cálculo no cambia.

## 7. Decisiones que hay que confirmar antes del Paso 1

1. Extender `marketing_dashboard_targets` (no crear `demand_goals`).
2. Heredar la fila `weekly` (50 / 3 / 3) como meta semanal de los cuatro Q de 2026 y retirar las otras tres filas. Si no, dejar la tabla vacía de metas vivas.
3. Rutas bajo `/api/v1/dashboard/marketing/goals` y subject `DemandGoal`.
4. Auditoría solo por `AuditHooksService`.
5. Copy «Convertidos a OUV» y barra con los tres cortes de arriba, sin donut.

R3 y R4 no aplican: el rol existe y los tres cálculos están identificados. No hay `NOTAS-BLOQUEO-1.md`.

STOP. Sin Paso 1 hasta aprobación de este resumen.
