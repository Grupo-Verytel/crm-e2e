# Módulo `mep-integration` — Integración CRM Frisson ↔ MEP-LEAN

Implementa `SPEC-CRM-MEPLEAN-001` (contrato `v0.2.0-draft`). El CRM es
**servidor** y expone las 6 operaciones bajo `/v1`. MEP-LEAN es cliente:
hace pull del intake, lee contexto de OUV, acusa recepción técnica y publica
respuestas comerciales versionadas.

Contrato versionado: [`openapi/crm-mep.yaml`](../../../../openapi/crm-mep.yaml).

---

## 1. Dos superficies, dos audiencias

Este módulo expone **dos** conjuntos de rutas que nunca se mezclan:

| | Contrato MEP-LEAN | Proyección al CRM (Fase 3) |
|---|---|---|
| Prefijo | `/v1` | `api/v1` |
| Consumidor | MEP-LEAN (sistema) | La UI del CRM (persona) |
| Autenticación | `X-API-Key` (service account) | JWT + CASL |
| CORS | cerrado, servidor-a-servidor | el del CRM |
| Errores | `application/problem+json` | formato de error del CRM |

**La UI nunca debe consumir `/v1`.** Esa `X-API-Key` es una credencial no
humana (§10.1): en el navegador quedaría expuesta a cualquier usuario, y §10.3
prohíbe abrir CORS sobre esa superficie. Para la UI existe la proyección de la
§4 bis, que lee las mismas tablas con la sesión del usuario comercial.

## 1.1 Contrato MEP-LEAN (`/v1`)

| # | Método/ruta | Scope | Clase de cuota |
|---|---|---|---|
| 1 | `GET /v1/commercial-interactions` | `interactions:read` | `read-list` |
| 2 | `GET /v1/commercial-interactions/{interaction_ref}` | `interactions:read` | `read-item` |
| 3 | `GET /v1/commercial-opportunities/{opportunity_ref}` | `opportunities:read` | `read-item` |
| 4 | `POST /v1/commercial-interactions/{interaction_ref}/processing-receipts` | `receipts:write` | `write` |
| 5 | `PUT /v1/commercial-interactions/{interaction_ref}/responses/{response_id}` | `responses:write` | `write` |
| 6 | `GET /v1/commercial-interactions/{interaction_ref}/responses/{response_id}` | `responses:read` | `read-item` |

El resto del CRM sigue bajo el prefijo `api/v1` con JWT + CASL. La lista de
rutas excluidas del prefijo global vive en
[`mep-contract-routes.ts`](./mep-contract-routes.ts) y es la fuente única de esa
exclusión: **agregar una operación al contrato exige agregarla ahí**, o su ruta
quedaría publicada en `/api/v1/v1/...`.

---

## 2. Puesta en marcha

```bash
# 1. Migración (crea las 11 tablas del §8/§9.1/§10.1/§12.1 + triggers)
npm run migration:run

# 2. Variables de entorno (ver `backend/env`)
#    MEP_API_ENVIRONMENT, MEP_API_KEY_PEPPER, MEP_CURSOR_SECRET, MEP_REQUIRE_HTTPS

# 3. Emitir la API key de servicio — el valor claro se imprime UNA sola vez
npm run mep:key -- issue --env sandbox --identity mep-lean --days 90

# Rotación (§10.1): emitir la nueva ANTES de revocar la anterior;
# ambas quedan activas durante la ventana de solapamiento.
npm run mep:key -- revoke --prefix mep_sandbox
```

---

## 3. Desviaciones respecto del texto del spec

Tres, todas obligadas por la realidad del repo (Artículo II de
`CONSTITUTION.md`) o por su Artículo IV.3. Ninguna cambia el contrato externo.

### 3.1 `audit_log` → `mep_audit_log`

El §12.1 nombra la tabla `audit_log`, pero ese nombre ya está tomado en el CRM
por la auditoría de entidades comerciales, con un esquema incompatible
(`tabla`, `registro_id`, `accion`, `campo_modificado`…). La tabla de esta
integración se llama **`mep_audit_log`** y conserva íntegras las 30 columnas
del §12.1, incluido el encadenamiento `prev_hash` → `entry_hash`.

### 3.2 `api_key` → `mep_api_key`

Mismo motivo: evitar colisión con el módulo Auth/RBAC del CRM. La identidad MEP
es un *service account* no humano, sin usuario nominal ni sesión, así que vive
en su propia tabla en vez de mezclarse con `users`/`roles` (esto también es lo
que OPEN-05 debe cerrar formalmente).

### 3.3 Rate limiter sin Redis

El §11.1 dimensiona el limitador sobre Redis con script Lua. Redis **no** está
en el stack aprobado de `AGENTS.md`, y el Artículo IV.3 de la constitución
prohíbe agregar dependencias sin decision record. El §11.3 ya define el modo de
degradación exigido — *fail-open* con límite local en memoria por instancia más
la alerta `rate_limiter_degraded` — y eso es exactamente lo implementado:
`RateLimitService` emite esa alerta al arrancar y `degraded` devuelve `true`.

**Consecuencia operativa:** con más de una instancia del CRM, las cuotas se
aplican por instancia, no globalmente. Cerrar OPEN-08 (valores definitivos de
cuotas) es buena ocasión para abrir el decision record de Redis; el algoritmo
del token bucket ya está aislado en `RateLimitService`, así que sustituir el
almacenamiento no toca guards ni controladores.

---

## 4. Decisiones de implementación que el spec deja abiertas

### 4.1 ETag del agregado de respuesta (AC-27 / TS-CONC-02)

El ETag de `responses/{response_id}` se calcula en vivo como:

```
"{response_id}-{response_version}-{interaction.source_version}"
```

Incorpora los **dos** relojes que pueden invalidar lo que MEP leyó. Si un
usuario comercial edita la interacción en el CRM entre el `GET` y el `PUT` de
MEP, `source_version` avanza, el `If-Match` que MEP sostiene deja de coincidir y
la escritura recibe `412` sin mutar nada: la edición humana se conserva y MEP
debe releer y reconciliar. Como el mismo valor lo devuelven el `PUT` y el `GET`,
INV-15 se cumple por construcción.

En el `POST .../processing-receipts` el `If-Match` se contrasta contra el ETag
de la **interacción**, que es el recurso que MEP leyó antes de acusar.

### 4.2 `outcome` con `status = IN_PROGRESS` — conflicto interno del spec

El diccionario de campos del §6.5 dice que `outcome` es `null` mientras
`status ≠ COMPLETED`, pero el **ejemplo real del brief** en ese mismo §6.5 —y el
fixture maestro `response-v3` del §15.3— publican `IN_PROGRESS` + `VIABLE`.
`TS-SVC-07`, el único test del spec sobre la regla, acota el rechazo al caso
`status = RECEIVED`.

Se implementó esa lectura:

| `status` | `outcome` |
|---|---|
| `RECEIVED` | debe ser `null` → si no, `422 INVALID_SERVICE_OUTCOME` |
| `IN_PROGRESS` / `CANCELLED` | admite resultado provisional |
| `COMPLETED` | obligatorio no nulo → si falta, `422 INVALID_SERVICE_OUTCOME` |

**Requiere confirmación del arquitecto** junto con OPEN-01.

### 4.3 `INTERACTION_COMPLETED` y servicios cancelados

El §7.1 exige «`service_results` completos con `deliverables`». Se implementó
como: todo servicio debe estar en estado terminal (`COMPLETED` o `CANCELLED`), y
todo servicio `COMPLETED` debe traer al menos un entregable de SharePoint
Documents. Un servicio `CANCELLED` cierra sin entregable pero con `reason_code`
obligatorio — de lo contrario, una interacción con un servicio cancelado no
podría cerrarse nunca.

### 4.4 `response_version` monotónica, no consecutiva (OPEN-02)

Se acepta el salto 2 → 7, conforme a la primera lectura de `TS-VER-04`. Cerrar
OPEN-02 hacia «consecutiva» solo exige endurecer una comparación en
`ResponseSemanticValidator.checkVersionMonotonicity`.

### 4.5 Elegibilidad del intake (OPEN-10)

Hoy el criterio es la bandera explícita `commercial_interaction.eligible_for_mep`.
Cuando se cierre OPEN-10 con la regla de negocio real, el cambio se localiza en
`IntakeService.buildWhere`.

---

## 5. Permisos de BD (append-only)

El §8 exige que el carácter append-only se aplique «por permisos de BD del
usuario de la aplicación, no solo por código». La migración instala triggers
`BEFORE UPDATE` / `BEFORE DELETE` que abortan con `SQLSTATE 45000`, lo que
protege incluso al usuario `root`. Los `GRANT` complementarios, que el DBA debe
aplicar por ambiente, son:

```sql
-- Append-only estricto para el usuario de la aplicación (§8, INV-33)
REVOKE UPDATE, DELETE ON crm_frisson.mep_audit_log        FROM 'crm_app'@'%';
REVOKE UPDATE, DELETE ON crm_frisson.mep_response_version FROM 'crm_app'@'%';
REVOKE UPDATE, DELETE ON crm_frisson.processing_receipt   FROM 'crm_app'@'%';

GRANT INSERT, SELECT ON crm_frisson.mep_audit_log        TO 'crm_app'@'%';
GRANT INSERT, SELECT ON crm_frisson.mep_response_version TO 'crm_app'@'%';
GRANT INSERT, SELECT ON crm_frisson.processing_receipt   TO 'crm_app'@'%';

FLUSH PRIVILEGES;
```

`commercial_interaction.source_content` queda protegido por su propio trigger
(`trg_commercial_interaction_source_content_immutable`, P-07 / INV-07).

---

## 6. Mapa de invariantes → código

| Invariante | Dónde vive |
|---|---|
| `INV-01`, `INV-22` | `domain/service-dependency.ts` |
| `INV-02` | `filters/mep-problem.filter.ts` (no propaga mensajes no clasificados) |
| `INV-03`, `INV-04`, `INV-05` | `services/intake.service.ts` + `domain/cursor.ts` |
| `INV-06`, `INV-07`, `INV-09`, `INV-10`, `INV-15` | `presenters/contract.presenter.ts` |
| `INV-08` | controladores (`ETag` = `etag` del cuerpo) |
| `INV-11` | `services/opportunity.service.ts` (sin verbos de escritura) |
| `INV-12`, `INV-13` | `services/processing-receipt.service.ts` |
| `INV-16` | `domain/milestone-machine.ts` |
| `INV-17` | `services/mep-response.service.ts` (`rc_version` se persiste tal cual) |
| `INV-18`, `INV-20` | `validation/response-semantic.validator.ts` |
| `INV-23` | `domain/deliverable-url.ts` |
| `INV-24`, `INV-25`, `INV-27` | `validation/forbidden-properties.ts` + `validation/mep-validation.pipe.ts` |
| `INV-26` | `models/mep-response.model.ts` + validador semántico |
| `INV-28`, `INV-29` | `services/idempotency.service.ts` |
| `INV-30` | `guards/rate-limit.guard.ts` + `interceptors/concurrency-limit.interceptor.ts` (ambos corren antes de la lógica de negocio) |
| `INV-31` … `INV-34` | `services/mep-audit.service.ts` + migración |
| `INV-35` | `filters/mep-problem.filter.ts` + `services/mep-audit.service.ts` |

---

## 7. Alcance implementado

Fases 0, 1 y 2 del §14 (`T-001` … `T-209`), más `T-402` (emisión/revocación de
key). **Fuera de este módulo:** la Fase 3 (proyección a la UI del CRM,
`T-301` … `T-305`) y el resto de la Fase 4 (dashboards, export firmado de
auditoría, plantillas de navegación) — ver §8 del resumen de ejecución.
