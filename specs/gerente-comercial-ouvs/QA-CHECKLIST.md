# QA — Gerente Comercial en OUVs

Fecha: 2026-10-20. REQ-01 a REQ-13, más C1, C2 y la prueba manual de Evilio. No hubo AJ.

«Manual Evilio» es la prueba que aprobó el Paso 2, incluidos los roles de preventa en la bitácora y la edición de venta ganada del Gerente.

| Req | Cómo se probó | Evidencia | Resultado |
|---|---|---|---|
| REQ-01 | Migración local | C2: la fila pasó de 30 a 31 reglas. La única nueva es `manage_high_value` / `Account`. El `undo` volvió a 30 y el segundo `up` dejó 31 otra vez. No se creó ni se renombró el rol | OK |
| REQ-02 | Test automático y manual Evilio | `ouvs-list-scope.spec.ts`: el Ejecutivo ignora `all` y un `comercial_id` ajeno. Punto 9: la bandeja del Ejecutivo sigue igual | OK |
| REQ-03 | Test automático y manual Evilio | El mismo spec: Soporte conserva `all` y el filtro. Punto 9, con el CSV del punto de Soporte en REQ-12 | OK |
| REQ-04 | Manual Evilio | Punto 1: entra a `/opportunities` y ve solo sus OUVs, con el texto de ayuda | OK |
| REQ-05 | Manual Evilio | Punto 2: otro comercial, luego «Todos». «Limpiar» vuelve a las suyas | OK |
| REQ-06 | Test automático y manual Evilio | El spec del catálogo incluye ambos roles y `role_name`. En pantalla la opción del Gerente lleva el sufijo « (Gerente Comercial)» | OK |
| REQ-07 | Test automático | Catálogo, reasignación y cita: un Gerente activo puede quedar asignado. El spec de SQL deja agendar al Gerente asignado y rechaza al que no lo está | OK |
| REQ-08 | Test automático | `ouvs-list-scope.spec.ts`, caso del Ejecutivo con `all=true` y `comercial_id` de otro | OK |
| REQ-09 | Revisión y manual Evilio | El tab «OUVs Asignadas» y los dos dashboards no recibieron el default «mis OUVs». El selector sí lista gerentes. Queda como deuda de producto, no como fallo | OK |
| REQ-10 | C1 | Los seis tests del límite, abajo. Un Gerente activo sobre la OUV o el SQL de otro recibe el rechazo. Un Gerente inactivo también, aunque el payload lo marque como asignado | OK |
| REQ-11 | Test automático y manual Evilio | `ouv-interacciones.service.spec.ts`: el Gerente lee la bitácora de otra OUV y el alta responde 403. Punto 4 y el punto de preventa | OK |
| REQ-12 | Manual Evilio | Punto 8: el CSV trae solo lo filtrado. El de Soporte ahora respeta el filtro. Sin filtro exporta lo que el rol puede leer | OK |
| REQ-13 | Manual Evilio | Punto 6: el Gerente crea una OUV directa. El botón usa `can_create_direct_ouv` | OK |

## C1 — Seis tests del límite

Archivo: `backend/src/modules/workflow-engine/guards/guard-ejecutivo-o-gerente-asignado.spec.ts`. Van en el commit del Paso 1. La suite del Paso 3 los incluye entre los verdes.

- `ouv.avance_zona: active Gerente Comercial on another commercial is rejected`
- `ouv.retroceso_zona: active Gerente Comercial on another commercial is rejected`
- `sql.convertido_ouv: active Gerente Comercial on another commercial is rejected`
- `sql.cita_reagendada: active Gerente Comercial on another commercial is rejected`
- `sql.descartado: active Gerente Comercial on another commercial is rejected`
- `inactive Gerente Comercial is rejected even when assigned`

## C2 — 30 → 31 reglas

En local, antes de este cierre: 30 reglas, sin `manage_high_value`. Después de `migration:run`: 31, y la única nueva es `manage_high_value|Account`. `migration:undo` volvió a 30. El segundo `migration:run` dejó 31 otra vez.

## Prueba manual de Evilio

1. Entra a `/opportunities` y ve solo sus OUVs, con el texto de ayuda.
2. Cambia a otro comercial y luego a «Todos». «Limpiar» vuelve a sus OUVs.
3. En una OUV propia ve y puede usar avanzar o retroceder zona.
4. En una OUV de otro comercial puede leer la bitácora pero no ve acciones de zona ni puede escribir en la bitácora.
5. Si tiene un SQL asignado, puede convertirlo; en uno ajeno no ve la acción.
6. Puede crear una OUV directa.
7. Puede marcar una cuenta como de alto valor.
8. Exporta el CSV y contiene solo lo filtrado.
9. Como Ejecutivo y como Soporte, todo igual que antes, salvo el CSV de Soporte, que ahora respeta el filtro.
10. Los Gerentes cierran sesión y vuelven a entrar para recibir los campos nuevos de `/auth/me` y el permiso de alto valor.
11. Un rol de preventa sigue viendo los botones de la bitácora como antes.
12. La edición de venta ganada del Gerente quedó como la probó Evilio.

Antes del commit del Paso 2 se revisó el código. En `InteraccionesPreventaPanel.tsx`, `canWrite` es falso solo cuando `can_act_as_assigned_commercial` es verdadero y el usuario no es el `comercial_id`. Preventa, pricing y el resto siguen viendo registrar, responder y eliminar. En `SqlDetailPage.tsx`, convertir, citar y registrar se suman para el Gerente o el Ejecutivo solo si el flag es verdadero y es el asignado. Soporte y Admin conservan su camino. Preventa y pricing no ven esos botones, igual que antes.

## Suite

Backend, `npx jest --forceExit --no-coverage`: `Test Suites: 1 failed, 74 passed, 75 total`. `Tests: 20 failed, 499 passed, 519 total`. Los 20 rojos son `mep-contract-wiring.spec.ts` (`JWT_SECRET`). Deuda previa. El resto está en verde.

Frontend, `npm run build`: `tsc -b && vite build`, 406 módulos, en verde.
