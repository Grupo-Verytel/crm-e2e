# Spec — Platform: Workflow Engine (Fase A)
**Versión:** 1.1
**Fecha:** 2026-08-05
**Autor:** Evilio Polo (Frisson Technologies / Grupo Verytel)
**Estado:** Pendiente de aprobación para implementación
**Tipo:** Módulo de plataforma (transversal, fuera de los 8 módulos de proceso)
**Depende de:** DR-2026-08 (motor intermedio incremental)
**Consumido por:** Módulo 2 (Calificación) y todos los módulos posteriores

**Changelog v1.0 → v1.1:** ajuste de nombres de campo a la tabla `notifications` real del repo (en inglés). Adopción de `entity_type` como ENUM, `titulo` + `mensaje` separados, `dedup_key` para idempotencia, `estado_anterior`/`estado_nuevo` inferidos por el motor, `actor_user_id` para auditoría inline. Se descartó `push_enviado_at` — la latencia del push se instrumenta vía logs, no en BD.

---

## 1. Propósito

Proveer un componente único y reutilizable que gobierna transiciones de estado entre bandejas del CRM. Reemplaza el polling actual del frontend por push en tiempo real y centraliza las reglas de "quién se entera cuándo" en un registro declarativo único.

**No es** un motor BPMN completo. Ver DR-2026-08 para el razonamiento.

---

## 2. Alcance Fase A

Cubre las 6 transiciones simples del blueprint conocidas hoy:

| # | Evento (`event_type`) | Origen | Destino (rol o usuario) |
|---|---|---|---|
| 1 | `lead.mql_aprobado` | Módulo 1 (Gestor/Director Mercadeo) | Rol SoporteComercial |
| 2 | `sql.creado` | Sistema (WF002) | Rol SoporteComercial |
| 3 | `sql.asignado` | Módulo 2 (Soporte Comercial) | Usuario `comercial_id` |
| 4 | `sql.cita_reagendada` | Módulo 2 (Ejecutivo Comercial) | Rol SoporteComercial (informativo) |
| 5 | `sql.convertido_ouv` | Módulo 2 (Ejecutivo Comercial) | Rol SoporteComercial (informativo) |
| 6 | `sql.descartado` | Módulo 2 (Ejecutivo Comercial) | Rol Director Mercadeo (informativo) |

Cada transición dispara: validación de guards → persistencia de notificación → registro en `audit_log` → push WebSocket post-commit al destinatario.

**Fuera de alcance (Fase B, futuro):**
- Guards que llaman services externos de dominio (validar margen, validar documentación)
- Hooks arbitrarios post-transición para integraciones (ERP, consecutivos)
- Retry automático de push WebSocket
- Timers / workflows de larga duración
- Editor visual de reglas o persistencia en BD

---

## 3. Modelo de datos

### 3.1 Tabla `notifications` (esquema existente en el repo)

Nombres de campo y tipos según la implementación actual. **No se proponen columnas nuevas** — la tabla ya cubre todos los requisitos de Fase A.

| Campo | Tipo | Null | Uso por el motor |
|---|---|---|---|
| `notification_id` | CHAR(36) | NO (PK) | UUID generado por el motor |
| `recipient_user_id` | CHAR(36) | NO (FK users) | Destinatario resuelto por regla (rol expandido o userId) |
| `event_type` | VARCHAR(60) | NO | Nombre canónico del evento (`sql.asignado`, etc.) |
| `entity_type` | ENUM(`LEAD`,`MQL`,`SQL`,`CAMPANA`,`OUV`,`PRE`,`PRI`,`SER`,`FACTURA`) | NO | Tipo de entidad transicionada |
| `entity_id` | CHAR(36) | NO | UUID de la entidad |
| `entity_label` | VARCHAR(160) | NO | Snapshot del nombre para render sin joins (ej. nombre del lead) |
| `estado_anterior` | VARCHAR(40) | YES | **Inferido por el motor** — no viene en el payload |
| `estado_nuevo` | VARCHAR(40) | NO | **Inferido por el motor** — no viene en el payload |
| `titulo` | VARCHAR(160) | NO | Texto corto para el toast (ej. "Nuevo SQL asignado") |
| `mensaje` | VARCHAR(400) | NO | Texto largo para el detalle/panel |
| `actor_user_id` | CHAR(36) | YES (FK users) | Usuario que disparó la transición (auditoría inline) |
| `metadata` | JSON | YES | Datos adicionales para render o link ("ver detalle") |
| `dedup_key` | VARCHAR(180) | YES | Idempotencia — ver sección 3.2 |
| `read_at` | DATETIME | YES | NULL = no leída |
| `created_at` | DATETIME | NO | DEFAULT CURRENT_TIMESTAMP |

Índices ya existentes: `recipient_user_id`, `entity_type`, `actor_user_id`. Sugerido agregar en migración si no existen: índice compuesto `(recipient_user_id, read_at, created_at DESC)` para consulta eficiente de "no leídas del usuario".

### 3.2 Estrategia de `dedup_key`

Formato canónico: `${event_type}:${entity_id}:${recipient_user_id}`

Ejemplo: `sql.asignado:9a3f...:b7c1...`

**Índice UNIQUE parcial** sobre `dedup_key` (donde `dedup_key IS NOT NULL`). Si un guard reintenta o si el motor intenta crear la misma notificación dos veces en la misma transacción, el segundo insert falla con violación de unicidad y el motor lo interpreta como "ya notificado, ignorar" (no propaga el error).

Notificaciones informativas broadcast (Fase B) pueden dejar `dedup_key = NULL` para permitir duplicados intencionales.

### 3.3 Inferencia de `estado_anterior` / `estado_nuevo`

El motor consulta `entity.estado` **antes** de que el service llamador ejecute el `.update()`, guarda ese valor como `estado_anterior`, y usa `entity.estado` post-update como `estado_nuevo`. Los services de dominio **no deben** pasar estos campos en el payload — el motor los infiere.

Esto requiere que el service llamador siga este orden:

```typescript
await this.sequelize.transaction(async (t) => {
  const estadoAnterior = sql.estado;  // capturado antes del update
  await sql.update({ estado: 'Asignado', comercial_id, fecha_asignacion }, { transaction: t });
  await this.workflowEngine.transition('SQL', sql.sql_id, 'sql.asignado', {
    estadoAnterior,      // pasado explícitamente al motor
    payload: { comercial_id, nombre_lead: sql.lead.nombre_empresa, ... }
  }, t);
});
```

O alternativamente (más ergonómico), el motor lee `estado_anterior` directamente:

```typescript
await this.workflowEngine.transition('SQL', sql.sql_id, 'sql.asignado', {
  estadoAnterior: sql.previous('estado'),  // Sequelize helper
  payload: { ... }
}, t);
```

### 3.4 Sin tablas nuevas propias del motor

Las reglas viven en código (`workflow.rules.ts`), no en BD. Decisión documentada en DR-2026-08.

---

## 4. Componentes NestJS

### 4.1 `WorkflowEngineService` (API pública)

Método único consumido por services de dominio:

```typescript
engine.transition(
  entityType: EntityType,   // ENUM tipado — mismo enum de la columna entity_type
  entityId: string,         // UUID
  eventType: string,        // 'sql.asignado'
  context: {
    estadoAnterior: string | null,
    estadoNuevo: string,
    entityLabel: string,    // para snapshot
    actorUserId: string,    // usuario que dispara
    payload: object,        // datos adicionales para sideEffects
  },
  transaction: Transaction  // transacción Sequelize activa
): Promise<void>
```

Flujo interno:
1. Busca la regla en el registro por `eventType` — si no existe, lanza `WorkflowRuleNotFoundException`
2. Ejecuta guards en orden — si alguno rechaza, lanza `WorkflowGuardRejectedException`
3. Resuelve destinatarios (rol expandido a lista de userIds, o userId específico)
4. Ejecuta `NotificationsPersister` para cada destinatario, insertando en `notifications` con `dedup_key` calculado
5. Registra la transición en `audit_log`
6. Programa hook `afterCommit` de la transacción para disparar push WebSocket a cada destinatario

### 4.2 `WorkflowRulesRegistry` (`workflow.rules.ts`)

Objeto declarativo. Ejemplo con nombres reales:

```typescript
export const workflowRules: WorkflowRule[] = [
  {
    eventType: 'sql.asignado',
    guards: [
      guardEntidadEnEstado('SQL', 'PendienteAsignacion'),
      guardUsuarioTieneRol('SoporteComercial'),
    ],
    destinatarios: [
      { tipo: 'usuario', resolver: (ctx) => ctx.payload.comercial_id },
    ],
    titulo: () => 'Nuevo SQL asignado',
    mensaje: (ctx) => `Se te asignó el SQL de ${ctx.entityLabel}. Revisa tu bandeja.`,
  },
  {
    eventType: 'lead.mql_aprobado',
    guards: [
      guardEntidadEnEstado('LEAD', 'MQL'),
      guardUsuarioTieneRol('DirectorMercadeo'),
    ],
    destinatarios: [
      { tipo: 'rol', resolver: () => 'SoporteComercial' },
    ],
    titulo: () => 'Nuevo MQL aprobado',
    mensaje: (ctx) => `El lead ${ctx.entityLabel} pasó a MQL y requiere enrutamiento.`,
  },
  // ... 4 más para Fase A
];
```

### 4.3 `NotificationsPersister` (listener interno, sync)

Escribe en `notifications` dentro de la transacción activa. Un insert por destinatario resuelto. Maneja violaciones de UNIQUE sobre `dedup_key` como "ya notificado, ignorar" sin propagar error.

### 4.4 `NotificationsGateway` (WebSocket)

- `@nestjs/websockets` con `socket.io`
- Autenticación JWT en `handshake` — reutilizar el guard de JWT ya existente en el proyecto
- Sala por `user_id`: cada cliente se une a `user:{userId}` al conectar
- Método `emitToUser(userId, notification)` invocado desde el hook `afterCommit`
- Endpoint HTTP complementario: `GET /api/v1/notifications?read=false` (fallback + carga inicial al montar la app)

### 4.5 `WorkflowExceptionFilter`

Mapea excepciones del motor a HTTP con estructura estándar:

```json
{
  "statusCode": 422,
  "codigo_error": "WF_GUARD_REJECTED",
  "guard": "guardEntidadEnEstado",
  "detalle": "SQL debe estar en estado PendienteAsignacion, está en Asignado"
}
```

- `WorkflowGuardRejectedException` → HTTP 422
- `WorkflowRuleNotFoundException` → HTTP 500 (bug de configuración)

---

## 5. Criterios EARS

- **EARS-01.** Cuando un service de dominio invoca `engine.transition()`, el motor DEBE ejecutar todos los guards de la regla asociada al `eventType` antes de ejecutar cualquier side effect.

- **EARS-02.** Si algún guard rechaza, el motor DEBE abortar la transición, lanzar `WorkflowGuardRejectedException`, y NO ejecutar ningún side effect. La transacción de negocio DEBE revertirse.

- **EARS-03.** Cuando todos los guards aprueban, el motor DEBE resolver los destinatarios de la regla (expandir rol a lista de userIds o usar userId directo) e insertar una fila en `notifications` por cada destinatario, dentro de la transacción activa.

- **EARS-04.** Cada fila insertada en `notifications` DEBE incluir: `notification_id`, `recipient_user_id`, `event_type`, `entity_type`, `entity_id`, `entity_label`, `estado_anterior`, `estado_nuevo`, `titulo`, `mensaje`, `actor_user_id`, `metadata`, `dedup_key`.

- **EARS-05.** El motor DEBE calcular `dedup_key` como `${event_type}:${entity_id}:${recipient_user_id}`. Si un insert viola el UNIQUE de `dedup_key`, el motor DEBE tratarlo como éxito silencioso (idempotencia).

- **EARS-06.** Toda transición ejecutada DEBE registrarse en `audit_log` con: `actor_user_id`, `entity_type`, `entity_id`, `estado_anterior`, `estado_nuevo`, `event_type`, timestamp.

- **EARS-07.** El push WebSocket DEBE emitirse únicamente en el hook `afterCommit` de la transacción activa. Nunca antes del commit.

- **EARS-08.** Si el commit de la transacción falla, el motor NO DEBE emitir push WebSocket. Las filas de `notifications` insertadas se revierten con la transacción.

- **EARS-09.** El cliente WebSocket DEBE autenticarse con JWT en `handshake`. Conexiones sin JWT válido DEBEN rechazarse.

- **EARS-10.** Al recibir un evento WebSocket, el frontend DEBE:
  - mostrar un toast con `titulo` (mensaje truncado si es largo)
  - incrementar el contador del badge en el ícono de bandeja
  - disparar refresh del listado de la bandeja actualmente visible si el `event_type` aplica a esa vista

- **EARS-11.** El endpoint `GET /api/v1/notifications?read=false` DEBE devolver notificaciones no leídas del usuario autenticado, ordenadas por `created_at DESC`, paginadas.

- **EARS-12.** El endpoint `PATCH /api/v1/notifications/:id/read` DEBE actualizar `read_at = NOW()` solo si `recipient_user_id` coincide con el usuario autenticado.

- **EARS-13.** El registro declarativo `workflowRules` DEBE ser la única fuente de verdad de transiciones. Cualquier service de dominio que quiera transicionar el `estado` de una entidad DEBE hacerlo vía `engine.transition()`. Escribir `entity.estado = ...` fuera del motor viola el patrón (verificable en revisión de PR y por regla Cursor `800-workflow-transitions.mdc`).

---

## 6. Permisos CASL

| Acción | Regla |
|---|---|
| Recibir push WS | Cualquier usuario autenticado, solo a su sala `user:{id}` |
| `GET /notifications?read=false` | Solo el usuario autenticado (siempre filtrado a `recipient_user_id = current`) |
| `PATCH /notifications/:id/read` | Solo si `recipient_user_id = current` |

---

## 7. Frontend (React 19 + Tailwind 4)

Patrones ya verificados en el codebase (`http-client.ts`, sin librerías nuevas). Se agrega dependencia `socket.io-client` (única librería nueva, justificada por el WebSocket).

### 7.1 `NotificationsContext`
Context global (junto al de Auth) con:
- Socket connection lifecycle (conectar en login, desconectar en logout)
- Lista de notificaciones no leídas (fetched al montar + push updates)
- Contador para badge
- Método `marcarLeida(notificationId)` que dispara `PATCH /notifications/:id/read`

### 7.2 `NotificationBadge`
Componente del ícono superior derecho. Muestra número de no leídas. Al hacer clic abre panel/dropdown con la lista.

### 7.3 `NotificationToast`
Se dispara automáticamente al recibir push. Auto-hide 5s. Muestra `titulo` (y `mensaje` truncado si aplica). Implementación simple con `useState` + `useEffect` — sin librería externa.

### 7.4 Refresh de listado por evento
Cuando el usuario está en una bandeja y llega un push cuyo `event_type` coincide con esa vista, el componente refetcha su lista. Se hace vía event listener del context. Ejemplo:

- Usuario en Bandeja de Enrutamiento (`event_type = lead.mql_aprobado` o `sql.creado`) → refetch
- Usuario en su Bandeja Comercial (`event_type = sql.asignado` con `recipient_user_id = current`) → refetch

### 7.5 Eliminar polling
Una vez validado el push en staging por 1 semana, retirar `setInterval` en las bandejas existentes.

---

## 8. Migración desde polling actual

**Fase de coexistencia (~1 sprint):**
- WS activo + polling reducido a cada 60s como safety net
- Instrumentación en logs del gateway: `emitToUser` incluye `notification_id` + timestamp → correlación end-to-end con `created_at` para medir latencia
- Bug reports vía canal Slack `#crm-notif-debug`

**Fase final:**
- Retirar `setInterval` de todas las bandejas
- Retirar endpoint de polling si aplica (o dejarlo solo como fallback manual "recargar")

---

## 9. Casos de prueba iniciales (E2E)

1. Marketing aprueba MQL → Soporte recibe toast + badge + refresh de Bandeja de Enrutamiento
2. Soporte asigna SQL a comercial → comercial recibe toast + badge + refresh de su bandeja
3. Guard rechaza (SQL ya asignado, intento de reasignar) → HTTP 422, sin notificación, sin cambio de estado
4. Commit falla (violación de FK) → sin push WS, `notifications` sin filas huérfanas
5. Cliente desconectado al momento del push → al reconectar, la notificación aparece vía `GET /notifications?read=false`
6. Reintento del mismo evento → segundo insert falla por `dedup_key` UNIQUE, motor lo ignora silenciosamente

---

## 10. Fuera de alcance de Fase A

- Fase B: guards async con services de dominio, hooks arbitrarios (documentado en DR-2026-08)
- Retry queue para push WS fallido
- Notificaciones por email/SMS (Wave 2)
- Preferencias de notificación por usuario (silenciar tipos de evento)
- Notificaciones broadcast (todos los usuarios de un rol simultáneamente por cambio global)
- Métrica de latencia push almacenada en BD (instrumentada solo en logs)
