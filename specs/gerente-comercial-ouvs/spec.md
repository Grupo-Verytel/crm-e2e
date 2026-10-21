# Spec — Gerente Comercial en `/opportunities`

**Versión:** 1.0
**Fecha:** 2026-10-20
**Estado:** Aprobado (Paso 0). Q1=A, Q2=B limitado, Q3=B, Q4=A, Q5=A, Q6 nueva.
**Decisión:** `specs/decisions/2026-10-20-gerente-comercial-rol-existente.md`
**Rama:** `EP-Feature-GerenteComercial` (desde `EP-Feature-Remember`).

El nombre de rol en base de datos es `Gerente Comercial` (con espacio). Vive en una sola constante del backend. Ninguna comparación repite ese texto. No se crea ni se renombra la fila. `roles.permissions` solo gana `manage_high_value` / `Account` (Q3=B).

---

## 1. Objetivo

En `/opportunities`, un usuario con rol `Gerente Comercial` entra viendo las OUVs donde él es el comercial asignado, y puede cambiar el filtro a otro comercial o a «Todos». El selector de comerciales incluye activos de `EjecutivoComercial` y de `Gerente Comercial`. Un gerente puede quedar como comercial asignado en los flujos que hoy exigen un ejecutivo, y puede ejecutar sobre sus propias OUVs y SQLs las transiciones cuyos guards hoy exigen `EjecutivoComercial`.

## 2. Alcance

Dentro:

- `GET /api/v1/auth/me`: `ouv_board_default` y `can_create_direct_ouv`.
- Vista por defecto, filtro de comercial, botón de alta directa y CSV de `OuvsBoardPage`.
- `GET /api/v1/discovery/ouvs/ejecutivos-comerciales`.
- `GET /api/v1/leads/appointment-commercials`.
- Validaciones de comercial asignado (sección 6).
- Guards de `workflow.rules.ts` en las líneas citadas, solo si el gerente es el comercial asignado.
- Lectura de la bitácora (`canReadOuv`). La escritura no cambia.
- Migración de datos de `manage_high_value` y el tooltip del checkbox.

Fuera:

- Crear o renombrar la fila de `roles`. Meter el rol en `BASE_ROLES` (deuda, decision record aparte en el Paso 3).
- Meter al gerente en `OWN_PIPELINE_ROLES`.
- El corte por defecto de Ejecutivo y de Soporte en la lista.
- Tab «OUVs Asignadas», dashboard de calificación y dashboard de discovery (D4).
- `GET /api/v1/discovery/ejecutivos-comerciales` (duplicado sin consumidores). Deuda: no se toca.
- Escribir interacciones en una OUV ajena.

## 3. Hecho de acceso que no se reimplementa

`OWN_PIPELINE_ROLES` solo contiene `ejecutivocomercial` (`backend/src/modules/discovery/lib/ouv-access.ts:19`). `canReadAllOuvs` ya es verdadero para este rol (`ouv-access.ts:21-22`). Con `read Opportunity`, `GET /discovery/ouvs` ya acepta `all` y `comercial_id` (`ouvs.controller.ts:73-76`, `ouvs.service.ts:823-827`). El default «yo» lo aplica el cliente con el dato de `/auth/me`.

## 4. Contratos

### 4.1 `GET /api/v1/discovery/ouvs`

Sin cambio de firma. `all` (`listar-ouvs-query.dto.ts:68-72`) y `comercial_id` (`:89-92`).

| Actor | `all` que aplica el controller | `comercial_id` |
|---|---|---|
| `EjecutivoComercial` | Forzado a falso (`ouvs.controller.ts:73-76`). | Se ignora. El `where` es el actor (`ouvs.service.ts:823-824`). |
| Quien `canReadAllOuvs`, incluido `Gerente Comercial` y `SoporteComercial` | Vale el `all` del query. | Solo si `all` quedó verdadero (`ouvs.service.ts:825-826`). |

El gerente ve solo las suyas cuando el cliente envía `all=true` y `comercial_id` = su `user_id`. «Todos» es `all=true` sin `comercial_id`. Otro comercial es `all=true` más ese id.

### 4.2 `GET /api/v1/auth/me` (Q1=A)

Campos nuevos, calculados en el servidor. El cliente no compara nombres de rol.

| Campo | Regla |
|---|---|
| `ouv_board_default` | `'own'` solo si el rol es `Gerente Comercial`. `'all'` para el resto, incluido el ejecutivo. El ejecutivo sigue sin poder usar `all` ni un `comercial_id` ajeno. |
| `can_create_direct_ouv` | Verdadero para `EjecutivoComercial` y para `Gerente Comercial`. El alta directa deja `comercial_id` = actor (`ouvs.service.ts:216`). |

### 4.3 `GET /api/v1/discovery/ouvs/ejecutivos-comerciales` (Q4=A)

Misma forma, más los activos con el rol del gerente. Orden `full_name` ASC. Se excluye `users.is_active = false`. No se filtra `roles.is_active`.

```json
{ "user_id": "...", "full_name": "...", "role_name": "Gerente Comercial" }
```

`role_name` es opcional para los consumidores viejos. El `<option>` sigue mostrando solo `full_name` (`OuvsBoardPage.tsx:379-383`).

`GET /api/v1/leads/appointment-commercials` devuelve el mismo conjunto de personas (con `email`, que ese DTO ya trae).

El duplicado `GET /api/v1/discovery/ejecutivos-comerciales` no se modifica.

### 4.4 Migración `manage_high_value` (Q3=B)

Migración de datos re-ejecutable. Si la fila `Gerente Comercial` no existe, registra el aviso y termina en éxito. Si existe y no tiene la regla, agrega solo `{ action: 'manage_high_value', subject: 'Account' }`. El `down` quita solo esa regla de esa fila y tampoco falla si la fila no está.

Tooltip del checkbox (`AccountFormModal.tsx:45`): «Solo Soporte Comercial, Administrador o Gerente Comercial pueden cambiar esta marca.»

## 5. Requisitos EARS

- **REQ-01 (Ubicuo):** El sistema deberá conservar el rol `Gerente Comercial` con su nombre actual. Esta funcionalidad no crea ni renombra la fila. El único cambio de permisos es `manage_high_value` sobre `Account`.

- **REQ-02 (Estado):** Mientras el usuario sea `EjecutivoComercial`, `/opportunities` deberá seguir mostrando solo las OUVs cuyo `comercial_id` es ese usuario.

- **REQ-03 (Estado):** Mientras el usuario sea `SoporteComercial`, `/opportunities` deberá seguir entrando con el filtro de comercial vacío y mostrando todas las OUVs, y deberá poder acotar por comercial.

- **REQ-04 (Evento):** Cuando un usuario con `ouv_board_default = 'own'` entra a `/opportunities`, el sistema deberá mostrar solo las OUVs cuyo `comercial_id` es ese usuario, y deberá indicarlo con su nombre en el texto de ayuda que ya está sobre la bandeja (`OuvsBoardPage.tsx:276-288`).

- **REQ-05 (Evento):** Cuando ese usuario elige otro comercial o «Todos» y aplica el filtro, el sistema deberá mostrar las OUVs de ese comercial, o todas si eligió «Todos».

- **REQ-06 (Ubicuo):** El selector de comerciales de `/opportunities` y de la asignación de SQL deberá listar usuarios activos con rol `EjecutivoComercial` o `Gerente Comercial`, identificables por `full_name`. `role_name` viaja en la respuesta del GET de OUVs. El `<option>` actual no muestra el rol.

- **REQ-07 (Ubicuo):** Un usuario activo con rol `Gerente Comercial` deberá poder ser el comercial asignado en los flujos de la sección 6.

- **REQ-08 (No deseado):** Si un `EjecutivoComercial` envía `all=true` o un `comercial_id` de otra persona, el servidor deberá seguir ignorándolo y devolver solo las OUVs de ese ejecutivo.

- **REQ-09 (Ubicuo):** El sistema deberá dejar sin cambio de corte el tab «OUVs Asignadas», el dashboard de calificación y el dashboard de discovery. El selector de esos tableros que llama al GET de la sección 4.3 sí incluye gerentes.

- **REQ-10 (Evento):** Cuando un `Gerente Comercial` es el comercial asignado de una OUV o de un SQL, el sistema deberá aceptar en los guards de la sección 7 las mismas transiciones que hoy acepta de un `EjecutivoComercial`. Si no es el asignado, el sistema deberá rechazarlas.

- **REQ-11 (Evento):** Cuando un `Gerente Comercial` abre la bitácora o los recordatorios de cualquier OUV, el sistema deberá devolverlos. Si intenta escribir una interacción en una OUV que no es suya, el sistema deberá responder 403 como hoy (`ouv-interacciones.service.ts:426-429`).

- **REQ-12 (Evento):** Cuando un rol que puede filtrar descarga el CSV de `/opportunities`, el sistema deberá exportar las OUVs del filtro aplicado, incluido el default «yo». Esto también cambia el CSV de Soporte: hoy `ouv-export.ts:102-114` ignora el filtro y exporta todo lo que el rol puede leer.

- **REQ-13 (Ubicuo):** El sistema deberá mostrar el botón de crear OUV a quien tenga `can_create_direct_ouv` en `/auth/me`. El cliente no compara nombres de rol.

Criterio de «Limpiar filtros»: sigue vaciando el comercial (`OuvsBoardPage.tsx:238-241`). Vacío significa «Todos» para quien puede listar todas. El default «yo» solo se aplica al entrar.

## 6. Comercial asignado (REQ-07, Q4=A)

La comparación usa la constante. Acepta activos de `EjecutivoComercial` y de `Gerente Comercial`.

| Flujo | Código |
|---|---|
| Reasignar `ouvs.comercial_id` (solo `Admin`) | `ouvs.service.ts:740-747` |
| Asignar SQL | `sqls.service.ts:227-229` y `requireActiveEjecutivo` `:897-910` |
| Cita de un SQL ya asignado | `sqls.service.ts:638-639` |
| Cita de lead de agencia | `leads.service.ts:623-633` |
| Catálogo de esa asignación | `GET /leads/appointment-commercials` (`leads.controller.ts:129-132`) |

El alta directa no elige otro comercial: el actor queda como dueño. El botón se habilita con `can_create_direct_ouv`.

## 7. Guards de actor (REQ-10, Q2=B limitado)

Sustituyen a `guardUsuarioTieneRol('EjecutivoComercial')` en:

- `sql.cita_reagendada`, `sql.convertido_ouv`, `sql.descartado` (`workflow.rules.ts:78`, `:91`, `:104`) — el asignado es `payload.comercial_asignado_id`
- `ouv.creada_directa`, `ouv.avance_zona`, `ouv.retroceso_zona` (`:133`, `:145`, `:160`) — el asignado es `payload.comercial_id`

Un `EjecutivoComercial` activo sigue pasando como hoy. Un `Gerente Comercial` activo pasa solo si `actorUserId` es ese comercial. No puede actuar sobre OUVs o SQLs de otros. Esta ampliación de acceso queda aprobada por Evilio en el decision record.

`sql.convertido_ouv` y `sql.descartado` no tienen emisor hoy. El guard queda alineado igual. La conversión real sigue siendo `ouv.creada_desde_sql`, que ya exige ser el comercial del SQL.

`ouv.ganada`, `ouv.perdida` y `ouv.descartada` no cambian: solo exigen ser el dueño (`workflow.rules.ts:233-263`).

## 8. Superficies que no cambian de corte (REQ-09)

| Superficie | Se queda así |
|---|---|
| `GET /qualification/assigned-ouvs` | Ya ve todas (`assigned-ouvs.service.ts:51-53`). Sin default «yo». El selector crece porque usa el GET de la sección 4.3. |
| Dashboard de calificación | Corte completo (`qualification-dashboard.service.ts:49-52`). |
| Dashboard de discovery | Corte completo si no manda `comercial_id` (`ouv-dashboard.service.ts:34-36`). El selector crece. |
| Escritura de interacciones ajenas | 403 (`ouv-interacciones.service.ts:426-429`). |

La lectura de interacciones ajenas sí cambia (REQ-11): `canReadOuv` (`ouv-access.ts:50-56`) pasa a permitir al gerente en cualquier OUV. Los recordatorios ya pasaban por `canReadAllOuvs` (`ouv-interacciones.service.ts:107`).

## 9. Criterios de aceptación

1. Un ejecutivo sigue viendo solo sus OUVs aunque mande `all=true` y un `comercial_id` ajeno.
2. Soporte sigue entrando con «Todos» y puede filtrar por comercial. Su CSV respeta el filtro aplicado; sin filtro sigue exportando todas.
3. `/auth/me` del gerente devuelve `ouv_board_default: 'own'` y `can_create_direct_ouv: true`. Soporte devuelve `'all'` y `can_create_direct_ouv: false`. El ejecutivo devuelve `'all'` y `can_create_direct_ouv: true`.
4. El gerente entra con el filtro en su `user_id`. Al elegir otro comercial o «Todos», la lista cambia. Su CSV sigue ese filtro.
5. El GET de comerciales de OUVs y el de citas devuelven activos de los dos roles, ordenados por nombre, y no devuelven inactivos. La respuesta de OUVs incluye `role_name`.
6. Admin puede reasignar una OUV a un gerente activo. Asignar un SQL o una cita de lead a un gerente activo responde 200. Un inactivo o de otro rol sigue en 400.
7. El gerente dueño avanza y retrocede su OUV, crea una OUV directa y reagenda la cita de su SQL. Sobre la OUV o el SQL de otro, esos guards lo rechazan.
8. El gerente lee interacciones y recordatorios de cualquier OUV. No puede escribir una interacción en la OUV de otro.
9. La migración agrega solo `manage_high_value` / `Account`. Si la fila no existe, no falla. `down` quita solo esa regla.
10. El tab de OUVs asignadas y los dos dashboards no cambian su corte por defecto.
