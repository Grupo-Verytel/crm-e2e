---
name: registrar-auditoria
description: Integra el registro append-only en audit_log para cualquier operación CRUD o cambio de estado sensible en el CRM Frisson (creación de OUV, aprobación de MQL, cambios de estado de SER/PRI, login, exportaciones). Úsalo al implementar o modificar cualquier servicio de un módulo que toque datos de negocio, según spec-audit.md.
paths:
  - "backend/src/modules/**/*.service.ts"
  - "backend/src/common/interceptors/**"
---

# Registro de auditoría — CRM Frisson

## Tabla `audit_log` (adaptada a MySQL desde Blueprint V2, Entregable 2.17)

| Campo | Tipo MySQL | Oblig. | Regla |
|---|---|---|---|
| `audit_id` | `CHAR(36)` (UUID) | Sí | PK |
| `tabla` | `VARCHAR(60)` | Sí | Nombre de la tabla afectada (ej. `ouvs`, `mqls`, `pricing`) |
| `registro_id` | `CHAR(36)` (UUID) | Sí | PK del registro afectado |
| `accion` | `ENUM('INSERT','UPDATE','DELETE','STATE_CHANGE','LOGIN','EXPORT')` | Sí | — |
| `campo_modificado` | `VARCHAR(80)` | No | Solo si `accion = UPDATE` o `STATE_CHANGE` |
| `valor_anterior` | `TEXT` | No | Serializado como JSON string |
| `valor_nuevo` | `TEXT` | No | Serializado como JSON string |
| `usuario_id` | `CHAR(36)` (UUID) | Sí | FK `users.user_id` |
| `ip_address` | `VARCHAR(45)` | Sí | Soporta IPv4 e IPv6 (equivalente MySQL de `INET`) |
| `user_agent` | `TEXT` | No | — |
| `timestamp` | `DATETIME` | Sí | `DEFAULT CURRENT_TIMESTAMP` |
| `contexto` | `JSON` | No | Metadata adicional libre |

**Regla dura: `audit_log` es append-only.** Ningún servicio debe hacer `UPDATE` o `DELETE` sobre esta tabla, bajo ninguna circunstancia — ni siquiera para "corregir" un registro mal hecho (eso se corrige con un nuevo registro que lo referencia en `contexto`).

## Cuándo disparar un registro (según Blueprint + spec-audit.md)

Dispara auditoría en:
- Toda creación de entidad de negocio (OUV, PRE, PRI, SER, propuesta, contrato, factura) → `accion: INSERT`
- Todo cambio de campo relevante en una actualización → `accion: UPDATE` con `campo_modificado`
- Toda transición de estado (`ouv.estado`, `mql.estado`, `pricing.estado`, `servicio.estado`, etc.) → `accion: STATE_CHANGE`, ejemplo real del Blueprint: cuando el Director aprueba un MQL (WF002) o cuando se hace cierre de OUV (`ouv.estado = Ganada`)
- Login de usuario → `accion: LOGIN`
- Exportaciones de datos (CSV, reportes) → `accion: EXPORT`

No audites lecturas (`GET`) ni cálculos derivados que no persisten (ej. un preview de `precio_piso` antes de guardar).

## Implementación recomendada: `AuditService` inyectable + contexto de request

### 1. AuditService

```typescript
// common/audit/audit.service.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { AuditLog } from './models/audit-log.model';

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE' | 'STATE_CHANGE' | 'LOGIN' | 'EXPORT';

interface AuditContext {
  usuarioId: string;
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog) private readonly auditModel: typeof AuditLog,
  ) {}

  async log(
    params: {
      tabla: string;
      registroId: string;
      accion: AuditAction;
      campoModificado?: string;
      valorAnterior?: unknown;
      valorNuevo?: unknown;
      contexto?: Record<string, unknown>;
    },
    ctx: AuditContext,
    transaction?: import('sequelize').Transaction,
  ) {
    return this.auditModel.create(
      {
        tabla: params.tabla,
        registro_id: params.registroId,
        accion: params.accion,
        campo_modificado: params.campoModificado ?? null,
        valor_anterior: params.valorAnterior !== undefined ? JSON.stringify(params.valorAnterior) : null,
        valor_nuevo: params.valorNuevo !== undefined ? JSON.stringify(params.valorNuevo) : null,
        usuario_id: ctx.usuarioId,
        ip_address: ctx.ipAddress,
        user_agent: ctx.userAgent ?? null,
        contexto: params.contexto ?? null,
      },
      { transaction },
    );
  }
}
```

### 2. Capturar IP y user-agent del request (contexto)

Usa un decorador o helper que extraiga esto del `Request` de Express dentro del controller/guard, y pásalo al servicio — no lo reconstruyas dentro del servicio de dominio (mantiene el servicio testeable sin mockear HTTP):

```typescript
// common/audit/audit-context.decorator.ts
export const AuditCtx = createParamDecorator((_, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return {
    usuarioId: req.user.user_id, // viene del JWT ya validado
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  };
});
```

### 3. Uso en un servicio de dominio (ejemplo real: aprobación de MQL — WF002 del Blueprint)

```typescript
async aprobarMql(mqlId: string, ctx: AuditContext) {
  return this.sequelize.transaction(async (t) => {
    const mql = await this.mqlModel.findByPk(mqlId, { transaction: t, lock: t.LOCK.UPDATE });
    if (!mql) throw new NotFoundException('MQL no encontrado');

    const estadoAnterior = mql.estado;
    mql.estado = 'Activo';
    await mql.save({ transaction: t });

    // Efecto colateral del workflow WF002: crea SQL y actualiza el lead
    const sql = await this.sqlModel.create({ mql_id: mqlId, /* ... */ }, { transaction: t });
    await this.leadModel.update(
      { estado: 'SQL' },
      { where: { lead_id: mql.lead_id }, transaction: t },
    );

    // Auditoría del cambio de estado principal
    await this.auditService.log(
      {
        tabla: 'mqls',
        registroId: mqlId,
        accion: 'STATE_CHANGE',
        campoModificado: 'estado',
        valorAnterior: estadoAnterior,
        valorNuevo: 'Activo',
        contexto: { workflow: 'WF002', sql_generado: sql.sql_id },
      },
      ctx,
      t,
    );

    return { mql, sql };
  });
}
```

## Reglas de implementación

1. **La escritura en `audit_log` va dentro de la misma transacción** que la operación de negocio — si la operación falla, el registro de auditoría tampoco debe persistir (no debe haber auditoría de algo que no ocurrió).
2. **Nunca serialices el objeto completo** en `valor_anterior`/`valor_nuevo` si tiene 20+ campos — solo el/los campo(s) que cambiaron. Si es un `INSERT`, `valor_anterior` queda `null` y `valor_nuevo` puede llevar el snapshot completo del registro creado.
3. Para operaciones masivas (ej. importación CSV de leads outbound), audita el evento agregado (`accion: INSERT`, `contexto: { batch_id, total_registros }`) en vez de una fila por cada lead — evita explotar la tabla de auditoría.
4. El endpoint `GET /api/v1/audit-log` (ya definido en el Blueprint, Entregable 6) es de solo lectura y restringido a rol `Admin` — verifica que el guard CASL correspondiente esté aplicado.

## Checklist de testing

- Verificar que toda mutación de estado relevante (ver tabla de transiciones del Blueprint: OUV, MQL, SQL, PRI, SER, FACTURA) genera exactamente un registro `STATE_CHANGE` con `valor_anterior`/`valor_nuevo` correctos.
- Verificar que si la transacción de negocio hace rollback, no queda un registro huérfano en `audit_log`.
- Verificar que `ip_address` y `usuario_id` nunca quedan nulos en un registro producido por una request HTTP autenticada.
