# PR — Metas comerciales por trimestre Verytel

## Resumen

Soporte Comercial y Admin registran la meta en COP de cada comercial (Ejecutivo o Gerente) por año fiscal, trimestre Verytel y segmento. El engranaje está en el tablero de OUVs (`/opportunities/dashboard`) y la pantalla es `/dashboard/metas-comerciales`. No hay avance contra ventas.

## Decisiones que Evilio debe validar

- **DA-01.** No existe `/dashboard`. El engranaje se agregó al tablero de OUVs. «← Dashboard» vuelve a `/opportunities/dashboard`. La pantalla nueva sí usa `/dashboard/metas-comerciales`.
- **DA-02.** La meta guarda `segment_id` del catálogo `segments`, incluido «Otros». No usa el ENUM `ouvs.segmento`.
- **DA-14.** Las migraciones no se corrieron: `DB_HOST` de `backend/.env` no es local.

El resto (monto `DECIMAL(18,0)`, `active_marker`, sin `created_by`, `<select>` nativo, redirección a `/opportunities`, Soporte sin Auditoría, módulo nuevo sin ítem de menú, texto del 409, cifra en millones) está en `DECISIONES-AUTONOMAS.md`.

## Cambios por capa

- Backend. Tabla, permisos, helper `verytel-quarter.ts`, módulo `commercial-goals`, `findSegmentNamesByIds`.
- Frontend. Engranaje, ruta, pantalla, cinco componentes presentacionales, helpers de COP y de trimestre.
- Specs. `specs/metas-comerciales/` y `specs/decisions/2026-10-20-metas-comerciales.md`. `AGENTS.md` §14.

## Migración

`20261020231000` crea la tabla. `20261020231100` agrega el subject `CommercialGoal` a Soporte y Admin. Detalle y reversión en `DESPLIEGUE.md`. Después, esas dos personas cierran sesión y vuelven a entrar.

## Cómo probar

Checklist: `QA-CHECKLIST.md` y la prueba manual de `RESUMEN-PASO-2.md`.

Backend, Paso 3: `npx jest --forceExit --no-coverage`. 79 suites, 549 tests, 529 en verde y 20 en rojo. Los 20 son `mep-contract-wiring.spec.ts` (`JWT_SECRET`), deuda previa.

Frontend, Paso 3: `npm run build`. `tsc -b && vite build`, 418 módulos, en verde.

## Deuda y después

- Aplicar las dos migraciones en una base local o en el ambiente que corresponda (DA-14).
- Prueba manual de Evilio, ocho puntos.
- Soporte no ve Auditoría. El historial dentro de la pantalla queda fuera.
- El frontend no tiene runner de tests.
- `mep-contract-wiring.spec.ts` sigue en rojo por `JWT_SECRET`.
- Mejora futura: avance de la meta contra las ventas reales. También, más adelante, copiar el trimestre anterior y la carga masiva.
