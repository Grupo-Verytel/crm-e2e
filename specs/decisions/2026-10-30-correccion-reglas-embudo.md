# 2026-10-30 — Corrección de reglas de transición del embudo comercial (OUV)

Estado: escrito en el Paso 1. Pendiente de aprobación humana. No cambia el stack, no agrega tablas, columnas ni librerías, y no migra datos.

Descubrimiento: `specs/correccion-reglas-embudo/RESUMEN-PASO-0.md`.
Desbloqueo: `specs/correccion-reglas-embudo/NOTAS-BLOQUEO-1.md`.
EARS: `docs/specs/spec-ouv-funnel.md` v1.6.

## Contexto

En producción las reglas de avance estaban en la transición equivocada. Este hotfix mueve las reglas que ya existen. No inventa una condición de negocio fuera de D1–D8.

Los nombres de zona del prompt no se usan en código. El mapa real es:

| Prompt | Valor en `ouvs.zona_actual` |
|---|---|
| Universo | `UNIVERSO` |
| Encima del Funnel | `ENCIMA_FUNNEL` |
| Funnel | `EN_FUNNEL` |
| Mayor probabilidad | `MAYOR_PROBABILIDAD` |

## Antes / después

| Transición | Antes (código en `develop`) | Después |
|---|---|---|
| `UNIVERSO` → `ENCIMA_FUNNEL` | `presupuesto_confirmado === true`. El monto no se leía. | Sin regla de negocio. Siguen los guards de comercial. |
| `ENCIMA_FUNNEL` → `EN_FUNNEL` | Filtro de influencias (≥ 2 tipos en verde). | `presupuesto_confirmado === true` y `presupuesto_monto > 0`. Sin filtro de influencias. |
| `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | El mismo filtro de influencias. No había otra regla. | El mismo filtro, ahora con los cinco tipos de D8. Sin presupuesto. |
| Retroceso | Motivo obligatorio. Sin presupuesto ni influencias. Desde `UNIVERSO` no retrocede. | Igual. |
| Cierre Ganada | Presupuesto confirmado y monto > 0, y ≥ 2 tipos entre los cinco, con `evaluateGanadaClose`. | Fuera de alcance. No se toca. |

El «antes» de presupuesto no era «confirmado y > 0». El booleano solo se exigía al entrar a `ENCIMA_FUNNEL`. El monto > 0 vive hoy únicamente en el cierre Ganada.

## D1

`UNIVERSO` → `ENCIMA_FUNNEL` no valida presupuesto ni influencias.

## D2

La regla que ya tenía `EN_FUNNEL` → `MAYOR_PROBABILIDAD` es el filtro de influencias. No se le suma otra condición. No se le exige presupuesto.

## D3

Una OUV que ya está en una zona y no cumple la regla corregida no se mueve. No hay script ni migración. La regla se aplica en el próximo avance. La edición no se bloquea por eso.

## D4

El retroceso conserva el comportamiento actual, incluido el motivo obligatorio y el rechazo desde `UNIVERSO`.

## D5

La auditoría de cambio de zona no se rediseña. Siguen `audit_log` (`STATE_CHANGE`, `campo_modificado = 'estado'`) y `status_history` con trigger `ADVANCE` o `RETREAT`.

`avanzarZona` agrega `presupuesto_monto` al payload de `ouv.avance_zona` porque el guard lo lee de ahí. El motor copia ese payload dentro de `contexto`. El `contexto` de `audit_log` en `ouv.avance_zona` ahora incluye `presupuesto_monto` (cambio aditivo; formato y columnas sin cambio). Es el mismo mecanismo que ya usa `influencias_verde_count`.

## D6

`ENCIMA_FUNNEL` → `EN_FUNNEL` exige las dos condiciones. `presupuesto_monto` null, cadena vacía, no numérico, 0 o negativo no pasa. Null se trata como 0.

La comparación es numérica y estricta (`> 0`), sobre el valor ya guardado en `ouvs.presupuesto_monto`. No se reutiliza `evaluateGanadaClose` ni `guardPresupuestoGanada`.

El rechazo lo lanza primero `assertGuardsForDestino`, con `BadRequestException` (400), que es el tipo que ya usa esta puerta. El texto va en español y nombra solo la condición que falla. Si fallan las dos, van las dos frases, en este orden:

- Falta el booleano: `El presupuesto debe estar confirmado para avanzar a En Funnel.`
- Falta el monto: `El presupuesto debe ser mayor a 0 para avanzar a En Funnel.`

`guardPresupuestoConfirmado` es la segunda línea, solo cuando `payload.zona_nueva === 'EN_FUNNEL'`. Si `zona_nueva` viene ausente o es otra zona, el guard responde ok. El `detalle` usa las mismas frases. El payload del avance incluye `presupuesto_confirmado` y `presupuesto_monto` (número, o null).

## D7

`CriteriosZonaEvaluator.computeFaltantes` usa el mapa nuevo. Los tokens no cambian: `presupuesto_confirmado` e `influencias_verde`. El primero significa ahora booleano y monto > 0, con la misma comparación de D6.

- `presupuesto_confirmado` entra si `zonaRank(zona_actual) >= zonaRank(EN_FUNNEL)` y la comparación de D6 no pasa.
- `influencias_verde` entra si `zonaRank(zona_actual) >= zonaRank(MAYOR_PROBABILIDAD)` y `evaluateInfluenceFilter` no pasa.
- Orden: presupuesto, después influencias.
- `UNIVERSO` y `ENCIMA_FUNNEL` no reciben estos dos tokens por estas reglas.

No hay recálculo masivo. Una OUV ya guardada conserva `tiene_gap` y `criterios_faltantes` hasta el próximo evento que ya llama al evaluador (avance, retroceso, presupuesto, influencia o checklist). En ese evento se reescriben con D7. Puede aparecer un gap que antes no estaba, o desaparecer el de influencias en una OUV que sigue en `EN_FUNNEL`. No se mueve `zona_actual` y no se bloquea la edición. Trade-off aceptado.

## D8

`evaluateInfluenceFilter` cuenta cinco valores del enum `InfluenciaTipo`: `Economica`, `Tecnica`, `Fabrica`, `Usuario`, `Coach`. El umbral sigue en 2 tipos distintos. Siguen el `Set` por tipo, el rojo que no anula un verde y el hecho de que cualquier fila en `Verde` cuenta.

Aplica al avance `EN_FUNNEL` → `MAYOR_PROBABILIDAD`, al gap de D7 y al badge de `InfluenciasSection`. `filtro.required` sigue siendo 2. El «M» de «N de M tipos en verde» es ese umbral, no 5.

`influenceFilterBlockDetail` lista los cinco tipos:

`Se requieren 2 tipos de influencia en Verde (Económica, Técnica, Fábrica, Usuario, Coach). Actualmente: …`

`guard2InfluenciasEnVerde` solo cambia el conjunto: exige el conteo cuando `zona_nueva` es `MAYOR_PROBABILIDAD`. Si `zona_nueva` viene vacía, sigue exigiendo el conteo, como hoy. Su frase de `detalle` no se reescribe; el mensaje que ve el usuario en el avance es el 422 de `influenceFilterBlockDetail`, porque el servicio rechaza antes.

`evaluateGanadaClose` y `guardInfluenciasGanada` no se tocan y no se unifican con este filtro. Quedan anotados: el cierre Ganada ya contaba estos mismos cinco tipos por su propia función.

## Puntos de código (Paso 2 y Paso 3, no en este paso)

- `assertGuardsForDestino`: presupuesto (D6) solo hacia `EN_FUNNEL`; influencias solo hacia `MAYOR_PROBABILIDAD`.
- `guardPresupuestoConfirmado` y el payload de `avanzarZona`, según D6.
- `guard2InfluenciasEnVerde`: `ZONAS_REQUIEREN_VERDE = { MAYOR_PROBABILIDAD }`.
- `CriteriosZonaEvaluator`, según D7.
- `evaluate-influence-filter.ts`, según D8.
- Frontend: `guardsForDestino`, el copy de presupuesto en `OuvDetailPage`, el bloqueo del botón de `AvanceZonaModal` solo si el destino es `MAYOR_PROBABILIDAD`, y el tooltip de `InfluenciasSection` con los cinco tipos.

Copy de la sección Presupuesto:

`Marca "Confirmado" y un monto mayor a 0 para poder avanzar a En Funnel.`

Hints:

- Destino `ENCIMA_FUNNEL`: sin hint de presupuesto ni de influencias. El de comercial dueño se queda.
- Destino `EN_FUNNEL`: «Presupuesto confirmado y mayor a 0».
- Destino `MAYOR_PROBABILIDAD`: «Al menos 2 tipos en Verde entre Económica, Técnica, Fábrica, Usuario y Coach».

El botón Confirmar del modal no se deshabilita por presupuesto. Si falta, el 400 del backend muestra el mensaje de D6. El botón sí se deshabilita cuando el destino es `MAYOR_PROBABILIDAD` y el filtro no pasa.
