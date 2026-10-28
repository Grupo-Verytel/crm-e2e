# 2026-10-28 — OUVs del tablero comercial en COP

Estado: aplicada en el working tree de `EP-Feature-Reportes` (2026-10-28). Sin commit.

## D-MONEDA — Todo COP; el enum USD existe pero no se usa

Regla de negocio: todas las OUVs se tratan como pesos colombianos. `GET /discovery/ouv-dashboard` y `GET /discovery/ouv-dashboard/details` suman `presupuesto_monto`, `monto_final` y el monto perdido sin convertir moneda.

El enum `COP | USD` sigue en `ouvs.presupuesto_moneda` y `ouvs.moneda_final`. El código no lo filtra y no lo borra. Una fila en `USD` entra a la suma igual que una fila en `COP`. Corregir esa fila es un arreglo de dato, no de este tablero.

Consulta de solo lectura del 2026-10-28 contra la base a la que apunta `backend/.env` (`crm_e2e` en `xtam-video-dev.cchfdbjtfv0t.us-east-2.rds.amazonaws.com`): 414 OUVs, cero con `presupuesto_moneda = 'USD'` o `moneda_final = 'USD'`.

No se tocó certification ni producción.
