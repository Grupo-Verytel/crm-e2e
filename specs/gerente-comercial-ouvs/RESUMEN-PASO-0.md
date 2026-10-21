# RESUMEN-PASO-0 — Gerente Comercial en `/opportunities`

**Fecha:** 2026-10-20
**Estado:** aprobado. Q1=A, Q2=B limitado, Q3=B, Q4=A, Q5=A, Q6 nueva.
**Rama:** `EP-Feature-GerenteComercial`, creada desde `EP-Feature-Remember`.

Las respuestas quedaron en el spec v1.0 y en `specs/decisions/2026-10-20-gerente-comercial-rol-existente.md`. Q2 amplía el acceso del rol con aprobación de Evilio: el gerente ejecuta esas transiciones solo sobre la OUV o el SQL que tiene asignados. Q5 también cambia el CSV de Soporte: pasa a respetar el filtro aplicado. El duplicado `GET /discovery/ejecutivos-comerciales` queda en deuda. El rol no entra a `BASE_ROLES` en este cambio; eso se propone en un decision record aparte en el Paso 3.

Spec: `specs/gerente-comercial-ouvs/spec.md`
Decisión D1: `specs/decisions/2026-10-20-gerente-comercial-rol-existente.md`

---

## Hallazgo que manda

El rol **sí existe**, pero no en el código. En la base `crm_e2e` del `backend/.env` la fila es:

| Campo | Valor |
|---|---|
| `role_id` | `c306c9d3-1a8c-470a-8eb3-4c2f80abbaa9` |
| `name` | `Gerente Comercial` (con espacio; no `GerenteComercial`) |
| `description` | null |
| `is_system` | 1 |
| `is_active` | 1 |
| permisos | 30 reglas, listadas abajo |

No está en `BASE_ROLES` (`role-permissions.js:134-183`), ni en migraciones, ni en `spec-auth.md:59-62`, ni en el frontend. El DR `2026-10-18-cuenta-alto-valor.md:23` decía que no existía: era cierto para el catálogo de código. La tabla `roles` de este ambiente lo contradice. Gana el repo (Artículo II). No se crea otro rol y no se renombra este.

Usuarios activos con ese rol: Miguel Rico (`mrico@grupoverytel.com`) y Dani Rodríguez (`drodriguez@grupoverytel.com`).

Otras filas que no son este rol: `Gerente Operaciones`, `Gerente PMO`, `Gerente Preventa`, `Gerente Producto`, `KAM`.

Riesgo: la fila no sale de un seeder. Un ambiente que solo ejecute `BASE_ROLES` no la tiene. Este cambio no la inserta.

---

## 1. Permisos actuales (se conservan)

No tiene `manage_high_value` / `Account`. Sí tiene `approve`, `create`, `read` y `update` sobre `Account`.

| Acción | Sujeto |
|---|---|
| approve, create, read, update | Account |
| read | Billing |
| approve, read | Lead |
| close, create, read, update | Opportunity |
| read | Presale |
| read | Pricing |
| create, export, read, update | Report |
| read | Service |
| read | View:DASHBOARD_MARKETING, View:CAMPANAS_LISTA, View:LEADS_LISTA, View:BANDEJA_MQL, View:BANDEJA_SQL, View:PIPELINE_OUV, View:OUV_CERRADAS, View:DASHBOARD_VENTAS, View:BANDEJA_PREVENTA, View:BANDEJA_PRICING, View:BANDEJA_PMO, View:BANDEJA_FACTURACION |

Los sujetos `View:*` no los lee el sidebar. El menú usa los sujetos de dominio (`frontend/src/lib/navigation.ts:19-31`). Con los permisos de arriba el gerente ya entra a Leads, Calificación, Oportunidades, Preventa, Pricing, Implementación y Empresas. No entra a Contactos (no hay `Person`), Oferta, Posventa, Usuarios ni Auditoría. Ninguna pantalla compara el nombre `Gerente Comercial`.

Para leer todas las OUVs en `GET /discovery/ouvs` ya alcanza: `read Opportunity` y no estar en `OWN_PIPELINE_ROLES`. No hace falta un permiso nuevo para ese alcance.

---

## 2. `ouv-access.ts`

`OWN_PIPELINE_ROLES` = `ejecutivocomercial` (`ouv-access.ts:19`). `canReadAllOuvs` es verdadero para cualquier otro nombre (`:21-22`), incluido `Gerente Comercial` (`ouv-access.spec.ts:12`).

Quién lo usa:

| Lugar | Qué hace si el gerente no está en el set (ya es el caso) |
|---|---|
| `ouvs.controller.ts:73` | Puede mandar `all=true` y filtrar `comercial_id`. |
| `ouvs.service.ts:945` `getDetalle` | Puede abrir el detalle de cualquier OUV. |
| `assigned-ouvs.service.ts:51-53` | El tab «OUVs Asignadas» ya le muestra todas, no solo las suyas. |
| `ouv-dashboard.service.ts:34-36` | El dashboard de discovery ya le muestra el corte completo. |
| `qualification-dashboard.service.ts:49-52` | Misma idea, con su propia copia de la regla (no importa `canReadAllOuvs`). |
| `ouv-interacciones.service.ts:107` | Recordatorios: ya puede leer los de cualquier OUV. |

No se agrega el gerente a `OWN_PIPELINE_ROLES`. Esas cuatro superficies de “ya ve todo” **no** reciben el default «yo». Quedan como están (D4).

`canReadOuv` (`ouv-access.ts:50-56`) es más estrecho: solo `SoporteComercial` y `Admin` leen OUV ajena, además del dueño. Lo usa el listado de interacciones (`ouv-interacciones.service.ts:74`). Un gerente que abre la OUV de otro recibe 403 en esa bitácora. La escritura igual (`:426-429`). No se cambia.

El frontend repite la regla en `frontend/src/modules/discovery/lib/ouv-access.ts:19-21` y la usan `OuvsBoardPage.tsx:78`, `OuvDashboardPage.tsx:28` y `AssignedOuvsPage.tsx:30`.

---

## 3. `GET /discovery/ouvs`

`ListarOuvsQueryDto` acepta `all` (`listar-ouvs-query.dto.ts:68-72`) y `comercial_id` (`:89-92`).

El controller (`ouvs.controller.ts:73-76`) deja `all` en verdadero solo si `canReadAllOuvs` y el query lo pidió. El servicio (`ouvs.service.ts:823-827`): si `all` es falso, filtra por el actor e ignora `comercial_id`; si `all` es verdadero y viene `comercial_id`, filtra por ese id; si `all` es verdadero y no viene `comercial_id`, no filtra dueño.

Hoy el tablero, para quien `canReadAllOuvs`, manda `all=true` y el comercial solo si el filtro aplicado trae id (`OuvsBoardPage.tsx:128-144`). El gerente ya cae en ese grupo, así que **hoy entra viendo todas**. El cambio es el default del cliente, no una regla nueva del servidor.

---

## 4. Consumidores de `ejecutivos-comerciales`

Implementación que usa la UI: `GET /discovery/ouvs/ejecutivos-comerciales` (`ouvs.controller.ts:86-91`, `ouvs.service.ts:905-913`). Solo `EjecutivoComercial` activos. Forma `{ user_id, full_name }`.

Duplicado sin consumidores en el frontend: `GET /discovery/ejecutivos-comerciales` (`discovery-catalogos.controller.ts:19-22`, `catalogos-ouv.service.ts:33-39`).

Frontend, todos vía `fetchEjecutivosComerciales` (`catalogos-api.ts:43-46`):

| Consumidor | Para qué |
|---|---|
| `OuvsBoardPage.tsx:114` | Filtro de `/opportunities`. En alcance. |
| `OuvDashboardPage.tsx:44` | Filtro del dashboard de discovery. Fuera de alcance el corte; la lista de opciones sí crece (D3). |
| `AssignedOuvsPage.tsx:77` | Filtro del tab «OUVs Asignadas». Igual: no se cambia el corte; la lista crece. |

El `<select>` pinta solo `full_name` (`OuvsBoardPage.tsx:379-383` y `OuvFiltersPanel.tsx:63-66`). `OuvFiltersPanel` no lo monta el tablero; el tablero tiene el select inline.

Catálogo distinto, que sí asigna comercial (no es el GET de arriba):

| Endpoint | Consumidor |
|---|---|
| `GET /leads/appointment-commercials` (`leads.controller.ts:129-132`, `demand-generation.service.ts:159-167`) | `AssignSqlModal` y `RescheduleSqlCitaModal` vía `fetchCommercials` (`sqls-api.ts:229-230`). `fetchAppointmentCommercials` (`leads-api.ts:157-160`) no tiene pantalla. |

---

## 5. Validaciones «tiene que ser EjecutivoComercial» para ser el asignado

| Flujo | Código |
|---|---|
| Reasignar OUV (solo Admin) | `ouvs.service.ts:740-747` |
| Asignar SQL | `sqls.service.ts:227-229` y `requireActiveEjecutivo` `:897-910` |
| Cita de un SQL ya asignado | `sqls.service.ts:638-639` (revalida al comercial ya guardado) |
| Cita de lead de agencia | `leads.service.ts:623-633` |

La comparación es exacta (`users.service.ts:57-61`). Hay que aceptar la cadena `Gerente Comercial`.

Guards que exigen que el **actor** sea ejecutivo (no son esta validación; Q2): `workflow.rules.ts:78`, `:91`, `:104`, `:133`, `:145`, `:160`. Con eso, un gerente asignado no convierte el SQL, no reagenda la cita por el motor, no crea la OUV directa por el evento `ouv.creada_directa`, y no avanza ni retrocede zona. Ganar, perder y descartar sí miran solo que sea el dueño (`workflow.rules.ts:233-263`). El botón de crear OUV en el tablero sigue oculto: está atado al nombre `EjecutivoComercial` (`OuvsBoardPage.tsx:342`).

---

## 6. Frontend de `/opportunities`

`OuvsBoardPage.tsx:76-78`: ejecutivo por nombre de rol; soporte si es `SoporteComercial` o `Admin`; `canListAll` = `canReadAllOuvs`. El gerente no es ejecutivo ni soporte, y `canListAll` ya es verdadero, así que el filtro de comercial **ya se muestra**.

Estado inicial: `EMPTY_OUV_FILTERS` (`ouv-filters.ts:8-15`, `OuvsBoardPage.tsx:84-85`). `comercial_id` vacío. Draft y applied se copian al pulsar «Aplicar» (`:233-236`). «Limpiar» vuelve al vacío (`:238-241`).

No hay chip. Hay un párrafo de ayuda (`:276-288`). Para quien lista todas y no es soporte, el texto dice que ve todas las OUVs. El panel de filtros nace cerrado (`filtersOpen` en `:83`), así que el nombre del comercial no se ve hasta abrirlo. REQ-04 usa ese párrafo para decir «mis OUVs» con el nombre, visible al entrar.

El `user_id` y los permisos salen de `useAuth().user`, cargado con `GET /auth/me` (`auth/types.ts:13-21`, `auth-api.ts:23`).

El CSV (`ouv-export.ts:102-114`) pide `all` sin `comercial_id`. Quien puede listar todas exporta el universo, no el filtro de la pantalla. Q5.

---

## 7. Cómo probar (cuando haya código; este paso no lo tiene)

1. Entrar como Miguel Rico o Dani Rodríguez a `/opportunities`: solo sus OUVs y el texto de ayuda con su nombre.
2. Aplicar otro comercial y después «Todos».
3. Entrar como ejecutivo y como soporte: igual que antes.
4. El selector muestra ejecutivos activos y esos dos gerentes; un usuario inactivo de esos roles no sale.
5. Admin reasigna una OUV a uno de los dos y ese gerente la ve en su default.
6. Comparar `roles.permissions` del `role_id` de arriba antes y después: idéntico, salvo Q3.

---

## Riesgos

- El default «yo» es del cliente. Quien llame el API con `all=true` y sin `comercial_id` sigue viendo todas. Es lo que pide D2.
- El tab de asignadas, los dos dashboards y la bitácora ajena no se alinean con el default. Está documentado a propósito.
- Si Q2 queda en A, un gerente puede ser dueño de una OUV y aun así no avanzar zona ni convertir su SQL.
- `roles.is_active = 0` en `EjecutivoComercial` no los excluye hoy. Filtrar por ese flag vaciaría el selector.
- No hay rama de trabajo dedicada. El commit del paso, cuando se apruebe, no debería ir sobre `EP-Feature-Remember` sin que Evilio nombre la base.

---

## Preguntas abiertas

### Q1 — Cómo sabe el frontend que el default es «yo» (R6)

Soporte y gerente pasan los dos `canReadAllOuvs` y los dos tienen `read Opportunity`. Ningún permiso actual significa «entra filtrado por mí».

- **A.** Campo calculado en `GET /auth/me`, sin tocar `roles.permissions`. Propuesta: `ouv_board_default: 'own' | 'all'`. Solo `Gerente Comercial` recibe `own`. El cliente no compara nombres de rol.
- **B.** Permiso CASL nuevo solo en esta fila. Modifica permisos (rompe D1 salvo que se apruebe aquí).
- **C.** El cliente compara `role_name`. Incumple R6.

### Q2 — Guards en los que el actor tiene que ser `EjecutivoComercial`

- **A.** No se tocan. El gerente puede ser el comercial asignado, y no gana convertir SQL, reagendar por el motor, crear OUV directa por workflow, ni avanzar o retroceder zona. Se anota como límite.
- **B.** Esos guards también aceptan `Gerente Comercial`. Amplía lo que el rol puede hacer hoy.

### Q3 — `manage_high_value` / `Account`

Hoy no lo tiene. El DR de cuenta de alto valor lo dejó pendiente.

- **A.** No se agrega. Sigue en deuda.
- **B.** Migración de datos re-ejecutable que inserta solo esa regla en esta fila.

### Q4 — Catálogo y validaciones de SQL y de cita de lead

`GET /leads/appointment-commercials` no es `ejecutivos-comerciales`, y es el que usa la asignación de SQL.

- **A.** Esas validaciones (sección 5) y ese catálogo también aceptan `Gerente Comercial`. El corte del tab de asignadas no cambia.
- **B.** Solo el GET `ejecutivos-comerciales` y la reasignación de OUV. SQL y citas de lead siguen exigiendo `EjecutivoComercial`. REQ-07 queda a medias.

### Q5 — CSV de `/opportunities`

- **A.** El CSV usa el mismo filtro aplicado, incluido el default «yo».
- **B.** Sigue exportando todas las OUVs que el rol puede leer, como hoy.

---

**STOP.** Sin código hasta «APROBADO PASO 0» y las respuestas Q1–Q5.
