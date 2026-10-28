# RESUMEN-PASO-3 — Subtítulo y verificación del tablero de Calificación

**Fecha:** 2026-10-27
**Estado:** frontend listo. Sin commit y sin push.

## Punto 0 — `follow-up-status.spec.ts` en `develop`

Worktree desprendido en `develop` (`3dddf53`, «Merge branch 'EP-Feature-GerenteComercial' into develop»), fuera del repo de trabajo. Comando, corrido desde `backend` para que apliquen el `ts-jest` y el `.env` de esa carpeta:

```text
npx jest --rootDir C:\Users\ASUS\AppData\Local\Temp\crm-e2e-develop\backend\src --testPathPatterns follow-up-status.spec --runInBand --no-coverage --forceExit
```

En `develop`: **1 failed, 14 passed** (15). El fallo es el caso «exact yellow limit»: la conexión a MySQL supera el timeout de 5 s de Jest.

En esta rama el mismo archivo falla por el mismo timeout. `follow-up-status.spec.ts` y `follow-up-status.ts` no tienen diff contra `develop`. Es preexistente. No se arregló. No hay `NOTAS-BLOQUEO-3.md`. El worktree se eliminó al cerrar el paso.

## Archivo de UI

El encabezado del Bloque B vive en el componente de tarjetas, no en la página. El texto pedido queda en la página y se pinta bajo los dos `h2` del bloque.

| Archivo | Cambio |
|---|---|
| `frontend/src/modules/qualification/pages/QualificationDashboardPage.tsx` | Pasa `leadOriginCaption="Solo oportunidades originadas en Leads"` |
| `frontend/src/modules/qualification/components/QualificationDashboardCharts.tsx` | Bajo «Pipeline abierto (valor presupuestado)» y bajo «Cierre del periodo»: `<p className="mb-3 mt-1 text-sm text-muted">` |

El Bloque A (bandeja MQL y citas) no lleva subtítulo. No hay componente nuevo, token nuevo ni cambio de llamada a la API.

## Checklist de verificación manual (año 2026)

Sesión en `http://localhost:5173`: `admin@verytel.local`, nombre en pantalla «Comercial Plataforma», rol Admin. En este tablero Admin lee el mismo universo de OUVs que Gerente Comercial. El recorte por `comercial_id` aplica solo a `EjecutivoComercial`.

### Tablero de Calificación

Subtítulo «Solo oportunidades originadas en Leads» bajo los dos encabezados del Bloque B. El Bloque A no lo tiene.

Tarjetas del Bloque B:

| Tarjeta | OUVs en pantalla | Detalle |
|---|---|---|
| Universo | 6 | 6 filas. Montos en `$0` o sin valor. Suma 0 |
| Encima Funnel | 14 | 14 filas. Suma 533.000.000 |
| En Funnel | 0 | Modal: «Sin registros en este periodo.» |
| Mayor Probabilidad | 0 | Tarjeta en 0. El modal respondió «No se pudo cargar el detalle» cuando RDS dejó de resolver (`getaddrinfo ENOTFOUND`) |
| Valor ganado | 0 | Tarjeta en 0. El modal no se reabrió después de esa caída. El `GET .../details` del Paso 2 devolvió `total` 0 |
| Valor perdido | 7 | 7 filas. `$122.000.000` + `$1.800.000.000` y cinco en `$0` = 1.922.000.000 |
| Valor descartado | 0 | Igual que Valor ganado |

Universo (filas): OUV-0388, OUV-0437, OUV-0436, OUV-0429, OUV-0349, OUV-0373.

Valor perdido (filas): OUV-0353 `$122.000.000`, OUV-0346, OUV-0335, OUV-0348, OUV-0345, OUV-0347 en `$0`, OUV-0336 `$1.800.000.000`.

El modal de Encima Funnel, Universo, En Funnel y Valor perdido se abrió en esta verificación. En Funnel quedó en «Sin registros en este periodo.». Mayor Probabilidad llegó a «No se pudo cargar el detalle»: el backend registró `connect ETIMEDOUT` y después `getaddrinfo ENOTFOUND` contra el host de RDS. Valor ganado y Valor descartado no se reabrieron después de esa caída. Sus tarjetas siguen en 0 OUVs y el detalle del Paso 2, contra el mismo endpoint, devolvió `total` 0 y suma 0.

Tema claro: el subtítulo en `text-sm text-muted` mide 14 px y `rgb(138, 141, 152)`, el valor de `--text-muted`. Tema oscuro: `rgb(163, 163, 163)`. Ancho 390 px, menú colapsado: el subtítulo se lee bajo «Pipeline abierto»; Universo `$0` / 6 OUVs y Encima Funnel `$533 M` / 14 OUVs siguen en pantalla. La línea de la meta parte «$3.000» y «M» en dos renglones; es el layout de la dona en estrecho, anterior a este subtítulo.

### Otros tableros (no deben cambiar)

`/opportunities/dashboard`, año 2026, ejecutivo «Todos»:

- Encima Funnel: `$140.035 M · 85` (37 %)
- Perdidas: `91 · $59.722 M`
- Universo: `$1.667 M · 16`
- Ganadas: `26 · $40.061 M`
- 136 OUVs abiertas
- Origen de OUVs nuevas: Directa 184

Esos números son los del corte anterior al filtro (Paso 1), no los 14 y 7 del tablero de Calificación.

`/opportunities`: la bandeja carga después de un «Internal server error» de la base (reintento). La columna Universo incluye OUV-0434, que no está entre las 6 de origen Lead. Hay 81 códigos OUV visibles, por encima de las 20 abiertas de origen Lead (6 + 14).

`/demand/dashboard`, año 2026: OUV convertidas **27** (meta 3, 900 %). `OuvMarketingMetricsService` ya filtraba `desde_sql` y este cambio no lo toca.

### EjecutivoComercial

No hubo sesión de ese rol: no hay contraseña de un ejecutivo en el alcance de esta verificación. El caso del spec (`comercialId` del actor y origen Lead en el mismo `where`) sigue en verde. Queda pendiente la comprobación visual con un usuario `EjecutivoComercial`.
