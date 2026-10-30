# RESUMEN-PASO-2 — reglas de embudo (deuda V1)

Fecha: 2026-10-30. Rama `EP-Fix-ReglasEmbudo`.

Este archivo es el cierre del desbloqueo de `NOTAS-BLOQUEO-2.md`. El resumen del Paso 2 (código, V2 y V3) sigue en `RESUMEN-PASO-2.md` de esta misma carpeta. El `RESUMEN-PASO-2.md` de la raíz del repo es el del embudo v1.2 (2026-08-07) y no se tocó.

B2 y B3 no venían rotulados en el mensaje de desbloqueo. Se leyeron así, a partir de lo que V1 dejó abierto:

- **B2:** el único error de tipo de este hotfix, `zonaActual` en `ouv-zona-transicion.spec.ts`.
- **B3:** el resto de `tsc --noEmit -p tsconfig.json`, specs que este hotfix no toca.

## B1 — deuda fuera de alcance (MEP/auth)

Confirmado: el fallo de `backend/src/modules/mep-integration/mep-contract-wiring.spec.ts` es previo a este hotfix.

`npx jest --no-coverage` en `backend/`:

- 97 suites: 1 fallida, 96 pasaron
- 696 tests: 20 fallaron, 676 pasaron

Los 20 fallos están en el `beforeAll` de esa suite. `ConfigService.getOrThrow` de `@nestjs/config` lanza `Configuration key "JWT_SECRET" does not exist` dentro de `JwtModule.registerAsync` en `auth.module.ts`. El doble de `ConfigService` del spec no cubre esa clave porque `MepIntegrationModule` importa `AuditModule` y este importa `AuthModule`.

No se modificó `AuthModule` ni ese spec. Queda como deuda de MEP/auth, fuera de las reglas del embudo.

## B2 — tipo del doble en el spec del hotfix

`npx tsc --noEmit -p tsconfig.json` marcaba `TS2339` en `ouv-zona-transicion.spec.ts`: el objeto del doble no declaraba `zonaActual` en su tipo, aunque Jest ya ejecutaba esos casos.

El harness ahora tipa la fila con `zonaActual: OuvZona`. `npx jest src/modules/discovery/services/ouv-zona-transicion.spec.ts --no-coverage`: 6 tests, todos pasaron. Un `tsc --noEmit -p tsconfig.json` posterior ya no menciona ese archivo.

## B3 — typecheck amplio, deuda previa

`npx tsc --noEmit -p tsconfig.build.json` salió 0. Ese es el proyecto de `nest build` y no incluye specs.

`npx tsc --noEmit -p tsconfig.json` sigue fallando en specs ajenos a este hotfix (metas comerciales, metas de demanda, calificación, reportes comerciales, interacciones, MEP). Es la misma clase que B1: deuda previa. No se tocaron esos archivos.

`npx tsc --noEmit` en `frontend/` salió 0.

## V3 (una línea)

El helper se queda en `backend/src/common/presupuesto-avance.ts` porque `common/` ya tiene reglas compartidas y moverlo haría que workflow-engine importe internals de discovery.
