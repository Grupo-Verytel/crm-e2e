# RESUMEN-PASO-CRM-MEPLEAN

**Fecha:** 2026-09-02
**Estado:** backend completado (Fases 0–2 del §14 + `T-402`) — pendiente gate humano
**Spec:** `SPEC-CRM-MEPLEAN_1.md` (`SPEC-CRM-MEPLEAN-001`, contrato `v0.2.0-draft`)
**Contrato versionado:** `openapi/crm-mep.yaml`
**Módulo:** `backend/src/modules/mep-integration/` (ver su `README.md`)

---

## Qué se hizo

### Superficie HTTP — las 6 operaciones bajo `/v1`

| # | Ruta | Scope | Cuota |
|---|---|---|---|
| 1 | `GET /v1/commercial-interactions` | `interactions:read` | `read-list` |
| 2 | `GET /v1/commercial-interactions/{interaction_ref}` | `interactions:read` | `read-item` |
| 3 | `GET /v1/commercial-opportunities/{opportunity_ref}` | `opportunities:read` | `read-item` |
| 4 | `POST .../{interaction_ref}/processing-receipts` | `receipts:write` | `write` |
| 5 | `PUT .../{interaction_ref}/responses/{response_id}` | `responses:write` | `write` |
| 6 | `GET .../{interaction_ref}/responses/{response_id}` | `responses:read` | `read-item` |

El resto del CRM sigue en `api/v1` con JWT + CASL, sin cambios de comportamiento.

### Backend

| Pieza | Detalle |
|---|---|
| Migración | `20260902100000-create-mep-integration-tables.js` — DDL literal del §8/§9.1/§10.1/§12.1 (11 tablas) + triggers append-only + trigger de inmutabilidad de `source_content` |
| Models | 11 modelos Sequelize con los nombres de columna del spec; `preventMutation` en las tres tablas append-only |
| Dominio | `enums` (§3.1), `canonical-json` (JCS RFC 8785), `cursor` (HMAC + TTL 7 d), `etag`, `milestone-machine` (INV-16), `service-dependency` (INV-01), `deliverable-url` (INV-23), `rfc3339` |
| Validación | `mep-validation.pipe` (traduce `class-validator` al catálogo `ERR-*`), `forbidden-properties` (§7.4), `response-semantic.validator`, `receipt-semantic.validator` |
| Seguridad | `ApiKeyService` (sha256+pepper, comparación en tiempo constante, cache 60 s, rotación/revocación), `ApiKeyGuard` (401 genérico / 403 `INSUFFICIENT_SCOPE`) |
| Idempotencia | `IdempotencyService` — reserva `IN_FLIGHT` fuera de la txn, `COMPLETED` dentro; replay sin efectos (INV-28/29) |
| Concurrencia | `SELECT … FOR UPDATE` sobre `mep_response`; ETag del agregado con los dos relojes (ver §Decisiones) |
| Rate limiting | `RateLimitService` token bucket por key × clase + global; `RateLimitGuard` con headers `RateLimit-*` en 2xx y 4xx y `Retry-After` en 429; `ConcurrencyLimitInterceptor` para las 20 in-flight por credencial |
| Auditoría | `MepAuditService` — append-only, encadenada (`prev_hash`→`entry_hash`), en la misma txn que la mutación, con redacción de `source_content`; `AccessAuditService` para `auth.failure`, `ratelimit.block`, `intake.poll`, `opportunity.read`; `verifyChain()` |
| Errores | `MepProblemFilter` + `problem-response` — todo error sale como `application/problem+json` |
| Transversales | `MepRequestMiddleware` (HTTPS/426, 415, `X-Correlation-ID`, HSTS), `mep-body-limit` (256 KB → 413 en `problem+json`) |
| CLI | `npm run mep:key -- issue|revoke` (§10.1, `T-402`) |

### Fixtures y pruebas

Los 19 fixtures del §15.2, completos. 13 suites nuevas / **129 tests**, cada uno
nombrado por su ID de spec (`INV-36`). Suite completa del backend en verde:
**25 suites, 165 tests**; `nest build` y `tsc --noEmit` sin errores; `eslint`
sin errores en el módulo.

Cobertura por ID: `INV-01` … `INV-35`, `TS-INT-06/07/08/11/12`, `TS-OUV-01..05`,
`TS-SVC-01..09`, `TS-MIL-01..09`, `TS-VER-01..10`, `TS-CLS-01..03`,
`TS-RCP-01/03/07`, `TS-IDEM-05/06`, `TS-RL-01/02/03/06/07`, `TS-AUD-06`,
`TS-SEC-01/02/07/11/12`, `TS-LEAN-01/02/03`, `AC-01/14/27/29`.

Incluye `mep-contract-wiring.spec.ts`, que monta la app real (sin BD) y verifica
la ruta base `/v1`, el orden guard → filtro, `problem+json`, los headers
transversales y que `/api/v1/v1/...` no existe.

---

## Fuera de alcance (deliberado)

- **Fase 3 del §14 (`T-301` … `T-305`)** — proyección a la UI del CRM. Es
  frontend; el pedido fue el backend. `AC-10`, `AC-29` (verificación en UI),
  `TS-UI-01` y `TS-VER-08` quedan abiertos.
- **Resto de Fase 4** — `T-401` (plantillas de navegación, bloqueado por
  OPEN-06), `T-403` (export firmado de auditoría; `verifyChain()` sí está),
  `T-404` (dashboards/alertas), `T-405` (colección Bruno/Postman).
- **Pruebas con BD real** — Testcontainers (MySQL 8 + Redis) no está en el
  stack. Los `TS-*` de integración, concurrencia y carga (`TS-CONC-*`,
  `TS-IDEM-01/02/07`, `TS-AUD-01..05/07..10`, `TS-RL-04/05/08/09`) requieren esa
  infraestructura y **no están automatizados**. La lógica que verifican sí está
  implementada.
- **`spectral` / Dredd / Prism / k6 / ZAP** — herramientas de CI no instaladas
  (Artículo IV.3: ninguna dependencia nueva sin decision record).

---

## Decisiones que requieren gate del arquitecto

1. **Conflicto interno del spec sobre `outcome`.** El diccionario del §6.5 dice
   `null` mientras `status ≠ COMPLETED`; el ejemplo real del brief en ese mismo
   §6.5 y el fixture maestro `response-v3` publican `IN_PROGRESS` + `VIABLE`.
   Se implementó la lectura de `TS-SVC-07`: `RECEIVED` exige `null`,
   `COMPLETED` exige valor, `IN_PROGRESS`/`CANCELLED` admiten provisional.
   **Confirmar junto con OPEN-01.**
2. **`INTERACTION_COMPLETED` con servicios cancelados.** Todo servicio debe
   estar en estado terminal; solo los `COMPLETED` exigen entregable. De lo
   contrario una interacción con un servicio cancelado no podría cerrarse.
3. **ETag del agregado de respuesta** = `"{response_id}-{version}-{source_version}"`.
   Es lo que hace verificable `AC-27` / `TS-CONC-02`.
4. **Tres renombres obligados** (Artículo II / IV.3): `audit_log` →
   `mep_audit_log`, `api_key` → `mep_api_key`, y rate limiter en el modo
   *fail-open* local que el propio §11.3 define, por no poder agregar Redis sin
   decision record. Detalle y consecuencias en el README del módulo.
5. **OPEN-02** resuelto provisionalmente como monotónica no consecutiva.
   **OPEN-10** resuelto provisionalmente como `eligible_for_mep`.

---

## Cómo probar

```bash
cd backend

# 1. Migración
npm run migration:run

# 2. Variables nuevas en .env (plantilla en backend/env)
#    MEP_API_ENVIRONMENT, MEP_API_KEY_PEPPER, MEP_CURSOR_SECRET, MEP_REQUIRE_HTTPS

# 3. Emitir la API key (el valor claro se imprime UNA vez)
npm run mep:key -- issue --env sandbox --identity mep-lean --days 90

# 4. Pruebas
npx jest src/modules/mep-integration

# 5. Smoke con la app arriba
curl -i http://localhost:3000/v1/commercial-interactions \
  -H "X-API-Key: <clave emitida>" \
  -H "X-Correlation-ID: corr_01JCRM20004"
```

Los `GRANT` append-only que debe aplicar el DBA por ambiente están en
`backend/src/modules/mep-integration/README.md` §5.
