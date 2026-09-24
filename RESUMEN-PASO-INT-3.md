# RESUMEN-PASO-INT-3 — Frontend de interacciones SQL

`npx tsc -b` en `frontend` terminó sin errores.

## Qué quedó

- Enrutamiento y SQL asignados / Mis SQL: el nombre abre `/qualification/sqls/:id?from=routing|assigned`. La columna INTERACCIONES muestra el conteo y abre el mismo detalle con `tab=interacciones`. La columna ACCIÓN, Agendar y Reagendar no se movieron.
- Detalle: cabecera `SQL-` + 6 hex (solo visual), empresa y contacto · email. Tabs Detalle / Interacciones. “Volver a enrutamiento”, “Volver a SQL asignados” o “Volver a Mis SQL” según `from`. Sin origen, Soporte vuelve a enrutamiento y el Ejecutivo a Mis SQL.
- El tab Interacciones reutiliza `InteractionTimeline` y `QuickInteractionModal`. Carga, error con reintento, vacío y lista no se muestran juntos. El botón “Registrar interacción” solo aparece en `PendienteAsignacion` y `Asignado` para Soporte, Admin o el Ejecutivo asignado.
- Cada fila muestra fecha, etapa Previa/SQL y “Registrada por {nombre} · {rol}”, o “Sin registro de autor”. La vista de Leads usa el mismo componente.
- Un 403 del Ejecutivo redirige a Mis SQL.
- El tab Detalle sigue con los datos que el API ya entrega (estado, origen, contacto, cita, OUV). No se pintan cita planificada ni estado de reunión.

## Checklist E2E

- [ ] Soporte / Enrutamiento → detalle → registra interacción; conteo se actualiza en la bandeja.
- [ ] Soporte / SQL asignados → detalle → registra; “Volver a SQL asignados”.
- [ ] Ejecutivo / Mis SQL → detalle de su SQL → registra; “Volver a Mis SQL”.
- [ ] Ejecutivo abre por URL un SQL ajeno → 403 y redirección a Mis SQL.
- [ ] La lista muestra interacciones previas del lead con etapa “Previa” y las nuevas con “SQL”.
- [ ] SQL en `ConvertidoOUV`: tab de solo lectura, sin botón.
- [ ] Error de carga: mensaje con reintento, sin el estado vacío al mismo tiempo.
- [ ] Modo claro y oscuro; sin errores de consola.
- [ ] Soporte registra una interacción → aparece “Registrada por {Soporte} · SoporteComercial”.
- [ ] Ejecutivo registra en su SQL → aparece con su nombre y rol.
- [ ] La misma interacción se ve con su autor en la vista de interacciones del Lead.
- [ ] Interacciones históricas sin autor resoluble muestran “Sin registro de autor”.
- [ ] El selector no permite fechas anteriores a 96 horas.
- [ ] Una fecha de hace 5 días enviada al API directamente responde `INTERACTION_DATE_TOO_OLD`.

**STOP.**
