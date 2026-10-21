# Spec — Metas comerciales por trimestre Verytel

Estado: aprobado para implementación autónoma (Pasos 1 a 3 de este prompt).
Decisiones: `specs/decisions/2026-10-20-metas-comerciales.md` y `specs/metas-comerciales/DECISIONES-AUTONOMAS.md`.

Alcance: registrar y administrar metas de comerciales por año fiscal, trimestre Verytel y segmento. Fuera de alcance: avance contra ventas, copia del trimestre anterior, carga masiva e historial de cambios dentro de la pantalla.

## 1. Modelo

Tabla nueva `commercial_goals` (nombres en inglés).

| Columna | Tipo | Notas |
|---|---|---|
| `commercial_goal_id` | `CHAR(36)` PK | UUID v4 |
| `user_id` | `CHAR(36)` NOT NULL | FK `users.user_id`, ON UPDATE CASCADE, ON DELETE RESTRICT |
| `fiscal_year` | `SMALLINT` NOT NULL | Año en que empieza el trimestre |
| `quarter` | `TINYINT` NOT NULL | 1–4 |
| `segment_id` | `CHAR(36)` NOT NULL | FK `segments.id`, mismas acciones |
| `amount_cop` | `DECIMAL(18,0)` NOT NULL | Entero > 0. Ver DA-03 |
| `created_at` / `updated_at` | `DATE` NOT NULL | UTC, como el resto del repo |
| `deleted_at` | `DATE` NULL | Soft-delete, `paranoid: true` |
| `active_marker` | `TINYINT` generada STORED | `IF(deleted_at IS NULL, 1, NULL)` |

Índice único `uq_commercial_goals_active_natural` sobre `(user_id, fiscal_year, quarter, segment_id, active_marker)`.
Índices `idx_commercial_goals_fiscal_quarter (fiscal_year, quarter)` e `idx_commercial_goals_segment (segment_id)`.

No hay `created_by` (DA-05). El modelo Sequelize no declara `active_marker` como atributo escribible.

Migración re-ejecutable con `down` que elimina la tabla. Segunda migración de datos, también con `down`, agrega a las filas `SoporteComercial` y `Admin` las cuatro reglas `{ action, subject: "CommercialGoal" }` para `create`, `read`, `update` y `delete`, y el `down` quita solo esas reglas. `buildPermissions` incluye el recurso `commercial-goals: CRUD` en esos dos roles.

## 2. Calendario

Helper `verytelQuarterOf(instant)`, `verytelQuarterRange(fiscalYear, quarter)`, `formatVerytelQuarterRange(range)` e `isVerytelQuarterFinished(range, now)`.

Clasificación por la fecha de calendario en America/Bogota:

| Mes Bogota | Trimestre | Año fiscal |
|---|---|---|
| enero | Q4 | año − 1 |
| febrero, marzo, abril | Q1 | año |
| mayo, junio, julio | Q2 | año |
| agosto, septiembre, octubre | Q3 | año |
| noviembre, diciembre | Q4 | año |

El inicio es `bogotaDayStart` del primer día y el fin es `bogotaDayEnd` del último día. Q4 termina el 31 de enero del año siguiente. El texto de rango es `1 nov 2026 – 31 ene 2027` (día sin cero a la izquierda, mes en minúscula, guion largo). El trimestre ya terminó cuando la fecha Bogota de `now` es posterior al último día. Guardar igual está permitido.

## 3. API

Prefijo `api/v1`. Recurso `commercial-goals`. Todas las rutas exigen JWT y `@CheckAbility` sobre `CommercialGoal`.

| Método | Ruta | Ability | Respuesta |
|---|---|---|---|
| GET | `/commercial-goals` | `read` | `{ items, total, page, limit }` |
| GET | `/commercial-goals/summary` | `read` | Cuatro trimestres del año |
| GET | `/commercial-goals/:id` | `read` | Una meta |
| POST | `/commercial-goals` | `create` | 201 y la meta |
| PATCH | `/commercial-goals/:id` | `update` | La meta |
| DELETE | `/commercial-goals/:id` | `delete` | 200 `{ deleted: true }` |

`GET /summary` se declara antes de `GET :id`.

Query del listado: `page` (default 1), `limit` (default 20, máximo 100), `fiscal_year`, `quarter`, `user_id`, `segment_id`. Todos los filtros son opcionales en el API. Orden: `fiscal_year DESC`, `quarter DESC`, nombre del comercial ASC.

Query del resumen: `fiscal_year` obligatorio; `user_id` y `segment_id` opcionales. Por cada Q: `quarter`, `total_amount_cop` (string de dígitos, suma de metas vivas) y `commercial_count` (comerciales distintos con al menos una meta en ese Q, respetando los filtros).

Cuerpo de alta y edición: `user_id` (UUID), `fiscal_year`, `quarter`, `segment_id` (UUID), `amount_cop` (entero). En el PATCH todos son opcionales, pero al menos un campo debe venir. El servicio vuelve a validar la combinación completa.

Ítem:

```json
{
  "commercial_goal_id": "uuid",
  "user_id": "uuid",
  "commercial_full_name": "Ada",
  "commercial_role_name": "EjecutivoComercial",
  "fiscal_year": 2026,
  "quarter": 4,
  "segment_id": "uuid",
  "segment_name": "Industria",
  "amount_cop": "1200000000",
  "created_at": "2026-10-20T18:00:00.000Z",
  "updated_at": "2026-10-20T18:00:00.000Z"
}
```

El rango de fechas lo calcula el cliente con el mismo criterio de la sección 2. `commercial_role_name` solo sirve para el badge; no autoriza.

Errores, siempre `{ code, message }` y sin filtrar el resto del cuerpo:

| Caso | HTTP | code | message |
|---|---|---|---|
| Duplicado vivo | 409 | `CONFLICT` | `Ya existe una meta para este comercial en Q{n} {año} · {segmento}.` más `existing_goal_id` |
| Comercial inexistente, inactivo o sin rol asignable | 400 | `VALIDATION` | `El comercial debe ser un Ejecutivo Comercial o Gerente Comercial activo.` |
| Valor no entero, ≤ 0, decimal o mayor que `Number.MAX_SAFE_INTEGER` | 400 | `VALIDATION` | `La meta debe ser un entero en pesos, mayor que cero.` |
| Q fuera de 1–4 o año fuera de 2020–2100 | 400 | `VALIDATION` | Mensaje en español que nombra el campo |
| Segmento ausente, inactivo o eliminado | 400 | `VALIDATION` | `El segmento no está en el catálogo activo.` |
| Sin permiso | 403 | `FORBIDDEN` | El que ya responde `CaslGuard` |
| Id inexistente o eliminado | 404 | `NOT_FOUND` | `No se encontró la meta.` |

El comercial se valida con `UsersService.isActiveWithAnyRole` y `ASSIGNABLE_COMMERCIAL_ROLE_NAMES` (EjecutivoComercial y Gerente Comercial). El segmento de alta y edición sale de `DemandGenerationService.listSegments()` (solo activos). El nombre de un segmento que luego se desactive se resuelve con un método público nuevo `findSegmentNamesByIds`, que incluye inactivos y excluye eliminados, para que la tabla no pierda la etiqueta.

La lista de comerciales del formulario no se duplica: el cliente usa `GET /discovery/ouvs/ejecutivos-comerciales`. Los segmentos del formulario y de los filtros usan `GET /segments`. Soporte y Admin ya tienen `read` de `Opportunity` y de `Lead`, que son los abilities de esos dos GET.

## 4. Permisos

| Rol | `CommercialGoal` |
|---|---|
| SoporteComercial | create, read, update, delete |
| Admin | create, read, update, delete |
| EjecutivoComercial, Gerente Comercial y cualquier otro | ninguno |

Gerente Comercial no entra a `buildPermissions`. La migración no toca su fila.

## 5. Requisitos EARS

### REQ-01 (Ubicuo)

El sistema deberá persistir cada meta con comercial, año fiscal, trimestre (1–4), segmento del catálogo y valor en COP entero.

Criterio: un POST válido crea una fila en `commercial_goals` y responde 201 con esos campos.

### REQ-02 (No deseado)

Si ya existe una meta activa con el mismo comercial, año, trimestre y segmento, el sistema deberá rechazar el alta o la edición con 409 `{ code: "CONFLICT", message, existing_goal_id }`.

Criterio: el segundo POST de la misma combinación responde 409 y no inserta. Un PATCH que mueva otra meta a esa combinación también responde 409. El índice único es la última línea si hay dos peticiones a la vez.

### REQ-03 (No deseado)

Si el comercial no está activo o no tiene rol EjecutivoComercial ni Gerente Comercial, el sistema deberá rechazar con 400.

Criterio: usuario inactivo, usuario de otro rol o id desconocido responden 400 y no escriben.

### REQ-04 (No deseado)

Si el valor no es un entero mayor que 0, el trimestre no está entre 1 y 4, el año está fuera de 2020–2100 o el segmento no está en el catálogo activo, el sistema deberá rechazar con 400.

Criterio: 0, negativo, decimal, Q 0 o 5, año 2019 o 2101, y un `segment_id` que no esté activo responden 400.

### REQ-05 (Ubicuo)

El sistema deberá calcular el rango de cada trimestre según D1, incluido el Q4 que cruza de año, y la UI deberá mostrarlo como referencia.

Criterio: 31 ene 2027 → Q4 2026; 1 feb 2027 → Q1 2027; 30 abr y 1 may cambian de Q1 a Q2; 31 oct y 1 nov cambian de Q3 a Q4; 31 dic 2026 sigue en Q4 2026. El texto de Q4 2026 es `1 nov 2026 – 31 ene 2027`. Los límites de día salen de `bogota-day.ts`.

### REQ-06 (Estado)

Mientras el usuario tenga `read` sobre `CommercialGoal`, el tablero `/opportunities/dashboard` deberá mostrar el engranaje arriba a la derecha. Si no lo tiene, el engranaje no se muestra y `/dashboard/metas-comerciales` redirige a `/opportunities`.

Criterio: el botón usa `Settings`, área táctil de al menos 36 px, `title` y `aria-label` «Metas comerciales», y solo consulta `user.permissions`. Ver DA-01 y DA-07.

### REQ-07 (Ubicuo)

Solo SoporteComercial y Admin tendrán el permiso. Sin ese permiso el servidor responde 403.

Criterio: `buildPermissions` de Soporte y Admin incluye las cuatro acciones. EjecutivoComercial no. Un ability construido con los permisos de Gerente Comercial (no está en la matriz) tampoco. `CaslGuard` niega `read CommercialGoal` a quien no traiga la regla.

### REQ-08 (Evento)

Cuando se cree, modifique o elimine una meta, el sistema deberá registrar en `audit_log` el usuario, la fecha, la operación y, en una modificación, el valor anterior y el nuevo de cada campo cambiado.

Criterio: el alta deja una fila `INSERT` con `usuario_id` del actor. Editar `amount_cop` deja una fila `UPDATE` con `campo_modificado = amount_cop`, `valor_anterior` y `valor_nuevo`. El soft-delete deja una fila `DELETE`. Lo escriben los hooks, no el servicio.

### REQ-09 (Ubicuo)

La eliminación deberá ser lógica y no deberá impedir volver a crear la misma combinación.

Criterio: tras DELETE, `deleted_at` queda poblado, el GET por id responde 404 y un POST de la misma combinación responde 201.

### REQ-10 (Ubicuo)

El listado deberá ser paginado y filtrable por comercial, año, trimestre y segmento, ordenado por año descendente, trimestre descendente y comercial ascendente.

Criterio: `page` y `limit` recortan `items` y `total` cuenta el universo filtrado. Cada filtro restringe. El orden pedido se observa con tres filas de prueba.

## 6. UX

La pantalla es `/dashboard/metas-comerciales`. El regreso «← Dashboard» apunta a `/opportunities/dashboard`.

1. Encabezado con el enlace, título «Metas comerciales», subtítulo «Define las metas de cada comercial por trimestre fiscal Verytel.» y botón primario «Nueva meta» (`Plus`).
2. Chip «Hoy: Q4 2026 · 1 nov 2026 – 31 ene 2027», calculado con el helper.
3. Selector de año fiscal, default el año fiscal de hoy. Cambiarlo recarga resumen y tabla.
4. Cuatro tarjetas (fila en escritorio, 2×2 en móvil). Cada una: «Q1», el rango, el total COP y «N comerciales con meta». La del trimestre vigente lleva borde de acento y la etiqueta «Actual». Un clic aplica ese Q a la tabla y marca la tarjeta; otro clic lo quita.
5. Filtros draft/applied de comercial, trimestre y segmento, con Aplicar y Limpiar. El año no entra en el draft.
6. Tabla paginada con `Pagination`. Columnas: Comercial (badge «Gerente» si `commercial_role_name` es Gerente Comercial, vía `commercialOptionLabel` o el mismo criterio de etiqueta), Periodo («Q4 2026» y debajo el rango atenuado), Segmento, Meta (COP) alineada a la derecha con `tabular-nums` en la forma `$ 1.200.000.000`, Actualizada (fecha en America/Bogota) y acciones `Pencil` / `Trash2` con `aria-label`. En móvil la tabla scrollea en horizontal dentro de su contenedor; la página no.
7. Vacío del año: «Aún no hay metas para {año}.» y «Crear la primera meta». Vacío por filtros: «Ninguna meta coincide con los filtros.» (DA-11).

Modal «Nueva meta» / «Editar meta», en este orden: comercial (`select` nativo, DA-06), año fiscal (el de la pantalla), trimestre (control segmentado de cuatro botones, flechas o tab, default el Q filtrado o el vigente), rango bajo el control y, si ya terminó, «Este trimestre ya terminó.», segmento (`select` del catálogo) y valor (prefijo `$`, `inputMode="numeric"`, miles mientras se escribe, sin decimales, ayuda abreviada DA-12). Cancelar y «Guardar meta», deshabilitado mientras se envía o si la validación del cliente falla. Mensajes junto al campo. En edición, el subtítulo atenuado es la fecha de creación. Un 409 muestra el `message` del servidor y el botón «Editar la meta existente», que carga `existing_goal_id` sin borrar lo escrito hasta que esa carga reemplace el formulario. 400 y 403 muestran `message`, nunca `code`. El modal no se cierra solo ante un error.

Eliminar usa `window.confirm`, como el resto del repo: «¿Eliminar la meta de {comercial} para Q{n} {año} · {segmento} ({valor})? Esta acción queda registrada en la auditoría.»

Tras guardar o eliminar, `FloatingToast` dice «Meta guardada» o «Meta eliminada», y se refrescan tabla y resumen. La fila creada o editada usa un fondo de acento suave unos 2 segundos. Si `prefers-reduced-motion`, el fondo aparece y desaparece sin transición.

Componentes presentacionales, sin fetch: `QuarterSummaryCards`, `QuarterSegmentedControl`, `CommercialGoalsTable`, `CommercialGoalFormModal`, `CopAmountInput`. La página concentra los datos. Clases en el `ui.ts` del módulo, tokens existentes, modo claro y oscuro. Cada campo del modal tiene `<label>` y foco visible.

Estados de carga y de error de red explícitos. No hay ítem nuevo en el menú lateral.
