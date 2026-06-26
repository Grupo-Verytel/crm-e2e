# Spec — Módulo Auditoría (audit_log)

**Módulo:** `audit` (plataforma) · **Sprint:** 1 · **Estado:** listo para construir
**Stack:** NestJS + Sequelize (hooks) + MySQL
**Principio rector:** *toda* escritura del sistema queda auditada de forma central y automática,
sin que cada módulo programe su propio registro.

> Notación EARS. Cada criterio tiene id (EARS-AUDIT-##) y al menos un test.

---

## 1. Propósito y alcance
Garantizar trazabilidad completa: quién hizo qué, cuándo y con qué cambio. Es requisito de compliance
(segmentos Gobierno/D&S) y la base del requisito "Historial completo de cambios" del CRM.

**En alcance:** registro automático de create/update/delete sobre tablas de negocio; registro de eventos
de seguridad (LOGIN, EXPORT, STATE_CHANGE); API de consulta de auditoría (solo lectura, solo Admin).
**Fuera de alcance:** dashboards de auditoría (Ola 2), retención/archivado a largo plazo (decisión posterior).

---

## 2. Entidad `audit_log` (Blueprint 2.17)
| Campo | Tipo | Regla |
|---|---|---|
| audit_id | CHAR(36) PK | UUID v4 |
| tabla | VARCHAR(60) | tabla afectada |
| registro_id | CHAR(36) | PK del registro afectado |
| accion | ENUM | INSERT \| UPDATE \| DELETE \| STATE_CHANGE \| LOGIN \| EXPORT |
| campo_modificado | VARCHAR(80) NULL | si aplica UPDATE |
| valor_anterior | TEXT NULL | JSON serializado |
| valor_nuevo | TEXT NULL | JSON serializado |
| usuario_id | CHAR(36) FK→users | actor |
| ip_address | VARCHAR(45) | IPv4/IPv6 |
| user_agent | TEXT NULL | — |
| timestamp | TIMESTAMP | UTC, default now |
| contexto | JSON NULL | metadata adicional |

`audit_log` es **append-only**: no se actualiza ni se borra.

---

## 3. Requisitos EARS

### Registro automático
- **EARS-AUDIT-01 (Ubiquitous):** El sistema deberá registrar en `audit_log` toda operación create, update y
  delete sobre cualquier tabla de negocio, mediante hooks de Sequelize centralizados (`afterCreate`,
  `afterUpdate`, `afterDestroy`), sin requerir código de auditoría en los servicios de cada módulo.
- **EARS-AUDIT-02 (Event):** Cuando se crea un registro, el sistema deberá guardar accion=INSERT con `valor_nuevo`
  (estado del registro) y `valor_anterior` nulo.
- **EARS-AUDIT-03 (Event):** Cuando se actualiza un registro, el sistema deberá guardar accion=UPDATE con el diff:
  `campo_modificado`, `valor_anterior` y `valor_nuevo` por cada campo cambiado.
- **EARS-AUDIT-04 (Event):** Cuando se elimina (soft-delete) un registro, el sistema deberá guardar accion=DELETE
  con `valor_anterior`.

### Contexto del actor
- **EARS-AUDIT-05 (Ubiquitous):** El sistema deberá poblar `usuario_id`, `ip_address` y `user_agent` a partir del
  contexto de la petición autenticada (interceptor NestJS), en cada entrada de auditoría.
- **EARS-AUDIT-06 (Unwanted):** Si una escritura ocurre sin contexto de usuario (p. ej. proceso del sistema),
  entonces el sistema deberá registrar `usuario_id` como el actor de sistema designado, nunca dejarlo nulo.

### Eventos de seguridad y estado
- **EARS-AUDIT-07 (Event):** Cuando un usuario inicia sesión, el sistema deberá registrar accion=LOGIN.
- **EARS-AUDIT-08 (Event):** Cuando una entidad con máquina de estados cambia de estado (LEAD, OUV, PRE, SER,
  PRICING, FACTURA), el sistema deberá registrar accion=STATE_CHANGE con estado anterior y nuevo.
- **EARS-AUDIT-09 (Event):** Cuando un usuario exporta datos, el sistema deberá registrar accion=EXPORT.

### Inmutabilidad e integridad
- **EARS-AUDIT-10 (Ubiquitous):** El sistema deberá tratar `audit_log` como append-only: no deberá exponer
  endpoints ni operaciones de update o delete sobre la auditoría.
- **EARS-AUDIT-11 (Unwanted):** Si algún servicio intenta escribir manualmente en `audit_log` (fuera del mecanismo
  central de hooks/interceptor), entonces esa práctica deberá rechazarse en revisión (regla de arquitectura).

### Consulta
- **EARS-AUDIT-12 (State):** Mientras el actor no tenga rol Admin, el sistema deberá impedir el acceso a
  `GET /api/v1/audit-log` y responder 403.
- **EARS-AUDIT-13 (Event):** Cuando un Admin consulta la auditoría, el sistema deberá permitir filtrar por `tabla`,
  `registro_id`, `usuario_id`, `accion` y rango de fechas, con paginación.

---

## 4. Endpoint REST
| Método | Ruta | Acción | Rol |
|---|---|---|---|
| GET | /api/v1/audit-log | consultar (filtros + paginación) | Admin |

## 5. Definition of Done
- Modelo `audit_log` + migración.
- Hooks de Sequelize globales + interceptor de contexto de usuario funcionando.
- Una prueba que demuestre que un create/update/delete en CUALQUIER módulo genera su entrada sin código extra.
- LOGIN y STATE_CHANGE registrados.
- Endpoint de consulta protegido (solo Admin) con filtros.
- Todos los criterios EARS-AUDIT-## con test que pasa.
