# RESUMEN-PASO-2 — Corrección de reglas del embudo (backend)

Fecha: 2026-10-30. Rama `EP-Fix-ReglasEmbudo`. Sin frontend. Sin migración.

## AJ1 — `zona_nueva` en el payload

`ouv.avance_zona` es el único evento que encadena `guardPresupuestoConfirmado` y `guard2InfluenciasEnVerde`. Está en `workflow.rules.ts`. Ningún otro evento los usa.

El único `transition(..., 'ouv.avance_zona', ...)` está en `OuvsService.avanzarZona`. Ahí `zona_nueva` es `destino`, y `destino` solo existe después de que `nextZona` devolvió una zona. Siempre viaja, junto con `zona_anterior`, `comercial_id`, `presupuesto_confirmado`, `presupuesto_monto` e `influencias_verde_count`.

`retrocederZona` también manda `zona_nueva`, pero el evento es `ouv.retroceso_zona` y no lleva estos dos guards.

G8 se conserva: si `zona_nueva` llega vacía, `guard2InfluenciasEnVerde` sigue exigiendo el conteo.

El test `AJ1: UNIVERSO to ENCIMA_FUNNEL with 0 verdes and no presupuesto passes every guard` arma el payload real de `avanzarZona` y lo pasa por los cuatro guards de la regla (`guardUsuarioEsComercialDelOUV`, `guardEjecutivoOGerenteAsignado`, `guardPresupuestoConfirmado`, `guard2InfluenciasEnVerde`). Pasa.

## AJ2 — Monto decimal

Un solo helper, `backend/src/common/presupuesto-avance.ts`:

- `null` y `undefined` valen 0.
- Un string pasa por `Number` antes de comparar `> 0`.
- Lo usan `assertGuardsForDestino`, `guardPresupuestoConfirmado` y `CriteriosZonaEvaluator`.

`"0.00"` rechaza y `"1500000.00"` permite, en el servicio y en el guard.

## Reglas que quedaron en código

| Transición | Dónde |
|---|---|
| `UNIVERSO` → `ENCIMA_FUNNEL` | Sin presupuesto ni influencias |
| `ENCIMA_FUNNEL` → `EN_FUNNEL` | Booleano y monto > 0. 400 con la frase de lo que falla. Sin filtro |
| `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | Filtro de cinco tipos, umbral 2. 422 |
| Retroceso | Igual que antes |
| Cierre Ganada | Sin cambios |

`evaluateInfluenceFilter` cuenta `Economica`, `Tecnica`, `Fabrica`, `Usuario` y `Coach`. El gap marca `presupuesto_confirmado` desde `EN_FUNNEL` y `influencias_verde` desde `MAYOR_PROBABILIDAD`. No hay script de recálculo.

## Archivos

- `backend/src/common/presupuesto-avance.ts` (nuevo) y su spec
- `backend/src/modules/discovery/services/ouvs.service.ts`
- `backend/src/modules/discovery/services/criterios-zona.evaluator.ts` y spec nuevo
- `backend/src/modules/discovery/lib/evaluate-influence-filter.ts` y su spec
- `backend/src/modules/workflow-engine/guards/guard-presupuesto-confirmado.ts`
- `backend/src/modules/workflow-engine/guards/guard-2-influencias-en-verde.ts`
- `backend/src/modules/workflow-engine/guards/ouv-funnel.guards.spec.ts`
- `backend/src/modules/discovery/services/ouv-creacion-sin-influencias.spec.ts`
- `backend/src/modules/discovery/services/ouv-zona-transicion.spec.ts` (nuevo)

## Tests

```
npx jest --testPathPatterns "presupuesto-avance.spec|evaluate-influence-filter.spec|ouv-funnel.guards.spec|ouv-creacion-sin-influencias.spec|ouv-zona-transicion.spec|criterios-zona.evaluator.spec" --no-coverage
```

6 suites, 56 tests, todos pasaron. Cubren A1–A18, G1–G8, R1–R5, C1–C9, F1–F6 y los dos montos decimales de AJ2.

## Adenda — V1, V2, V3 (2026-10-30)

### V1 — Suite y tipos

`npx jest --no-coverage` en `backend/`: **97 suites, 1 fallida, 96 pasaron. 696 tests, 20 fallaron, 676 pasaron.**

La suite fallida es `src/modules/mep-integration/mep-contract-wiring.spec.ts`. Los 20 casos mueren al compilar el módulo de prueba: `Configuration key "JWT_SECRET" does not exist` en `auth.module.ts`. Este hotfix no toca ese archivo ni `auth`. El detalle está en `NOTAS-BLOQUEO-2.md`. El Paso 3 no arrancó.

`npx tsc --noEmit -p tsconfig.build.json` (el que usa `nest build`, sin specs): **salió 0.**

`npx tsc --noEmit -p tsconfig.json` (incluye specs): falla. Hay errores previos en specs de metas comerciales, metas de demanda, calificación, reportes, interacciones y MEP. En un archivo de este hotfix, `ouv-zona-transicion.spec.ts`, `zonaActual` no está en el tipo inferido del doble (líneas 114, 141 y 176). Jest sí ejecutó ese spec.

### V2 — Auditoría

D5 del registro ya dice que el `contexto` de `audit_log` en `ouv.avance_zona` incluye `presupuesto_monto`. Cambio aditivo. Formato y columnas iguales.

### V3 — Helper

Se queda en `backend/src/common/presupuesto-avance.ts`: `common/` ya guarda reglas que usan varios módulos (`bogota-day`, `verytel-quarter`) y este helper lo comparten discovery y el guard de workflow-engine.

## Pendiente

Cerrado en `RESUMEN-PASO-2-reglas-embudo.md`. El Paso 3 arrancó después de ese desbloqueo.
