# NOTAS-BLOQUEO-2 — Suite backend fuera de los archivos del hotfix

> **RESUELTO 2026-10-30.** B1: el fallo de `JWT_SECRET` es previo y queda fuera de alcance. B2 y B3 cerrados en `RESUMEN-PASO-2-reglas-embudo.md`. El Paso 3 sigue.

El texto de abajo es el registro del STOP. La resolución está en `RESUMEN-PASO-2-reglas-embudo.md`.

Fecha: 2026-10-30. Verificación V1 del Paso 2.

## Qué falló

`npx jest --no-coverage` en `backend/`:

- 97 suites: 1 fallida, 96 pasaron
- 696 tests: 20 fallaron, 676 pasaron

Suite: `backend/src/modules/mep-integration/mep-contract-wiring.spec.ts`.

Los 20 tests fallan en `beforeAll`, al hacer `moduleRef.compile()`. El mensaje es `Configuration key "JWT_SECRET" does not exist`, lanzado por el `ConfigService` real de `@nestjs/config` dentro de `JwtModule.registerAsync` en `backend/src/modules/auth/auth.module.ts`.

Ese spec declara un `ConfigService` doble, pero el stack usa el de `@nestjs/config`. `MepIntegrationModule` importa `AuditModule`, y `AuditModule` importa `AuthModule`. El doble no cubre `JWT_SECRET`.

## Por qué detiene el Paso 3

V1 dice que un fallo fuera de los archivos tocados por este hotfix para el trabajo. Este spec y `auth.module.ts` no están en el cambio de reglas del embudo. No lo arreglé.

## Lo que sí pasó

`npx tsc --noEmit -p tsconfig.build.json` salió 0. Ese es el proyecto que compila `nest build`. No incluye specs.

`npx tsc --noEmit -p tsconfig.json` falla en specs que este hotfix no toca (metas comerciales, metas de demanda, calificación, reportes, interacciones, MEP) y en `ouv-zona-transicion.spec.ts`: el doble no declara `zonaActual` en su tipo, aunque Jest ejecutó esos casos.

## Para seguir

Indica una de estas:

1. El fallo de `JWT_SECRET` en `mep-contract-wiring.spec.ts` se acepta como previo y el Paso 3 sigue.
2. Hay que dejar esa suite en verde antes del frontend. En ese caso el arreglo es de MEP/auth, no de las reglas del embudo.
