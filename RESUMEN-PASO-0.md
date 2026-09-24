# RESUMEN-PASO-0 — Influencias multi-contacto en OUV

Descubrimiento de solo lectura sobre `crm-e2e`. La captura corresponde al panel de la ficha OUV, no al panel de influencias de leads.

## 1. Componente frontend de la captura

Página: `frontend/src/modules/discovery/pages/OuvDetailPage.tsx`.
Sección: `frontend/src/modules/discovery/components/InfluenciasSection.tsx`.

| Pieza | Archivo | Rol |
|---|---|---|
| Cinco tarjetas | `InfluenciaCard.tsx` | Avatar (iniciales o `+` punteado), título del tipo, nombre del contacto o "Sin asignar". Selección con `aria-pressed`. |
| Panel de detalle | `InfluenciaDetallePanel.tsx` | Contacto asignado, quitar (`X`), selector `<select>` si no hay contacto, enlace "+ Agregar contacto", control de estado, textarea "Notas". |
| Selector de estado | `EstadoSegmentedControl.tsx` | Radiogroup: Sin Evaluar, Verde, Amarillo, Rojo. |
| Selector de contacto | `<select>` en el panel + `ContactoFormModal` abierto desde `OuvDetailPage.openContactoModal` | El alta de persona reutiliza el modal de contactos de la OUV y, al crear, asigna ese `contacto_ouv_id` al tipo seleccionado. |
| Vocabulario y tonos | `frontend/src/modules/discovery/lib/ouv-vocab.ts` | Labels, anillo del avatar, conteo local de verdes. |

API usada (`frontend/src/modules/discovery/api/ouvs-api.ts`, vía `apiRequest()`):

- `fetchOuvInfluencias(ouvId)` → `GET /discovery/ouvs/:id/influencias`
- `updateOuvInfluencia(ouvId, tipo, payload)` → `PATCH /discovery/ouvs/:id/influencias/:tipo`
- Contactos del selector: `fetchOuvContactos`, `createOuvContacto`, `updateOuvContacto`

El guardado es optimista en `OuvDetailPage` (`persistInfluencia`): un PATCH por tipo con `estado`, `contacto_ouv_id`, `notas` y `motivo_estado`. La nota se persiste en debounce de 500 ms y en blur.

`LeadInfluenciasPanel.tsx` es otra pantalla (contactos del lead). No produce esta captura.

## 2. Persistencia actual

Tabla `ouv_influencias` (migración `backend/database/migrations/20260807120300-create-ouv-influencias.js`; tipos Usuario/Coach en `20260916120000-add-usuario-coach-influencia-tipos.js`).

Modelo Sequelize: `backend/src/modules/discovery/models/ouv-influencia.model.ts` (`OuvInfluencia`).

| Columna | Notas |
|---|---|
| `influencia_id` | PK UUID `CHAR(36)` |
| `ouv_id` | FK a `ouvs.ouv_id` |
| `tipo` | ENUM `Economica`, `Tecnica`, `Fabrica`, `Usuario`, `Coach` |
| `estado` | ENUM `Verde`, `Rojo`, `Amarillo`, `SinEvaluar`. Default `SinEvaluar` |
| `contacto_ouv_id` | FK nullable a `ouv_contactos.contacto_ouv_id` |
| `notas` | `TEXT` nullable. Una nota por tipo, no por contacto |
| `motivo_estado` | `TEXT` nullable. El panel actual no lo edita |
| `fecha_ultimo_cambio` | Se actualiza solo si cambia `estado` |
| `created_at` | Sin `updated_at` ni `deleted_at` |

Índice único `uq_ouv_influencias_ouv_tipo` sobre (`ouv_id`, `tipo`): una sola fila por tipo. Al crear la OUV, `seedInfluenciasParaOuv` inserta las cinco filas en `SinEvaluar` con contacto nulo.

El modelo no tiene `paranoid: true`. `Ouv` sí tiene `HasMany` hacia estas filas.

## 3. A qué entidad apunta el contacto

No apunta a `users` ni directo a `people`.

`contacto_ouv_id` → `ouv_contactos` (`OuvContacto`, `paranoid: true`) → `person_id` → maestro `people` del módulo accounts. Nombre, cargo, email y teléfono salen de `people` en `OuvContactosService.toEnrichedResponses`. La influencia guarda solo el id del puente `ouv_contactos`.

## 4. Endpoints

Prefijo global `api/v1`. Controller `OuvsController` (`discovery/ouvs`).

| Método | Ruta | CASL | DTO entrada | Respuesta |
|---|---|---|---|---|
| GET | `/api/v1/discovery/ouvs/:id/influencias` | `read` Opportunity | — | `OuvInfluenciaResponseDto[]` |
| PATCH | `/api/v1/discovery/ouvs/:id/influencias/:tipo` | `update` Opportunity | `ActualizarInfluenciaDto` | `OuvInfluenciaResponseDto` |

`ActualizarInfluenciaDto`: `estado` obligatorio (`IsEnum(InfluenciaEstado)`); `contacto_ouv_id` UUID opcional (string vacío → null); `motivo_estado` y `notas` string opcionales, sin máximo de 1000.

Respuesta: `influencia_id`, `ouv_id`, `tipo`, `estado`, `contacto_ouv_id`, `notas`, `motivo_estado`, `fecha_ultimo_cambio`, `created_at`. No incluye el estado del filtro.

El PATCH exige OUV `EnCurso` y comercial dueño (`assertCanMutateOuvEnCurso`). El contacto, si viene, debe ser de la misma OUV. Dispara `ouv.influencia_cambio` en el workflow engine.

No hay endpoints separados de alta, baja, calificación o nota.

## 5. Filtro "2 influencias en verde" hoy

La regla vigente no es D3. Cuenta filas con `estado = Verde` y `contacto_ouv_id` no nulo, de cualquier tipo (Usuario y Coach también cuentan). Un tipo es una fila, así que el máximo es 5.

| Capa | Archivo | Función |
|---|---|---|
| Criterio de conteo | `backend/src/modules/discovery/lib/ouv-influencia-verde.ts` | `verdeWithAssignedContactWhere`, `isVerdeWithAssignedContact` |
| Conteo | `ouv-influencias.service.ts` | `countVerde` |
| Bloqueo al avanzar | `ouvs.service.ts` | `assertGuardsForDestino` (destino `EN_FUNNEL` o `MAYOR_PROBABILIDAD`). Mensaje en inglés: "At least 2 influencias in Verde with an assigned contact are required to advance" |
| Payload del guard | `ouvs.service.ts` `avanzarZona` | Pasa `influencias_verde_count` a `ouv.avance_zona` |
| Guard del motor | `backend/src/modules/workflow-engine/guards/guard-2-influencias-en-verde.ts` | `guard2InfluenciasEnVerde`. Mensaje: "Se requieren al menos 2 influencias en Verde con contacto asignado (hay N)" |
| Registro | `workflow.rules.ts` | Guard del evento `ouv.avance_zona` |
| Gap de zona | `criterios-zona.evaluator.ts` | `computeFaltantes` empuja `influencias_verde` si el conteo es menor que 2 y la zona ya es `EN_FUNNEL` o superior |
| UI (recalcula en cliente) | `ouv-vocab.ts` `countVerdeWithAssignedContact`; `AvanceZonaModal.tsx` | Bloquea el confirm localmente y muestra "N/2 influencias en Verde con contacto" |

## 6. Usos de Amarillo

Valor de calificación `Amarillo` / `InfluenciaEstado.Amarillo`. No aparece en seeders.

Backend:

- `backend/src/modules/discovery/models/enums/ouv.enums.ts`
- `backend/database/migrations/20260807120300-create-ouv-influencias.js` (ENUM de creación)
- `backend/src/modules/discovery/lib/ouv-influencia-verde.spec.ts` (caso que no cuenta como verde)
- `backend/src/modules/discovery/dtos/actualizar-influencia.dto.spec.ts` (acepta `Amarillo`)

Frontend:

- `frontend/src/modules/discovery/lib/ouv-vocab.ts` (lista, label, tone, dot, card, anillo)
- `frontend/src/modules/discovery/components/EstadoSegmentedControl.tsx`
- `frontend/src/modules/discovery/components/InfluenciaDetallePanel.tsx` (`text-warning`)
- Tokens `--estado-amarillo-fill` y `--estado-amarillo-fg` en `frontend/src/styles/tokens.css` (claro y oscuro). El prompt de Paso 3 no pide borrarlos; el control de estado es quien los usa.

Documentos (no son runtime): `docs/specs/spec-ouv-funnel.md`, `docs/modelo-destino-migracion.md`, `RESUMEN-PASO-1.md`.

No hay dashboards ni reportes que filtren por Amarillo. `StatusBadge` de demand-generation no incluye este valor.

## 7. Query de conteo (no ejecutada)

```sql
SELECT COUNT(*) AS amarillo_count
FROM ouv_influencias
WHERE estado = 'Amarillo';
```

Detalle para la auditoría de la migración:

```sql
SELECT influencia_id, ouv_id, tipo, contacto_ouv_id, notas
FROM ouv_influencias
WHERE estado = 'Amarillo';
```

La tabla no tiene `deleted_at`.

## 8. Modal y tooltip reutilizables

Modal: sí. `frontend/src/modules/discovery/components/ModalShell.tsx` (dialog, Escape, bloqueo de scroll, tamaños `default` / `wide` / `compact`). Botones del módulo: `primaryButtonClass` y `ghostButtonClass` en `frontend/src/modules/discovery/components/ui.ts`. Hay otro `ModalShell` en demand-generation; para esta pantalla se reutiliza el de discovery.

Tooltip: no hay componente. Lo más cercano es el atributo HTML `title` (avatar de la tarjeta y del panel). El tooltip del Paso 3 se arma con Tailwind sobre ese patrón, sin librería.

`StatusBadge` vive en demand-generation y no cubre calificaciones de influencia. El mapa equivalente en discovery es `INFLUENCIA_ESTADO_TONE` / `INFLUENCIA_ESTADO_DOT` / `INFLUENCIA_ESTADO_LABEL` en `ouv-vocab.ts`.

## 9. Propuesta de modelo destino

El modelo actual no admite 1–5 contactos: el único (`ouv_id`, `tipo`) lo impide. No hace falta tabla nueva ni renombrar columnas (R5).

Seguir en `ouv_influencias`, una fila por contacto asignado:

| Concepto del prompt | Columna del repo |
|---|---|
| opportunity_id | `ouv_id` |
| influence_type | `tipo` |
| contact_id | `contacto_ouv_id` (puente a `people`, no el `person_id`) |
| rating | `estado` |
| notes | `notas` |

Cambios:

1. Quitar `uq_ouv_influencias_ouv_tipo`.
2. Índice único (`ouv_id`, `tipo`, `contacto_ouv_id`).
3. `contacto_ouv_id` pasa a NOT NULL. Un tipo vacío es cero filas, no una fila con contacto nulo. Dejar de sembrar cinco filas vacías al crear la OUV.
4. Máximo 5: validación en el servicio, dentro de la transacción con lock de la OUV. No hace falta tabla de reglas.
5. `estado` queda `SinEvaluar | Verde | Rojo`. `notas` VARCHAR/TEXT con tope 1000 en el DTO.
6. Conservar `motivo_estado`, `fecha_ultimo_cambio` e `influencia_id`. No los usa el panel nuevo; borrarlos sí pierde dato.
7. Migración de filas con contacto: copiar `estado` y `notas` a esa misma fila. Luego `Amarillo` → `SinEvaluar`. La auditoría D4 usa esos mismos literales.
8. Filas sin contacto (las cinco sembradas): no tienen contacto destino. Si `notas` es NULL, se eliminan. Si alguna tiene nota y contacto nulo, esa nota no cabe en D6. Hay que decidirlo antes del Paso 2.
9. Auditoría D4: `audit_log.usuario_id` es UUID, no un nombre. No existe el actor `system-migration`. El actor de sistema del repo es el usuario `00000000-0000-4000-8000-000000000001` (`system@crm.internal`, `full_name` "System Actor"). La etiqueta `system-migration` puede ir en `audit_log.contexto`. `campo_modificado = estado`, `valor_anterior = Amarillo`, `valor_nuevo = SinEvaluar`, `registro_id = influencia_id`.
10. `evaluateInfluenceFilter` reemplaza el conteo de `countVerde` / `verdeWithAssignedContactWhere` en el servicio, en `assertGuardsForDestino` y en `computeFaltantes`. El guard sigue leyendo un número ya calculado; ese número pasa a ser la cantidad de tipos distintos en `{Economica, Tecnica, Fabrica}` con al menos un `Verde`. Usuario y Coach dejan de contar. El GET de influencias devuelve `{ passed, greenTypes, required: 2 }`.
11. Errores: el CRM responde el JSON de `HttpException` de Nest (`statusCode`, `message`, `error`). `application/problem+json` (RFC 7807) hoy solo existe en el contrato MEP. El Paso 2 tiene que ceñirse a un problem+json local de estos endpoints, sin un filtro global nuevo, salvo que se apruebe otra cosa.

## Divergencias de nombres (R1)

| Prompt | Repo |
|---|---|
| `SIN_EVALUAR`, `VERDE`, `ROJO`, `AMARILLO` (prompt) | `SinEvaluar`, `Verde`, `Rojo`, `Amarillo` (enum y auditoría) |
| `ECONOMICA`, `TECNICA`, `FABRICA` | `Economica`, `Tecnica`, `Fabrica` |
| `opportunity_id`, `influence_type`, `contact_id`, `rating`, `notes` | `ouv_id`, `tipo`, `contacto_ouv_id`, `estado`, `notas` |
| Actor `system-migration` | Usuario sistema UUID indicado arriba |

## Confirmación Usuario y Coach

Sí existen, después del snapshot del 2026-08-07.

- Enum `InfluenciaTipo` en `backend/src/modules/discovery/models/enums/ouv.enums.ts`: `Economica`, `Tecnica`, `Fabrica`, `Usuario`, `Coach`.
- Columna `tipo`: migración `20260916120000-add-usuario-coach-influencia-tipos.js` altera el ENUM a esos cinco valores y siembra `Usuario` y `Coach` en `SinEvaluar`.

No hay `NOTAS-BLOQUEO`.

## Soft-delete (hecho del repo)

`ouv_influencias` no tiene `deleted_at` ni `paranoid: true` (modelo y migración de creación). El RESUMEN-PASO-1 del 2026-08-07 tampoco lo declara. La regla nueva exige agregarlo en la migración del Paso 2: único `(ouv_id, tipo, contacto_ouv_id)` sin índice parcial, y al reasignar la misma terna el servicio hace `restore` con `estado` = `SinEvaluar` y `notas` = null.

## Conteo de filas sin contacto (lectura en `crm_e2e`, RDS dev, 2026-09-24)

No se escribió ni se borró nada.

| Medida | Valor |
|---|---|
| (a) Filas con `contacto_ouv_id` NULL | 1519 |
| (b) De esas, en `Verde` | 1 |
| (c) `ouv_id` de (b) | `5f0adb9a-04b7-56aa-ba9c-3b55f41ed882` |

(b) es mayor que 0. Esas OUV pueden dejar de cumplir el filtro D3 si se borra la fila. **No se ejecuta la migración en este ni en otro ambiente.**

## Puntos cerrados por el arquitecto (2026-09-24)

- D4: actor `00000000-0000-4000-8000-000000000001`; valores de auditoría `"Amarillo"` → `"SinEvaluar"`; `contexto` = `"migration:2026-09-24-influencias-multi-contacto"`.
- D6: fila con `contacto_ouv_id` NULL se elimina completa. Consola: conteo total, conteo en `Verde` y `ouv_id` de esas verdes. Si el conteo en `Verde` es mayor que 0, no se migra.
- Quedó en el decision record y en `docs/specs/spec-influencias-multi-contacto.md`.

## Detención

Paso 0 actualizado con el contexto del 2026-08-07. (b) = 1. Detenido antes del Paso 2. No se ejecuta la migración.
