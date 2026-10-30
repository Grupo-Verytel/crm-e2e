# RESUMEN-PASO-0 — Corrección de reglas de transición del embudo (OUV)

Fecha: 2026-10-30. Solo lectura del producto. Rama `EP-Fix-ReglasEmbudo` creada desde `develop` (`baa6471`). No hay spec nueva, ni cambio de código, ni tests ejecutados.

Hay un bloqueo de interpretación frente al código. Está en `NOTAS-BLOQUEO-1.md` de esta misma carpeta. El Paso 1 no arranca hasta resolverlo.

## 1. Nombres reales de las 4 zonas

El prompt dice «Funnel» y «Encima del Funnel». En código no existen esos literales. No se renombra nada.

| En el prompt | Enum `OuvZona` | Valor persistido | Label de UI | Cinta del embudo |
|---|---|---|---|---|
| Universo | `Universo` | `UNIVERSO` | Universo | UNIVERSO |
| Encima del Funnel | `EncimaFunnel` | `ENCIMA_FUNNEL` | Encima Funnel | ENCIMA DEL FUNNEL |
| Funnel | `EnFunnel` | `EN_FUNNEL` | En Funnel | FUNNEL |
| Mayor probabilidad | `MayorProbabilidad` | `MAYOR_PROBABILIDAD` | Mayor Probabilidad | MAYOR PROBABILIDAD |

Fuentes: `backend/src/modules/discovery/models/enums/ouv.enums.ts`, `backend/src/modules/discovery/lib/ouv-zona-order.ts`, `frontend/src/modules/discovery/lib/ouv-vocab.ts`.

El orden de avance es ese array. `nextZona` / `prevZona` solo permiten el vecino inmediato. No hay salto de zona.

## 2. Regla de cada transición, hoy

La validación que el usuario ve está en el servicio, antes de persistir la zona. El motor de workflow repite una segunda línea con los mismos criterios, dentro de la misma transacción.

### Universo → Encima Funnel (`UNIVERSO` → `ENCIMA_FUNNEL`)

Exige `ouvs.presupuesto_confirmado === true`. No lee `presupuesto_monto`. Un presupuesto confirmado en 0, o con monto null, pasa esta puerta.

### Encima Funnel → En Funnel (`ENCIMA_FUNNEL` → `EN_FUNNEL`)

Exige el filtro de influencias: al menos 2 tipos distintos en verde entre Económica, Técnica y Fábrica. No exige presupuesto.

### En Funnel → Mayor Probabilidad (`EN_FUNNEL` → `MAYOR_PROBABILIDAD`)

La única regla de negocio de esta transición es la misma que la anterior: el filtro de influencias (≥ 2 tipos en verde entre Económica, Técnica y Fábrica). No hay una segunda regla de presupuesto, checklist ni monto.

Eso es lo que hoy conserva el código. El detalle de por qué D2 no se puede implementar sin una respuesta está en la nota de bloqueo.

### Retroceso

`retrocederZona` no llama `assertGuardsForDestino`. Pide `motivo` no vacío. Desde `UNIVERSO` responde 400 (`Cannot retroceder from UNIVERSO — use Descartada instead`). Los guards del evento `ouv.retroceso_zona` solo comprueban que el actor sea el comercial dueño (o Admin / Gerente asignado, según el guard). No revalidan presupuesto ni influencias.

### Lo que no es una transición de zona

El cierre como Ganada (`OuvsService.ganar`, `evaluateGanadaClose`, `guardPresupuestoGanada`, `guardInfluenciasGanada`) sí exige presupuesto confirmado y monto > 0, y cuenta verde en los cinco tipos (Económica, Técnica, Fábrica, Usuario, Coach). Puede cerrarse desde cualquier zona. No participa del avance de zona. Este hotfix no lo toca.

La conversión SQL → OUV y el alta directa crean la OUV en `UNIVERSO`. No evalúan estas reglas.

El kanban de `/opportunities` no tiene drag. Las tarjetas son enlaces al detalle. No hay bloqueo de arrastre que actualizar.

## 3. Dónde se evalúa cada regla

### Presupuesto confirmado (booleano)

| Capa | Archivo | Función | Qué hace |
|---|---|---|---|
| Servicio (primera línea, la que responde al cliente) | `backend/src/modules/discovery/services/ouvs.service.ts` | `assertGuardsForDestino` | Si el destino es `ENCIMA_FUNNEL` y `presupuestoConfirmado` es false, lanza `BadRequestException` 400: `presupuesto_confirmado is required to advance to ENCIMA_FUNNEL`. |
| Quién la llama | el mismo archivo | `avanzarZona` | Calcula `nextZona`, llama el assert, luego actualiza `zona_actual` y arma el payload. |
| Guard del motor (segunda línea) | `backend/src/modules/workflow-engine/guards/guard-presupuesto-confirmado.ts` | `guardPresupuestoConfirmado` | Solo si `payload.zona_nueva` es `ENCIMA_FUNNEL` o viene ausente. Rechaza si `payload.presupuesto_confirmado !== true`. Mensaje: `presupuesto_confirmado debe ser true para avanzar a ENCIMA_FUNNEL`. |
| Registro del evento | `backend/src/modules/workflow-engine/workflow.rules.ts` | regla `ouv.avance_zona` | Encadena `guardPresupuestoConfirmado` y `guard2InfluenciasEnVerde` (además de los guards de comercial). |
| Payload | `ouvs.service.ts` | `avanzarZona` | Copia `ouv.presupuestoConfirmado` a `payload.presupuesto_confirmado`. No copia `presupuesto_monto` en el avance. |
| Hint de UI | `frontend/src/modules/discovery/lib/ouv-vocab.ts` | `guardsForDestino` | Si el destino es `ENCIMA_FUNNEL`, agrega el hint «Presupuesto confirmado». No mira el monto ni bloquea el botón. |
| Copy de UI | `frontend/src/modules/discovery/pages/OuvDetailPage.tsx` | sección Presupuesto | Texto fijo: marcar Confirmado «para poder avanzar a Encima Funnel». |
| Modal | `frontend/src/modules/discovery/components/AvanceZonaModal.tsx` | `confirm` | Lista los hints. El botón Confirmar no se deshabilita por presupuesto. El 400 del backend se muestra como `err.message`. |

Campo real: `ouvs.presupuesto_confirmado` (`BOOLEAN NOT NULL DEFAULT false`), modelo `Ouv.presupuestoConfirmado`. Se escribe en `actualizarPresupuesto` desde `ActualizarPresupuestoDto.presupuesto_confirmado`.

`ouvs.presupuesto_monto` (`DECIMAL(18,2)`, nullable, modelo `presupuestoMonto`) no entra en ninguna de las filas de arriba.

### Tipos de influencia en verde

Definición usada por el avance de zona y por el gap. Función `evaluateInfluenceFilter` en `backend/src/modules/discovery/lib/evaluate-influence-filter.ts`.

Una fila de `ouv_influencias` cuenta cuando `estado = 'Verde'` y `tipo` es `Economica`, `Tecnica` o `Fabrica`. El conteo es de tipos distintos (`Set`), no de contactos. Dos verdes del mismo tipo cuentan como uno. Un rojo del mismo tipo no anula el verde. `Usuario` y `Coach` no cuentan. El umbral es `INFLUENCE_FILTER_REQUIRED = 2`. `contacto_ouv_id` es `NOT NULL` en el modelo; el filtro no vuelve a comprobar que haya contacto: si la fila existe y está en verde, cuenta.

| Capa | Archivo | Función | Qué hace |
|---|---|---|---|
| Definición | `evaluate-influence-filter.ts` | `evaluateInfluenceFilter` | Devuelve `{ passed, greenTypes, required: 2 }`. |
| Mensaje | el mismo archivo | `influenceFilterBlockDetail` | `Se requieren 2 tipos de influencia en Verde (Económica, Técnica, Fábrica). Actualmente: N (nombres).` |
| Lectura | `backend/src/modules/discovery/services/ouv-influencias.service.ts` | `filtroForOuv`, `countGreenTypes` | Carga las filas de la OUV y aplica el filtro. |
| Servicio (primera línea) | `ouvs.service.ts` | `assertGuardsForDestino` | Si el destino es `EN_FUNNEL` o `MAYOR_PROBABILIDAD` y `filtro.passed` es false, lanza `InfluenciaProblemException` 422 (cuerpo RFC 7807, `detail` en español). |
| Guard del motor | `backend/src/modules/workflow-engine/guards/guard-2-influencias-en-verde.ts` | `guard2InfluenciasEnVerde` | `ZONAS_REQUIEREN_VERDE = { EN_FUNNEL, MAYOR_PROBABILIDAD }`. Lee `payload.influencias_verde_count`. Si es &lt; 2: `El filtro de influencias no se cumple: hay N tipos en Verde y se requieren 2.` |
| Payload | `ouvs.service.ts` | `avanzarZona` | `influencias_verde_count` = `countGreenTypes` (largo de `greenTypes`). |
| Hint y bloqueo de botón | `ouv-vocab.ts` `guardsForDestino` y `AvanceZonaModal.tsx` | — | Para destino `EN_FUNNEL` o `MAYOR_PROBABILIDAD`, hint «Al menos 2 tipos en Verde entre Económica, Técnica y Fábrica». El botón se deshabilita si `!filtro.passed`. |
| Badge siempre visible | `frontend/src/modules/discovery/components/InfluenciasSection.tsx` | — | Muestra «Filtro: N de M tipos en verde» y un tooltip con la misma definición. No depende de la zona destino. |

### Gap mientras la OUV ya está en una zona (no bloquea el movimiento ni la edición)

`CriteriosZonaEvaluator.computeFaltantes` (`backend/src/modules/discovery/services/criterios-zona.evaluator.ts`):

- Si el rango de `zona_actual` es ≥ `ENCIMA_FUNNEL` y `presupuestoConfirmado` es false → falta `presupuesto_confirmado`. No mira el monto.
- Si el rango es ≥ `EN_FUNNEL` y el filtro de influencias no pasa → falta `influencias_verde`.

Se invoca después de avanzar, retroceder, guardar presupuesto, cambiar una influencia y marcar un ítem de checklist. Escribe `tiene_gap` y `criterios_faltantes`. No cambia `zona_actual` y no impide editar. La UI muestra el banner y el `GapBadge`.

El checklist de zona se siembra al avanzar (`seedChecklistParaZona`) y se muestra en el modal. No es condición de avance.

### Auditoría de cambio de zona (D5: no cambia el formato)

`WorkflowEngineService.transition` escribe `audit_log` con `accion = STATE_CHANGE`, `campo_modificado = 'estado'`, `valor_anterior` / `valor_nuevo` como JSON del estado, y `contexto` con `event_type` más el payload. Además graba `status_history` con trigger `ADVANCE` o `RETREAT` (`status-history-trigger.ts`). El hotfix no debe alterar ese formato.

## 4. Tests que cubren estas transiciones

| Archivo | Qué cubre hoy |
|---|---|
| `backend/src/modules/workflow-engine/guards/ouv-funnel.guards.spec.ts` | `guardPresupuestoConfirmado`: deja pasar un destino distinto de `ENCIMA_FUNNEL` sin presupuesto; rechaza `ENCIMA_FUNNEL` sin el booleano; lo permite con `true`. `guard2InfluenciasEnVerde`: deja pasar `ENCIMA_FUNNEL` sin verdes; rechaza `EN_FUNNEL` con 0 o 1; permite `MAYOR_PROBABILIDAD` con 2. No hay caso de monto. |
| `backend/src/modules/discovery/services/ouv-creacion-sin-influencias.spec.ts` | `assertGuardsForDestino` de `ENCIMA_FUNNEL` → `EN_FUNNEL` con filtro no pasado: 422 y el `detail` en español. No cubre presupuesto ni Mayor Probabilidad ni retroceso. |
| `backend/src/modules/discovery/lib/evaluate-influence-filter.spec.ts` | Los siete casos del filtro (mismo tipo, dos tipos, rojo que no anula, Usuario/Coach fuera, un solo tipo, tres tipos, cinco del mismo tipo). |
| `backend/src/modules/workflow-engine/guards/guard-ejecutivo-o-gerente-asignado.spec.ts` | El evento `ouv.avance_zona` con un payload de ejemplo. No afirma la regla de zona. |
| `backend/src/modules/discovery/lib/evaluate-ganada-close.spec.ts` y el bloque `guardCierreGanada` del spec de guards | Cierre Ganada, incluido monto 0. Fuera del avance de zona. |

No hay spec de `CriteriosZonaEvaluator`. No hay tests de frontend para `guardsForDestino` ni para `AvanceZonaModal`.

## 5. Mapa pedido por el hotfix, contra el código

| Transición | Lo que el prompt llama «regla de antes» | Lo que el código hace hoy |
|---|---|---|
| Universo → Encima Funnel | Presupuesto confirmado y &gt; 0 | Solo `presupuesto_confirmado === true`. El monto no se lee. |
| Encima Funnel → En Funnel | ≥ 2 tipos de influencia en verde | Sí: filtro de `evaluateInfluenceFilter`. |
| En Funnel → Mayor Probabilidad | «Regla existente, si la hay» | Esa regla existente es el mismo filtro de influencias. No hay otra. |

El «&gt; 0» del presupuesto existe solo en el cierre Ganada.
