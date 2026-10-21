# RESUMEN-PASO-2 — Frontend

**Fecha:** 2026-10-20
**Rama:** `EP-Feature-GerenteComercial`
**Commit de este paso:** no. Espera aprobación.
**Paso 1:** `edfb4fa` `feat(gerente-comercial-ouvs): paso 1 — backend`

## C1 — Límite del Gerente sobre la OUV o el SQL de otro

Archivo: `backend/src/modules/workflow-engine/guards/guard-ejecutivo-o-gerente-asignado.spec.ts`.
El guard de cada evento rechaza a un Gerente Comercial activo cuando el comercial asignado es otro usuario:

- `ouv.avance_zona: active Gerente Comercial on another commercial is rejected`
- `ouv.retroceso_zona: active Gerente Comercial on another commercial is rejected`
- `sql.convertido_ouv: active Gerente Comercial on another commercial is rejected`
- `sql.cita_reagendada: active Gerente Comercial on another commercial is rejected`
- `sql.descartado: active Gerente Comercial on another commercial is rejected`

Gerente inactivo, aunque el payload lo marque como asignado:

- `inactive Gerente Comercial is rejected even when assigned`

Esos seis tests quedaron dentro del commit del Paso 1.

## C2 — Migración en local

`npm run migration:run` aplicó `20261020120000-gerente-comercial-manage-high-value`. Luego `migration:undo` y otra vez `migration:run`. La base local quedó con la regla aplicada.

Antes (30, sin `manage_high_value`):

```
approve|Account
approve|Lead
close|Opportunity
create|Account
create|Opportunity
create|Report
export|Report
read|Account
read|Billing
read|Lead
read|Opportunity
read|Presale
read|Pricing
read|Report
read|Service
read|View:BANDEJA_FACTURACION
read|View:BANDEJA_MQL
read|View:BANDEJA_PMO
read|View:BANDEJA_PREVENTA
read|View:BANDEJA_PRICING
read|View:BANDEJA_SQL
read|View:CAMPANAS_LISTA
read|View:DASHBOARD_MARKETING
read|View:DASHBOARD_VENTAS
read|View:LEADS_LISTA
read|View:OUV_CERRADAS
read|View:PIPELINE_OUV
update|Account
update|Opportunity
update|Report
```

Después del `up` (31). La única regla nueva es `manage_high_value|Account`. El `undo` volvió a las 30 de arriba. El segundo `up` dejó otra vez 31, con la misma regla nueva.

## Inventario de `EjecutivoComercial` en el frontend

Acciones reemplazadas por datos de `/auth/me` (`can_create_direct_ouv` o `can_act_as_assigned_commercial`, y en el registro concreto que el usuario sea el asignado):

| Sitio | Qué hacía | Qué usa ahora |
|---|---|---|
| `OuvsBoardPage.tsx` botón crear | `isEjecutivo` | `can_create_direct_ouv` |
| `OuvDetailPage.tsx` menú de zona, edición y cierre | solo `user_id === comercial_id` | el flag y ser el comercial asignado |
| `InteraccionesPreventaPanel.tsx` registrar, responder y eliminar | el botón se veía siempre | el flag solo puede escribir en la suya; Soporte y Admin siguen viendo los botones |
| `SqlDetailPage.tsx` convertir, cita y registro | `EjecutivoComercial` y ser el asignado | el flag y ser el asignado. Soporte y Admin no cambian |
| `AssignedSqlsPage.tsx` agendar cita en la fila | igual que el detalle | igual |
| `VentaGanadaDetailPage.tsx` editar si es ejecutivo | `role_name !== 'EjecutivoComercial'` o ser el dueño | el flag o ser el dueño. Sin el permiso de venta, el Gerente sigue sin editar |

Quedaron como estaban. No son el botón de crear, zona, convertir, cita o descarte, y moverlas cambiaría otra superficie:

- `frontend/src/modules/discovery/lib/ouv-access.ts` — el corte de la lista sigue excluyendo solo a `EjecutivoComercial`. El Gerente ya puede listar todas.
- `QualificationNav.tsx` — el enlace «OUVs Asignadas» sigue solo para Soporte y Ejecutivo. El corte de esa página no se tocó.
- `LeadsPage.tsx` — el formulario de lead del ejecutivo.
- `ReporteProyectosView.tsx` — filtra el reporte de implementación por el nombre del ejecutivo.
- `SoporteComercialInboxPage.tsx` — solo un comentario.

No hay botón de descartar SQL que compare el rol. La cita de lead tampoco compara `EjecutivoComercial` en la UI. El backend ya valida las dos.

`GET /auth/me` agrega `can_act_as_assigned_commercial` (true para EjecutivoComercial y Gerente Comercial). Ese cambio de backend va en este paso, no en el commit del Paso 1.

## Tablero `/opportunities`

Si `ouv_board_default === 'own'`, draft y applied arrancan con `comercial_id` del usuario. «Todos» sigue siendo el valor vacío y la lista pide `all=true`. «Limpiar» vuelve a ese default, no a Todos.

El párrafo, visible sin abrir el panel:

- sus OUVs: «Estás viendo tus OUVs. Usa el filtro de comercial para ver las de tu equipo.»
- otro comercial: «Estás viendo las OUVs de {nombre}.»
- Todos: «Estás viendo todas las OUVs.»

Soporte y Ejecutivo conservan el estado inicial y los textos de antes.

El selector de `OuvsBoardPage`, `OuvDashboardPage` y `AssignedCommercialFiltersPanel` muestra « (Gerente Comercial)» cuando `role_name` de la opción es ese. `OuvFiltersPanel` usa el mismo texto; hoy ninguna página lo monta.

El CSV usa el filtro aplicado, incluida la búsqueda y el default del Gerente. Sin filtro, exporta lo que el rol puede leer. El CSV de Soporte ahora respeta el filtro de pantalla; sin filtro sigue exportando todas.

Tooltip del checkbox: «Solo Soporte Comercial, Administrador o Gerente Comercial pueden cambiar esta marca.»

## Verificación

`npm run build` en `frontend` terminó en verde (`tsc -b` y Vite).

`eslint` en los archivos nuevos o de cambio acotado no reportó errores. En `OuvsBoardPage.tsx`, `SqlDetailPage.tsx`, `VentaGanadaDetailPage.tsx` y `AccountFormModal.tsx` siguen los avisos previos de `react-hooks/set-state-in-effect` (y, en el modal de cuenta, `no-useless-escape` y `react-hooks/refs`). No están en las líneas de este paso.

No hay herramienta de navegador en esta sesión. El recorrido de abajo es para Evilio.

## Prueba manual

Con Miguel Rico o Dani Rodríguez, después de cerrar sesión y volver a entrar:

1. Entra a `/opportunities` y ve solo sus OUVs, con el texto de ayuda.
2. Cambia a otro comercial y luego a «Todos». «Limpiar» vuelve a sus OUVs.
3. En una OUV propia ve y puede usar avanzar o retroceder zona.
4. En una OUV de otro comercial puede leer la bitácora pero no ve acciones de zona ni puede escribir en la bitácora.
5. Si tiene un SQL asignado, puede convertirlo; en uno ajeno no ve la acción.
6. Puede crear una OUV directa.
7. Puede marcar una cuenta como de alto valor.
8. Exporta el CSV y contiene solo lo filtrado.
9. Como Ejecutivo y como Soporte, todo igual que antes (salvo el CSV de Soporte, que ahora respeta el filtro).
10. Los Gerentes deben cerrar sesión y volver a entrar para recibir los campos nuevos de `/auth/me` y el permiso de alto valor.
