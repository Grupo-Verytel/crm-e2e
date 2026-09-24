# 2026-09-23 — Interacciones en el detalle de SQL

## Decisión

Las interacciones del detalle de SQL se guardan en la tabla existente `interactions` de Leads. No se crea `sql_interactions`.

- Se agrega `interactions.sql_id` nullable, FK a `sqls.sql_id`, índice, `ON DELETE RESTRICT`. Las filas históricas quedan en NULL.
- No se agrega `lead_id` a `sqls` ni `mql_id` a `interactions`.
- Al registrar desde `POST /qualification/sqls/:id/interactions` el cliente envía solo el cuerpo de la interacción. El backend deriva `lead_id` por `sqls.mql_id` → `mqls.lead_id` y persiste ambos.
- El autor es `responsable_id`, tomado del JWT. No es un responsable seleccionable. No se crea `created_by`. El cliente no puede enviar el autor.
- Etapa de listado: con `sql_id` → `SQL`; sin `sql_id` → `Previa`. El listado es el del lead derivado, más reciente primero, con nombre y rol del autor en la misma consulta.
- Registro permitido solo en `PendienteAsignacion` y `Asignado`. `EnGestion`, `ConvertidoOUV`, `Backlog` y `Descartado` son solo lectura.
- La `fecha` no puede ser anterior a 96 horas del momento del registro (`INTERACTION_MAX_BACKDATE_HOURS`). Es una ventana móvil, no días calendario. Más antigua → 400 `INTERACTION_DATE_TOO_OLD`, sin excepción por rol. Aplica a `POST /leads/:id/interactions` y a `POST /qualification/sqls/:id/interactions`.
- Ese POST no evalúa la máquina de estados del lead ni del MQL. Solo inserta la interacción y actualiza `leads.fecha_ultima_interaccion`, en la misma transacción. `POST /leads/:id/interactions` no cambia.
- `sqls.ouv_id` y las interacciones de OUV quedan fuera. `commercial-interactions` (MEP) no se toca.

## Motivo

Un SQL no tiene `lead_id` propio. La cadena 1:1 `leads` ← `mqls.lead_id` ← `sqls.mql_id` ya es única. Reutilizar `interactions` mantiene el historial previo del lead visible en el SQL.
