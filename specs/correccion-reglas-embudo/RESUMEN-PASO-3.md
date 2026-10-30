# RESUMEN-PASO-3 — frontend de las reglas de embudo

Fecha: 2026-10-30. Rama `EP-Fix-ReglasEmbudo`. STOP al cerrar este paso.

La validación que decide el avance sigue en el backend. La UI solo muestra la misma regla. No hay componentes ni utilidades nuevas. El cierre Ganada no se tocó. No hay arrastre en el kanban: las tarjetas son enlaces.

`npx tsc --noEmit` en `frontend/` salió 0.

## Archivos

- `frontend/src/modules/discovery/lib/ouv-vocab.ts` — `guardsForDestino`. Universo y Encima Funnel solo muestran el aviso de comercial dueño. En Funnel añade «Presupuesto confirmado y monto mayor a 0». Mayor Probabilidad añade «Al menos 2 tipos en Verde entre Económica, Técnica, Fábrica, Usuario y Coach».
- `frontend/src/modules/discovery/components/AvanceZonaModal.tsx` — Confirmar se deshabilita por el filtro de influencias solo si el destino es `MAYOR_PROBABILIDAD` y el filtro no pasa. El presupuesto no deshabilita el botón: el 400 sale al confirmar.
- `frontend/src/modules/discovery/pages/OuvDetailPage.tsx` — el texto de presupuesto dice: Marca "Confirmado" y un monto mayor a 0 para poder avanzar a En Funnel.
- `frontend/src/modules/discovery/components/InfluenciasSection.tsx` — el tooltip nombra Económica, Técnica, Fábrica, Usuario y Coach. La insignia sigue `Filtro: {greenCount} de {filtro.required} tipos en verde` y `required` sigue en 2.

## Verificación en navegador

El servidor de `frontend/` respondió HTTP 200 en `http://localhost:5173`. El navegador de Cursor no pudo abrir esa URL (`chrome-error`). No se inició sesión ni se ejercieron el modal, el texto de presupuesto ni el tooltip. El recorrido de abajo queda para ejecución manual.

## Recorrido manual

Entra como el comercial dueño de la OUV. Abre el detalle y usa Avanzar zona.

**A1.** OUV en Universo, sin presupuesto confirmado y sin monto. Avanza a Encima Funnel. El modal no pide presupuesto ni influencias. Confirmar permite el avance.

**A4.** OUV en Encima Funnel, confirmado en falso y monto vacío o 0. Avanza a En Funnel. Confirmar sigue habilitado. Al confirmar, el mensaje trae las dos frases, primero la del booleano: «El presupuesto debe estar confirmado para avanzar a En Funnel.» y después «El presupuesto debe ser mayor a 0 para avanzar a En Funnel.» La zona no cambia.

**A7.** Misma OUV, confirmado en verdadero y monto vacío. Confirmar. El mensaje trae solo la frase del monto. La zona no cambia.

**A10.** Encima Funnel, confirmado y monto mayor a 0, sin influencias en verde. Avanza a En Funnel. Confirmar permite el avance.

**A12.** OUV en En Funnel con un solo tipo en verde (Económica). Avanza a Mayor Probabilidad. Confirmar queda deshabilitado. El detalle nombra los cinco tipos y «Actualmente: 1 (Económica)». La zona no cambia.

**A14.** En Funnel con Usuario y Coach en verde, sin presupuesto. Avanza a Mayor Probabilidad. Confirmar permite el avance. El presupuesto no se exige en este salto.

**R5.** OUV que ya está en En Funnel sin presupuesto confirmado o con monto 0. El detalle se abre y se pueden guardar metadatos. La zona no cambia. El hueco guardado no se reescribe hasta un evento que ya llama al evaluador (avance, retroceso, presupuesto, influencia o checklist).

## Antes del commit

**V2.** D5 de `specs/decisions/2026-10-30-correccion-reglas-embudo.md` ya dice que el `contexto` de `audit_log` en `ouv.avance_zona` incluye `presupuesto_monto` (cambio aditivo; formato y columnas sin cambio). No hizo falta agregarlo.

**V3.** No se movió `presupuesto-avance.ts`: `common/` ya guarda reglas de dominio de otros módulos (`bogota-day` y `verytel-quarter`, usadas por demand-generation, qualification y discovery). El guard de workflow-engine también importa este helper; pasarlo a `discovery/lib` cruzaría el límite de módulo. Las 6 suites no se reejecutaron porque el archivo no cambió de sitio.
