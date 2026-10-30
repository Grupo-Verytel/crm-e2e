# RESUMEN-PASO-2A-2 — Cifra clicable y detalle del tablero

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes` (sin commit, sin push)
**Alcance:** corrección 2A.1b en el backend y la UI de `/opportunities/dashboard`. Sin menú Reportes y sin pantallas nuevas.

## 2A.1b — Un predicado por cifra clicable

`isOpenAt` no se tocó. Sigue en el pipeline, el embudo, `pipeline_by_sector.amount`, `executives.open_count` y `executives.pipeline_amount`.

Se agregó, al lado:

| Campo | Predicado |
|---|---|
| `executives.open_count_now` | `isDashboardOpen` (`EnCurso`) |
| `executives.open_amount_now` | el mismo, suma de `presupuesto_monto` |
| `pipeline_by_sector.open_amount_now` | el mismo, junto al `open_count` que ya existía |

El detalle `open_by_executive` usa ese mismo `isDashboardOpen`. El test `matches each executive open_count_now with the open detail` recorre cada ejecutivo y exige que `open_count_now` sea el `total` del detalle y `open_amount_now` la suma de sus montos.

`GET /discovery/ouv-dashboard/details` ahora devuelve también `amount_total`: la suma de `monto` de todo el conjunto, antes de cortar la página. Sin eso el encabezado del modal, con página de 20, no puede igualar una cifra de 59 o 63 OUVs. `total` sigue siendo el universo del `kind`, no el tamaño de la página.

La decisión quedó en `specs/decisions/2026-10-28-dashboard-ouv-abierta.md`: foto y `EnCurso` conviven; hoy coinciden (0 cierres con fecha futura); las abiertas de `by_segment` son de hoy y las ganadas/perdidas son del periodo; el `findAll` en memoria es deuda si el volumen amenaza los 2 s.

También se quitaron ramas de un kind de perdidas por ejecutivo que no estaba en la lista pedida. El compilador de Nest las rechazaba y el backend no arrancaba.

## 2A.2 — Frontend

Todo vive en discovery. No hay componente global nuevo. El modal es el `ModalShell` de demand-generation y la paginación es `Pagination`. La tabla del detalle es `OuvDashboardDetailTable`, copiada del patrón de calificación y no importada de ese módulo.

- «Resultado por segmento» lee `by_segment`. Columnas: Segmento, Abiertas hoy, Ganadas periodo, Perdidas periodo, Win rate #, Win rate $.
- «Mayor probabilidad por segmento» lee `mayor_probabilidad_by_segment` (`count` y `amount`, los nombres que ya devuelve el API).
- «Tasa de cierre» muestra por cantidad (`rate`) y por monto (`rate_amount`), rotuladas.
- «Desempeño por ejecutivo» agrega Win rate $. La celda clicable de abiertas es `open_count_now` / `open_amount_now`. OUVs y Pipeline siguen siendo la foto y no son botones. Valor ganado abre `won_by_executive`.
- El modal manda año, trimestre o rango, y el `segmento` o `comercial_id` de la celda, más el filtro de ejecutivo o sector que ya tenga el tablero.
- Encabezado: total y suma (`amount_total`). Columnas: Consecutivo (enlace a `/opportunities/:id`), Título, Empresa, Comercial, Segmento, Zona con rótulo, Monto, Fecha de creación o de cierre según `fecha_tipo`.
- Montos con `formatCompactMoney` y tasas con `formatRate`. Tarjetas con `cardClass`.

## Pruebas

`npx jest src/modules/discovery/lib/ouv-dashboard-metrics.spec.ts src/modules/discovery/services/ouv-dashboard.service.spec.ts --no-coverage`

2 suites, 18 tests, todos en verde. Incluyen la igualdad por ejecutivo de `open_count_now` / `open_amount_now` y que `amount_total` del detalle coincide con el agregado.

## Verificación en el navegador

Sesión Admin en `http://localhost:5173/opportunities/dashboard`. Año 2026, trimestre «Todo el año fiscal» (1 feb 2026 – 31 ene 2027).

| Cifra | Tablero | Modal |
|---|---|---|
| Abiertas del pipeline | 147 · $217.957 M | — |
| Gobierno central ganadas | 4 · $921 M | 4 registros · suma $921 M (`921000000`). Fecha de cierre. Zona «Mayor Probabilidad». Consecutivo enlaza a `/opportunities/:id`. |
| Gobierno central perdidas | 46 | se ve en la tabla; no se abrió el modal |
| Mayor probabilidad, Ciudades y gobernaciones | 3 · $7.990 M | 3 registros · suma $7.990 M (`7990100000`). Fecha de creación. Las tres zonas dicen «Mayor Probabilidad». |
| Abiertas hoy, Katherine Arandia Rodriguez | 63 · $57.179 M | 63 registros · suma $57.179 M (`57178500000`). Página 1 muestra 20 filas y solo a Katherine. Página 2 mantiene el mismo total y la misma suma. |

También se ven Defensa 61 abiertas y 38 perdidas, Ciudades 11 ganadas, tasa por cantidad 20% y por monto 38%.

No pude entrar como EjecutivoComercial. Las cuentas de ese rol en `crm_e2e` no aceptan la contraseña inicial del admin (el login de una de ellas respondió 401). No probé otras contraseñas. El corte «solo sus OUVs» queda cubierto por el test de servicio: si el rol es EjecutivoComercial, el `comercial_id` del query se ignora y la consulta usa el id del actor. En el navegador, el modal de Katherine ya muestra únicamente sus OUVs porque el clic manda su `comercial_id`.
