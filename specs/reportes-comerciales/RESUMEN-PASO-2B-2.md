# RESUMEN-PASO-2B-2 — Correcciones 2B.1b y frontend de Reportes

**Fecha:** 2026-10-28
**Rama:** `EP-Feature-Reportes`
**Alcance:** contrato de M035, ventana de M003, decision record y pantalla `/reports`. Sin commit.

`GET /discovery/ouv-dashboard` y su detalle no se tocaron. No hay tablas ni columnas nuevas.

## 1. M035 — OUVs distintas

En avances, retrocesos, cierres, reaperturas y en cada celda, `count` y `amount` pasaron a `event_count` y `event_amount`. Se agregaron `ouv_count` y `ouv_amount`: el monto actual, una vez por OUV.

El detalle sigue listando eventos. `total` y `amount_total` son el conteo y la suma de esos eventos. El encabezado trae además `ouv_count` y `ouv_amount` del conjunto completo, no de la página.

Prueba nueva: una OUV con dos `ADVANCE` en el trimestre queda en `event_count` 2, `event_amount` el doble, `ouv_count` 1 y `ouv_amount` igual a su monto una vez. El detalle de ese kind repite los mismos cuatro números.

## 2. Ventana de M003

`status_history.changed_at` es `datetime(3)`. Sequelize escribe con `timezone: '+00:00'` (`backend/src/config/database.config.ts`), así que el reloj de la columna es UTC. La ventana del comité es `[fecha_corte 00:00, el día siguiente a hoy 00:00)` en America/Bogota. Bogotá es UTC−5 y no tiene horario de verano, así que esa ventana se compara como `changed_at >= T05:00:00.000Z` y `changed_at < T05:00:00.000Z` del día siguiente al `as_of`.

Para `fecha_corte = 2026-10-21` y hoy 2026-10-28, el SQL directo fue:

```sql
SELECT COUNT(*)
FROM status_history h
INNER JOIN ouvs o ON o.ouv_id = h.entity_id
WHERE h.entity_type = 'OUV'
  AND h.`trigger` IN ('ADVANCE', 'RETREAT')
  AND h.changed_at >= '2026-10-21 05:00:00.000'
  AND h.changed_at < '2026-10-29 05:00:00.000'
  AND (sintético JSON boolean true excluido);
```

Resultado: **0**. `m003.zone_changes.event_count` también es **0**. Coinciden. No hubo corrección de código.

Si se comparan los mismos relojes de Bogotá contra la columna sin pasarlos a UTC (`changed_at >= '2026-10-21 00:00:00'` y `< '2026-10-29 00:00:00'`), el conteo sube a 1. Esa fila es un `ADVANCE` `UNIVERSO → ENCIMA_FUNNEL` a las `2026-10-21 03:58:08.297` UTC, o sea el 20 de octubre a las 22:58 en Bogotá, fuera de la ventana. Quedó fuera a propósito.

## 3. Decision record

`specs/decisions/2026-10-28-reportes-comite-salud.md` deja D1–D13, el universo provisional (Pipedrive y `ouv_type` incluidos), la cifra principal de M035, el riesgo de `Gerente Comercial` (la migración B, fuera de `buildPermissions`) y el checklist: correr `20261028170000` y `20261028170100` en certification y producción, y pedir re-inicio de sesión.

Pregunta para negocio: en el Q3 hay 5 eventos `Ganada → EnCurso`. Con la cifra nueva son 3 OUVs distintas (monto actual 2.920.000.000 COP) y una sexta reapertura `Perdida → EnCurso`.

## 4. Cifras Q3 2026, fecha de corte 2026-10-21

M025: 80. M013 sin fecha prevista: 27 OUVs, 6.025.500.000 COP. Salud: 11 OUVs con más de 365 días (10 en 1–2 años, 1 en 2–3, 0 en más de 3). `excluded_synthetic`: 7. OUVs movilizadas: 2, que no es la suma de los bloques (nuevas 1, zona 0, monto 1, ganadas 0, perdidas 0).

M035, monto actual una vez por OUV y, entre paréntesis, eventos:

| Bloque | OUVs | Monto actual | Eventos | Suma de eventos |
|---|---:|---:|---:|---:|
| Avances | 78 | 57.889.200.000 | 100 | 71.727.500.000 |
| Retrocesos | 24 | 51.062.100.000 | 25 | 51.180.100.000 |
| Cierres | 39 | 30.634.700.000 | 43 | 33.331.700.000 |
| Reaperturas | 4 | 3.437.000.000 | 6 | 3.937.000.000 |

Celdas donde la OUV distinta no coincide con el evento: `EN_FUNNEL → MAYOR_PROBABILIDAD` 12 (14), `UNIVERSO → ENCIMA_FUNNEL` 57 (59), `MAYOR_PROBABILIDAD → Ganada` 11 (13), `Ganada → EnCurso` 3 (5). El resto de las celdas tiene el mismo número en las dos cifras.

## 5. Frontend

Ruta `/reports`, dentro de `ProtectedRoute`. La página, además, mira `read` sobre `CommercialReport` en `user.permissions` y no llama al API si no está. El sidebar «Reportes» usa `subjects: ['CommercialReport']`. En el tablero de OUVs hay un enlace a Reportes, sin repetir las métricas del tablero.

Pestañas «Comité comercial» y «Salud del pipeline», al estilo de `DiscoveryNav`. Filtros del tablero más fecha de corte. El trimestre arranca en el trimestre fiscal de hoy.

M035 es la matriz desde → hasta, con la OUV como cifra principal y los eventos entre paréntesis. El rótulo dice «Monto actual de las OUVs, no el del momento del cambio». Las reaperturas tienen bloque propio. M003 muestra OUVs y eventos; el total «OUVs movilizadas» no suma los bloques. La nota de historial incompleto está siempre. `excluded_synthetic` aparece solo si es mayor que 0. M013 tiene la fila «Sin fecha prevista». Salud muestra los tres rangos aunque estén en 0, el corte por segmento, el corte por comercial y la edad promedio por segmento.

Cada cifra abre `ModalShell` con `Pagination`. En M035 el encabezado del modal muestra OUVs y eventos. En el resto, `total` y `amount_total` son la cifra clicada.

## 6. Verificación en el navegador

Sesión ya abierta de Admin (Comercial Plataforma), Q3 2026, fecha de corte 21 de octubre de 2026.

- M025: 80. Sin fecha prevista: 27. Salud: 11, con los tres rangos 10, 1 y 0. Avances: 78 OUVs (100 eventos). La nota de 7 sintéticos se ve. Reaperturas queda visible: 4 OUVs (6 eventos).
- Modal `En Funnel → Mayor Probabilidad`: «12 OUVs · monto actual $14.912 M (14 eventos · suma $16.371 M)». Igual a la celda (12 / 14.911.700.000 y 14 / 16.370.800.000).
- Modal «Sin fecha prevista»: «27 registros · suma $6.026 M». `amount_total` 6.025.500.000. Hay página siguiente.
- Modal «1–2 años»: «10 registros · suma $26.347 M». `amount_total` 26.347.025.210.

El tablero muestra el enlace «Reportes» hacia `/reports`, además del ítem del sidebar.

No se probó un rol sin el permiso: no hay una cuenta de QA con clave conocida y no se cambiaron contraseñas. La página, si el permiso no está, muestra el aviso y no pide datos.

## 7. Build y tests

`npx jest --testPathPatterns commercial-report --no-coverage`: 4 suites, 31 tests, en verde. `npm run build` del backend y `tsc -b` más `vite build` del frontend, en verde. ESLint acotado a los archivos tocados, sin `--fix`, en verde.

El proceso que escuchaba en el puerto 3000 era un `nest start` anterior a este cambio. Se detuvo y se volvió a arrancar para que el API sirva `ouv_count`.

Sin commit.
