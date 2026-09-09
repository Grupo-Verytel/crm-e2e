# Modelo destino CRM Frisson (crm-e2e) — guía de migración

Esquema verificado contra MySQL (`crm_e2e`) el 2026-09-09. Sirve para mapear un CRM origen (Pipedrive u otro) hacia este sistema.

**No existe la tabla `opportunities`.** La oportunidad comercial es `ouvs`.  
`commercial_opportunity` es un espejo para MEP: **no la llenes** en la carga de datos.

---

## Cómo migrar (orden de inserción)

1. Mapear dueños a `users.user_id` ya existentes (no crear usuarios a ciegas: hay `password_hash` y roles).
2. Insertar `accounts` (empresa / org).
3. Insertar `people` (contacto; **siempre** con `account_id`).
4. Deals / oportunidades abiertas → **`ouvs` con `origen_via = 'directa'`** y `sql_id_origen = NULL`.  
   No hace falta crear lead → MQL → SQL para importar deals. Ese camino es el operativo del CRM, no el de carga histórica.
5. Contactos del deal → `ouv_contactos` (`person_id` reutilizado; no se copian nombre/email ahí).
6. Opcional: 3 filas de `ouv_influencias` (Economica, Tecnica, Fabrica).

Si el origen es un lead (aún no es deal), el destino es `leads` + `lead_contacts`, no `ouvs`.

```text
users
  └── accounts
        └── people
              ├── lead_contacts → leads → mqls → sqls → ouvs   (funnel operativo)
              └── ouv_contactos → ouvs                         (import de deals)
                    └── ouv_influencias
```

---

## Convenciones

| Regla | Valor |
|---|---|
| Motor | MySQL, utf8mb4 |
| PK | UUID `CHAR(36)` (excepto tablas MEP) |
| Soft-delete | `deleted_at` en accounts / people / leads / sqls. **`ouvs` no es paranoid** |
| ENUM | valores en **español** (nunca traducir Gobierno, D&S, OUV, PRE, PRI, SER, etc.) |
| Reloj en BD | DATETIME en UTC (`timezone: +00:00` en Sequelize) |
| Consecutivo OUV | `OUV-0001`… inmutable; se emite con `MAX+FOR UPDATE` sobre `ouvs.consecutivo` |
| NIT | vive en `accounts.tax_id`, no en la OUV |

---

## 1. `accounts` — empresa

| Columna | Tipo | Null |
|---|---|---|
| `account_id` | char(36) PK | NO |
| `name` | varchar(160) | NO |
| `tax_id` | varchar(20) | YES |
| `economic_sector` | varchar(120) | YES |
| `address` | varchar(255) | YES |
| `website` | varchar(255) | YES |
| `created_at` | datetime | NO |
| `updated_at` | datetime | NO |
| `deleted_at` | datetime | YES |

Índices: `PRIMARY (account_id)`, `idx_accounts_name`, `idx_accounts_tax_id`.  
Unicidad de NIT: **en servicio**, no UNIQUE en MySQL (chocaría con soft-delete).

---

## 2. `people` — persona (obligatoria a una cuenta)

| Columna | Tipo | Null |
|---|---|---|
| `person_id` | char(36) PK | NO |
| `name` | varchar(120) | NO |
| `job_title` | varchar(80) | YES |
| `email` | varchar(180) | YES |
| `phone` | varchar(20) | YES |
| `account_id` | char(36) FK → `accounts.account_id` | **NO** |
| `influence_type` | enum('Economica','Tecnica','Fabrica') | YES |
| `created_at` | datetime | NO |
| `updated_at` | datetime | NO |
| `deleted_at` | datetime | YES |

Todos los contactos de un mismo lead/OUV deben compartir el mismo `account_id`.

---

## 3. `ouvs` — oportunidad (esto sustituye a “opportunities”)

| Columna | Tipo | Null | Notas |
|---|---|---|---|
| `ouv_id` | char(36) PK | NO | UUID nuevo |
| `consecutivo` | varchar(20) UNI | NO | `OUV-0001`, `OUV-0002`, … |
| `sql_id_origen` | char(36) UNI → `sqls.sql_id` | YES | NULL en import directo |
| `origen_via` | enum('desde_sql','directa') | NO | **`directa` en migración** |
| `comercial_id` | char(36) FK → `users.user_id` | NO | dueño comercial |
| `account_id` | char(36) FK → `accounts.account_id` | YES | poblar siempre que se pueda |
| `titulo` | varchar(200) | NO | |
| `empresa_nombre` | varchar(200) | NO | snapshot de `accounts.name` |
| `descripcion` | text | YES | |
| `city` | varchar(80) | YES | |
| `region` | varchar(60) | YES | |
| `segmento` | enum('Gobierno','D&S','ProyectosEspeciales','B2B') | NO | ENUM legado; coexisten FKs |
| `segment_id` | char(36) FK → `segments.id` | YES | |
| `subsegment_id` | char(36) FK → `subsegments.id` | YES | |
| `vertical` | varchar(80) | NO | ver catálogo abajo |
| `zona_actual` | enum('UNIVERSO','ENCIMA_FUNNEL','EN_FUNNEL','MAYOR_PROBABILIDAD') | NO | default `UNIVERSO` |
| `resultado` | enum('EnCurso','Ganada','Perdida','Descartada') | NO | default `EnCurso` |
| `tiene_gap` | tinyint(1) | NO | default 0 |
| `criterios_faltantes` | json | YES | |
| `presupuesto_confirmado` | tinyint(1) | NO | default 0 |
| `presupuesto_monto` | decimal(18,2) | YES | |
| `presupuesto_moneda` | enum('COP','USD') | YES | |
| `presupuesto_fecha_captura` | datetime | YES | |
| `presupuesto_fuente` | enum('cliente_declaro','contrato_previo','licitacion_publicada','estimacion_comercial','sin_verificar') | YES | |
| `motivo_id` | char(36) | YES | sin FK; apunta a motivos_perdida o motivos_descarte |
| `motivo_snapshot` | varchar(200) | YES | |
| `motivo_detalle` | text | YES | |
| `competidor_ganador` | varchar(200) | YES | |
| `monto_final` | decimal(18,2) | YES | |
| `moneda_final` | enum('COP','USD') | YES | |
| `monto_estimado_perdido` | decimal(18,2) | YES | |
| `fecha_cierre` | datetime | YES | |
| `project_type` | enum('Recurrente','No recurrente') | YES | existe en MySQL; no está en el código/migraciones del repo |
| `execution_term_months` | int unsigned | YES | idem |
| `close_probability` | tinyint unsigned | YES | idem |
| `created_at` | datetime | NO | DEFAULT CURRENT_TIMESTAMP |
| `updated_at` | datetime | NO | ON UPDATE CURRENT_TIMESTAMP |

**Verticales válidas (VARCHAR, validadas en DTO):** Seguridad Ciudadana, Defensa, Telecomunicaciones, Smart Cities, Infraestructura Crítica, Educación, Salud, Otros.

### Mapa típico Pipedrive / otro CRM → `ouvs`

| Origen | Destino |
|---|---|
| org / company | `accounts` |
| person | `people` (`account_id` de la org) |
| deal title | `ouvs.titulo` |
| org name | `ouvs.empresa_nombre` + `accounts.name` |
| owner | `ouvs.comercial_id` |
| value | `presupuesto_monto` + `presupuesto_moneda` |
| stage abierta | `resultado=EnCurso`, `zona_actual=UNIVERSO` |
| won / lost | `Ganada` / `Perdida` + `fecha_cierre` |

---

## 4. Puentes de contacto

### `ouv_contactos`

| Columna | Tipo | Null |
|---|---|---|
| `contacto_ouv_id` | char(36) PK | NO |
| `ouv_id` | char(36) FK → `ouvs.ouv_id` | NO |
| `person_id` | char(36) FK → `people.person_id` | NO |
| `notas` | text | YES |
| `created_at` / `updated_at` | datetime | NO |
| `deleted_at` | datetime | YES |

### `lead_contacts`

| Columna | Tipo | Null |
|---|---|---|
| `contact_id` | char(36) PK | NO |
| `lead_id` | char(36) FK → `leads.lead_id` | NO |
| `person_id` | char(36) FK → `people.person_id` | NO |
| `position` | tinyint unsigned | NO | UNIQUE (`lead_id`,`position`) |
| `tipo_influencia` | enum('Economica','Tecnica','Fabrica') | YES |
| `created_at` / `updated_at` | datetime | NO |
| `deleted_at` | datetime | YES |

No dupliques email/teléfono en estos puentes: están en `people`.

### `ouv_influencias` (opcional en la carga)

| Columna | Tipo | Null |
|---|---|---|
| `influencia_id` | char(36) PK | NO |
| `ouv_id` | char(36) FK → `ouvs.ouv_id` | NO |
| `tipo` | enum('Economica','Tecnica','Fabrica') | NO | UNIQUE (`ouv_id`,`tipo`) |
| `estado` | enum('Verde','Rojo','Amarillo','SinEvaluar') | NO | default `SinEvaluar` |
| `contacto_ouv_id` | char(36) FK → `ouv_contactos.contacto_ouv_id` | YES |
| `notas` / `motivo_estado` | text | YES |
| `fecha_ultimo_cambio` | datetime | YES |
| `created_at` | datetime | NO |

Para avanzar de zona hace falta al menos 2 influencias en `Verde` con contacto asignado.

---

## 5. Funnel completo (solo si también migran leads)

Cadena: `leads` → `lead_checklist` → `mqls` (1:1 lead) → `sqls` (1:1 mql) → `ouvs.sql_id_origen`.

### `leads` — campos obligatorios

`tipo_lead`, `origen`, `canal_origen`, `segmento`, `region`, `pais`, `responsable_id`, `created_by`.

| Columna | Tipo | Null |
|---|---|---|
| `lead_id` | char(36) PK | NO |
| `name` | varchar(160) | YES |
| `tipo_lead` | enum('Inbound','Outbound','Referido','Aliado','Licitacion') | NO |
| `origen` | enum('Web','Email','LinkedIn','Evento','SECOP','Aliado','Otro','Referido') | NO |
| `sub_origen` | varchar(80) | YES |
| `campana_id` | char(36) FK → `campaigns.campana_id` | YES |
| `segmento` | enum('Gobierno','D&S','ProyectosEspeciales','B2B') | NO |
| `industria` | varchar(80) | YES |
| `region` | varchar(60) | NO |
| `pais` | char(2) | NO |
| `nit` | varchar(20) | YES | legado; el match usa `accounts.tax_id` |
| `tipo_influencia` | enum('Coach','Tecnica','Economica','Usuaria','DeFabrica') | YES |
| `estado` | enum('Nuevo','TOFU','MOFU','MQL_PENDING','SQL','Reciclaje','Descartado') | NO | default `Nuevo` |
| `icp_score` / `lead_score` / `mql_score` / `sql_score` | smallint | YES |
| `responsable_id` | char(36) FK → `users.user_id` | NO |
| `motivo_descarte` | text | YES |
| `utm_source` / `utm_medium` / `utm_campaign` | varchar(120) | YES |
| `fecha_captura` | datetime | NO |
| `created_by` | char(36) FK → `users.user_id` | NO |
| `fecha_ultima_interaccion` | datetime | YES |
| `canal_origen` | enum('CAMPANA_DIGITAL','BTL','FABRICA','GENERACION_DEMANDA_AGENCIA','TRADUCTOR_NEGOCIO','EVENTOS') | NO |
| `cita_agendada` | tinyint(1) | NO | default 0 |
| `fecha_cita` | datetime | YES |
| `cita_lugar` | varchar(200) | YES |
| `cita_contacto_nombre` / `cita_contacto_email` / `cita_contacto_telefono` | | YES |
| `cita_contactos` | json | YES |
| `comercial_asignado_id` | char(36) FK → `users.user_id` | YES |
| `business_referrer_id` | char(36) FK → `users.user_id` | YES |
| `segment_id` / `subsegment_id` | char(36) | YES |
| `city` | varchar(80) | YES |
| `created_at` / `updated_at` | datetime | NO |
| `deleted_at` | datetime | YES |

### `sqls`

| Columna | Tipo | Null |
|---|---|---|
| `sql_id` | char(36) PK | NO |
| `mql_id` | char(36) UNI → `mqls.mql_id` | NO |
| `estado` | enum('PendienteAsignacion','Asignado','EnGestion','ConvertidoOUV','Backlog','Descartado') | NO | default `PendienteAsignacion` |
| `en_backlog` | tinyint(1) | NO | default 1 |
| `comercial_asignado_id` | char(36) FK → `users.user_id` | YES |
| `fecha_creacion` / `fecha_asignacion` | datetime | YES/NO |
| `ouv_id` | char(36) UNI → `ouvs.ouv_id` | YES |
| `origen_creacion` | enum('enrutamiento_normal','directo_comercial') | NO | default `enrutamiento_normal` |
| `deleted_at` | datetime | YES |

`sql_citas` es 1:1 con SQL (`sql_id` UNIQUE). No es necesaria para importar deals históricos.

---

## 6. Catálogos de apoyo

### `segments` / `subsegments`

- `segments`: `id` char(36), `name` varchar(120), `active` tinyint(1), timestamps, `deleted_at`.
- `subsegments`: `id`, `segment_id` FK, `name`, `active`, timestamps, `deleted_at`.

`leads.segmento` y `ouvs.segmento` (ENUM) coexisten con estas FKs hasta la migración de datos de segmentos.

### `users` (solo lectura / mapeo)

`user_id` char(36), `email` varchar(180) UNIQUE, `full_name` varchar(120), `role_id`, `is_active`, `deleted_at`.  
No insertar usuarios desde la migración de deals salvo acuerdo explícito.

Roles vigentes (nombre en código): `EjecutivoComercial`, `SoporteComercial`, `ProductManager`, `TraductorDeNegocio`. No existe `DirectorComercial`.

---

## 7. No tocar en la carga

- `commercial_opportunity` (espejo MEP; `crm_opportunity_ref` = `ouvs.consecutivo`)
- `commercial_interaction`, `processing_receipt`, `mep_*`
- `kickoffs`, `won_sales*`
- `audit_log`, `SequelizeMeta`

---

## 8. Tablas existentes en MySQL (inventario)

`SequelizeMeta`, `accounts`, `audit_log`, `campaigns`, `commercial_interaction`, `commercial_opportunity`, `idempotency_record`, `in_app_notifications`, `interaction_requested_service`, `interactions`, `kickoff_approvals`, `kickoff_invitees`, `kickoffs`, `lead_checklist`, `lead_contacts`, `leads`, `mep_api_key`, `mep_audit_log`, `mep_deliverable`, `mep_response`, `mep_response_version`, `mep_service_result`, `motivos_descarte`, `motivos_perdida`, `mqls`, `notifications`, `ouv_checklist_items`, `ouv_contactos`, `ouv_influencias`, `ouvs`, `people`, `processing_receipt`, `project_status_events`, `refresh_tokens`, `roles`, `roles_backup`, `segments`, `sql_citas`, `sqls`, `status_history`, `subsegments`, `user_roles`, `users`, `views`, `won_sale_alerts`, `won_sale_history`, `won_sale_members`, `won_sale_validations`, `won_sales`, `zona_checklist_templates`.

---

Para mapear **org + contactos + deals**, con las secciones 1–4 alcanza.  
Si también traen el embudo (leads vs deals), usar la sección 5.
