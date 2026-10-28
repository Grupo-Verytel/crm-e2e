# 2026-10-28 — Reportes de comité y salud del pipeline

Estado: aplicada en EP-Feature-Reportes (2026-10-28), paso 2B.1b.

Universo provisional hasta respuesta de negocio: entran las OUVs de `origen_via = directa` (Pipedrive y altas directas) y no se filtra `ouv_type`.

## D1 — Permiso

Sujeto CASL `CommercialReport`, acción `read`. Roles: `Admin`, `SoporteComercial` y `Gerente Comercial`. Ningún otro rol.

## D2 — Universo

El mismo corte provisional del tablero de OUVs. Incluye Pipedrive y no excluye por `ouv_type`. Queda así hasta que negocio responda.

## D3 — Unidad y calendario

La unidad de negocio es `ouvs.segmento`. Los periodos salen de `verytel-quarter.ts`. Las fechas de negocio se interpretan en America/Bogota.

## D4 — Moneda

Todo el reporte está en COP. No se convierte. Una OUV en USD no se descarta; en esta base hay cero USD.

## D5 — Último comité

`fecha_corte` es un query param. Si no viene, el servidor usa hoy menos 7 días en America/Bogota. No hay entidad Comité.

## D6 — Monto del cambio de etapa

M035 usa el monto actual de la OUV, no el monto del momento del cambio.

## D7 — Historiales

El cambio de etapa sale de `status_history` con `entity_type = 'OUV'`. Se excluye `metadata.synthetic_entry`. El cambio de monto sale de `audit_log` (`tabla = 'ouvs'`, campos `presupuesto_monto` y `monto_final`). Ese historial está incompleto para OUVs importadas.

## D8 — Abierta

Abierta es `isDashboardOpen`: `resultado = 'EnCurso'`. Se reutilizan los predicados de `ouv-dashboard-metrics.ts`. `GET /discovery/ouv-dashboard` y su detalle no se modifican.

## D9 — Cómo se otorga el permiso

`Admin` y `SoporteComercial` lo reciben en `buildPermissions` y en la migración `20261028170000-commercial-report-permissions.js`. `Gerente Comercial` no está en `buildPermissions` ni en `BASE_ROLES`. Lo recibe solo la migración `20261028170100-gerente-comercial-commercial-report.js`, que busca el nombre exacto `Gerente Comercial`, avisa y no crea el rol si la fila no existe. Las dos migraciones son idempotentes. `down` quita únicamente `read` sobre `CommercialReport`.

Riesgo: el acceso de `Gerente Comercial` depende de la migración B. Un ambiente donde esa migración no corrió deja al Gerente sin el reporte aunque el código ya esté desplegado. El JWT que ya tenía la sesión no incluye la regla nueva hasta el próximo inicio de sesión.

Checklist de despliegue, en certification y en producción:

1. Correr `20261028170000-commercial-report-permissions.js`.
2. Correr `20261028170100-gerente-comercial-commercial-report.js`.
3. Pedir a Admin, Soporte Comercial y Gerente Comercial que cierren sesión y vuelvan a entrar.

## D10 — Clasificación de `status_history`

Avances = `ADVANCE`. Retrocesos = `RETREAT`. Cierres = `WIN`, `LOSS`, `DISCARD`. Reaperturas = `MANUAL`, en un bloque propio. `CREATE` no es un cambio de etapa. `metadata.synthetic_entry === true` se excluye y se cuenta en `excluded_synthetic`.

## D11 — Montos de auditoría

Solo `presupuesto_monto` y `monto_final`. El texto se lee con `JSON.parse` y luego número. El literal JSON `null` es null, no 0. `"0.00"` es 0. `monto_estimado_perdido` no entra.

## D12 — Movilización y ventana

M003 cuenta OUVs distintas y eventos. Cada bloque trae `ouv_count` y `event_count`. «OUVs movilizadas» es el conjunto distinto: una OUV con varios movimientos cuenta una vez, y ese total no es la suma de los bloques. Ganadas y perdidas del comité usan `fecha_cierre` dentro de la ventana, con `isWonInPeriod`, `isLostInPeriod` y `lostAmount`. No usan las filas `WIN` ni `LOSS`.

`status_history.changed_at` es `datetime(3)`. Sequelize escribe con `timezone: '+00:00'`, así que el reloj guardado es UTC. La ventana `[fecha_corte 00:00, día siguiente a hoy 00:00)` de America/Bogota la arman `bogotaDayStartFromYmd` y `addBogotaCalendarDays` de `bogota-day.ts`. El periodo fiscal sale de `verytelFiscalPeriod` en `verytel-quarter.ts`. Un rango `period_from`/`period_to` usa el mismo inicio de día de Bogotá.

## D13 — Sin fecha prevista

M013 tiene la fila «Sin fecha prevista» para las OUVs `EnCurso` con `expected_close_date` NULL, con su propio kind de detalle. Ese conteo no se limita al trimestre.

## M035 — Cifra principal

La cifra principal de avances, retrocesos, cierres, reaperturas y de cada celda `from → to` es la OUV distinta: `ouv_count` y `ouv_amount`. `ouv_amount` suma el monto actual una vez por OUV. Los eventos quedan como dato secundario: `event_count` y `event_amount`. El detalle lista los eventos y repite `ouv_count` y `ouv_amount` en el encabezado.

## Pregunta para negocio

La pregunta abierta está en Pendientes conocidos. El conteo de Q3, con la cifra principal de OUVs distintas, es 3 `Ganada → EnCurso` y 1 `Perdida → EnCurso`. Esos 3 de Ganada reúnen 5 eventos.

## Pendientes conocidos

- Verificación visual con un rol sin `CommercialReport` y con `Gerente Comercial`: pendiente con cuentas de QA. No cambiar contraseñas.
- Pregunta a negocio: 3 OUVs `Ganada → EnCurso` y 1 `Perdida → EnCurso` en Q3.
- Siguiente iteración: Cierres y desempeño (M006, M021, M037, M051, M032) y Cuentas (M011, M050; M052/M053 bloqueadas por FCV).
