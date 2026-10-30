# RESUMEN-PASO-1 — Corrección de reglas del embudo (spec EARS)

Fecha: 2026-10-30. Sin código de producto. Rama `EP-Fix-ReglasEmbudo`.

## Entrega

Registro: `specs/decisions/2026-10-30-correccion-reglas-embudo.md` (D1–D8).

EARS: `docs/specs/spec-ouv-funnel.md` pasa a v1.6, estado pendiente de aprobación. Lo aprobado anterior sigue siendo v1.5.1 hasta que este paso se apruebe.

Incorpora la respuesta a `NOTAS-BLOQUEO-1.md`: D2 es la opción 1, más D6 (monto), D7 (gap) y D8 (cinco tipos).

El spec cubre:

- `UNIVERSO` → `ENCIMA_FUNNEL` sin regla de negocio;
- `ENCIMA_FUNNEL` → `EN_FUNNEL` con presupuesto confirmado y monto > 0, sin influencias, mensaje en español que nombra la condición que falla (400);
- `EN_FUNNEL` → `MAYOR_PROBABILIDAD` solo con el filtro, ahora de cinco tipos y umbral 2;
- retroceso y cierre Ganada sin cambio;
- gap alineado a D7, sin script, con el trade-off de que se corrige en el próximo evento;
- hints, copy de presupuesto y bloqueo del botón solo hacia `MAYOR_PROBABILIDAD`.

`guardPresupuestoConfirmado` no aplica si `zona_nueva` no es `EN_FUNNEL`. `guard2InfluenciasEnVerde` sigue exigiendo el conteo cuando `zona_nueva` viene vacía.

## Matriz de pruebas

Cada fila es un caso del Paso 2. «Permite» significa que esa regla no rechaza; los guards de comercial siguen igual y no se reabren aquí.

### Avance

| Id | Transición | Caso | Resultado |
|---|---|---|---|
| A1 | `UNIVERSO` → `ENCIMA_FUNNEL` | `presupuesto_confirmado` false y monto null | Permite |
| A2 | `UNIVERSO` → `ENCIMA_FUNNEL` | confirmado false y monto > 0 | Permite |
| A3 | `UNIVERSO` → `ENCIMA_FUNNEL` | confirmado true | Permite |
| A4 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado false, monto null | 400. Las dos frases, booleano primero |
| A5 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado false, monto 0 | 400. Las dos frases |
| A6 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado false, monto > 0 | 400. Solo la frase del booleano |
| A7 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado true, monto null | 400. Solo la frase del monto |
| A8 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado true, monto 0 | 400. Solo la frase del monto |
| A9 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado true, monto negativo | 400. Solo la frase del monto |
| A10 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado true, monto > 0, cero influencias en verde | Permite |
| A11 | `ENCIMA_FUNNEL` → `EN_FUNNEL` | confirmado true, monto > 0, un solo tipo en verde | Permite |
| A12 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | un tipo en verde (Económica) | 422. `detail` con los cinco tipos y «Actualmente: 1 (Económica)» |
| A13 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | cero tipos en verde | 422 |
| A14 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | Usuario + Coach en verde | Permite |
| A15 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | Coach + Económica en verde | Permite |
| A16 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | varias filas, solo Usuario en verde | 422 |
| A17 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | Económica + Técnica en verde, sin presupuesto | Permite |
| A18 | `EN_FUNNEL` → `MAYOR_PROBABILIDAD` | filtro pasa y presupuesto confirmado con monto > 0 | Permite |

### Guards sueltos

| Id | Guard | Caso | Resultado |
|---|---|---|---|
| G1 | `guardPresupuestoConfirmado` | `zona_nueva` ausente, presupuesto false | ok |
| G2 | `guardPresupuestoConfirmado` | `zona_nueva` = `ENCIMA_FUNNEL`, presupuesto false | ok |
| G3 | `guardPresupuestoConfirmado` | `zona_nueva` = `EN_FUNNEL`, confirmado true, monto 0 | rechaza, frase del monto |
| G4 | `guardPresupuestoConfirmado` | `zona_nueva` = `EN_FUNNEL`, confirmado true, monto > 0 | ok |
| G5 | `guard2InfluenciasEnVerde` | `zona_nueva` = `EN_FUNNEL`, conteo 0 | ok |
| G6 | `guard2InfluenciasEnVerde` | `zona_nueva` = `MAYOR_PROBABILIDAD`, conteo 1 | rechaza |
| G7 | `guard2InfluenciasEnVerde` | `zona_nueva` = `MAYOR_PROBABILIDAD`, conteo 2 | ok |
| G8 | `guard2InfluenciasEnVerde` | `zona_nueva` vacía, conteo 0 | rechaza (se conserva) |

### Retroceso y permanencia

| Id | Caso | Resultado |
|---|---|---|
| R1 | Retroceso `EN_FUNNEL` → `ENCIMA_FUNNEL` sin presupuesto, con motivo | Permite. No aplica D6 |
| R2 | Retroceso `MAYOR_PROBABILIDAD` → `EN_FUNNEL` con menos de 2 verdes, con motivo | Permite |
| R3 | Retroceso desde `UNIVERSO` | Rechaza, igual que hoy |
| R4 | Retroceso sin motivo | Rechaza, igual que hoy |
| R5 | OUV ya en `EN_FUNNEL` sin presupuesto, sin evento de evaluador | `zona_actual` no cambia. La edición de metadatos sigue permitida. El gap guardado no se toca hasta el próximo evento |

### Gap (`CriteriosZonaEvaluator`, spec nuevo)

| Id | Zona actual | Datos | `criterios_faltantes` |
|---|---|---|---|
| C1 | `UNIVERSO` | sin presupuesto, sin verdes | sin `presupuesto_confirmado` ni `influencias_verde` |
| C2 | `ENCIMA_FUNNEL` | confirmado false, monto null | sin esos dos tokens |
| C3 | `EN_FUNNEL` | confirmado false, cero verdes | solo `presupuesto_confirmado` |
| C4 | `EN_FUNNEL` | confirmado true, monto 0 | solo `presupuesto_confirmado` |
| C5 | `EN_FUNNEL` | confirmado true, monto > 0, cero verdes | ninguno de los dos |
| C6 | `MAYOR_PROBABILIDAD` | presupuesto ok, filtro no pasa | solo `influencias_verde` |
| C7 | `MAYOR_PROBABILIDAD` | presupuesto no cumple, filtro pasa | solo `presupuesto_confirmado` |
| C8 | `MAYOR_PROBABILIDAD` | fallan los dos | `presupuesto_confirmado`, luego `influencias_verde` |
| C9 | cualquiera de C3–C8 | después de evaluar | `zona_actual` igual a la de entrada |

### Filtro (`evaluate-influence-filter.spec.ts`)

| Id | Caso | Resultado |
|---|---|---|
| F1 | Usuario y Coach en verde, sin los otros tres | pasa. `greenTypes` incluye los dos |
| F2 | Coach + Económica en verde | pasa |
| F3 | varias filas solo de Usuario en verde | no pasa. Un solo tipo |
| F4 | El caso viejo «Usuario y Coach no cuentan» | se invierte: ahora sí cuentan |
| F5 | Económica + Técnica en verde | sigue pasando |
| F6 | Un rojo no anula el verde del mismo tipo | sigue pasando si hay otro tipo en verde |

El `detail` esperado en `ouv-creacion-sin-influencias.spec.ts` pasa a nombrar los cinco tipos. Ese spec hoy prueba el bloqueo hacia `EN_FUNNEL`; con la regla nueva ese destino ya no usa el filtro. El caso de bloqueo se mueve a destino `MAYOR_PROBABILIDAD`. Hacia `EN_FUNNEL`, el mismo archivo cubre A7/A8 (monto) y A10 (sin influencias, permite) si el presupuesto cumple.

`ouv-funnel.guards.spec.ts` se reescribe a G1–G8. Los casos que hoy rechazan `ENCIMA_FUNNEL` sin booleano, o `EN_FUNNEL` con menos de 2 verdes, dejan de ser el comportamiento esperado.

Cierre Ganada: sin casos nuevos. Los specs de `evaluateGanadaClose` y `guardInfluenciasGanada` no se modifican.

## Pendiente

Aprobación de este paso antes del Paso 2 (backend).
