# NOTAS-BLOQUEO-1 — Regla existente de En Funnel → Mayor Probabilidad

> **RESUELTO 2026-10-30.** D2 = opción 1. D6, D7 y D8 quedaron en `specs/decisions/2026-10-30-correccion-reglas-embudo.md`. El Paso 1 está en `RESUMEN-PASO-1.md`. Este archivo se conserva como histórico del stop.

Fecha: 2026-10-30. Paso 0. Condición R5. No se escribió spec ni se tocó código de producto.

El descubrimiento está en `RESUMEN-PASO-0.md`.

## Qué pide D2

En Funnel → Mayor probabilidad se suman dos cosas: la regla que ya existe en esa transición, más ≥ 2 tipos de influencia en verde.

## Qué hay en el código

La única regla de negocio de `EN_FUNNEL` → `MAYOR_PROBABILIDAD` ya es ese filtro de influencias.

La aplican `OuvsService.assertGuardsForDestino` y `guard2InfluenciasEnVerde`. La spec vigente dice lo mismo (`docs/specs/spec-ouv-funnel.md`, EARS-13): destino `MAYOR_PROBABILIDAD` = estado anterior `EN_FUNNEL` + `guard2InfluenciasEnVerde`.

No bloquean el avance, en esa transición:

- el presupuesto (`guardPresupuestoConfirmado` sale en ok si `zona_nueva` no es `ENCIMA_FUNNEL`);
- el monto (`presupuesto_monto` no viaja en el payload de `ouv.avance_zona`);
- el checklist (se muestra y se siembra; no es guard);
- el gap (`CriteriosZonaEvaluator` corre después del update y no revierte la zona).

Los guards de comercial (`guardUsuarioEsComercialDelOUV`, `guardEjecutivoOGerenteAsignado`) aplican a todo avance y a todo retroceso. No son una regla de esta transición.

## Por qué no sigo

«Conservar la existente y sumar influencias» no tiene una segunda regla que sumar. Si asumo que la existente es el filtro, el Paso 2 deja esta transición igual que hoy. Si asumo que falta otra regla (checklist, presupuesto, monto, los cinco tipos del cierre Ganada), estaría inventándola. R5 prohíbe las dos cosas.

## Decisión que hace falta

Elige una:

1. La regla existente es el filtro de influencias (Económica, Técnica, Fábrica, ≥ 2 tipos en `Verde`). En Funnel → Mayor Probabilidad se queda solo con esa regla. «Sumar» no agrega otra condición.
2. Hay otra regla de negocio que este Paso 0 no encontró en el repo. Indica cuál es, con el campo o el comportamiento concreto, y el Paso 1 la escribe junto al filtro.

Hasta esa respuesta no arranca el Paso 1.

## Hallazgo relacionado, no es la pregunta de arriba

El avance de zona no comprueba `presupuesto_monto > 0`. Solo mira el booleano `presupuesto_confirmado`. El «mayor que 0» vive en el cierre Ganada (`evaluateGanadaClose` / `guardPresupuestoGanada`), con otro conjunto de tipos de influencia.

La tabla del hotfix describe la regla corregida de Encima Funnel → En Funnel como «presupuesto confirmado y > 0». El EARS del Paso 1, en el prompt, también rechaza valor ≤ 0. Cuando se destrabe D2, el Paso 1 va a escribir esa puerta (booleano y monto) en Encima Funnel → En Funnel, y ninguna puerta en Universo → Encima Funnel. Si el monto no debe entrar al avance de zona, dímelo en la misma respuesta.
