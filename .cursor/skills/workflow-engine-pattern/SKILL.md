# workflow-engine-pattern

**Cuándo usar este skill:** cualquier vez que un service de dominio necesite cambiar el estado de una entidad de negocio (`sqls.estado`, `ouvs.estado`, `preventas.estado`, `pricing.estado`, `propuestas.estado`, etc.) o notificar a otro rol/usuario del cambio.

**Cuándo NO usar este skill:**
- Actualizar campos que no representan una transición de estado del negocio (ej. actualizar `descripcion` de una cita, cambiar `pct_avance` de una actividad interna).
- CRUD estándar sin cross-bandeja (crear un lead, editar datos de contacto).
- Notificaciones puramente cosméticas (ej. "guardado correctamente") — esas son toasts locales, no eventos de negocio.

---

## Regla base

**Nunca modifiques `entidad.estado` directamente en un service.** Siempre pasa por el motor:

```typescript
await this.workflowEngine.transition(
  'SQL',                    // entityType
  sqlId,                    // entityId
  'sql.asignado',           // evento (nombre canónico)
  {                         // context
    estadoAnterior,
    estadoNuevo: 'Asignado',
    entityLabel: sql.consecutivo,
    actorUserId,
    payload: { comercial_id: dto.comercial_id, ... },
    entity: { estado: estadoAnterior },  // estado REAL leído bajo lock
  },
  transaction               // Transaction Sequelize activa
);
```

El motor se encarga de: validar guards, ejecutar side effects (notificar), registrar en `audit_log`, y disparar push WebSocket post-commit.

---

## Contrato con el motor — CRÍTICO

Los guards del motor **confían en que el service ya validó el estado bajo lock**. No re-consultan BD. Esto significa que el service llamador es responsable de garantizar 4 cosas:

**1. Transacción activa.** `transition()` requiere `Transaction` de Sequelize como último argumento. Nunca invocar fuera de `sequelize.transaction()`.

**2. Row lock previo.** Antes de invocar `transition()`, leer la entidad protagonista con `lock: transaction.LOCK.UPDATE`. El lock previene condiciones de carrera con otros callers concurrentes.

**3. Assert de estado en el service.** Validar `entity.estado === estadoEsperado` en el service ANTES del `transition()`. El guard es segunda línea de defensa; el service es la primera. Devuelve HTTP 400 en el service, HTTP 422 en el guard.

**4. `ctx.entity` fiel al estado real.** Cuando pases `ctx.entity.estado`, debe ser el valor leído bajo lock — no hardcodeado, no cacheado, no asumido.

Ver regla Cursor `800-workflow-transitions.mdc` para el enforcement.

---

## Checklist antes de agregar una transición nueva

1. **¿Está definido el evento en `workflow.rules.ts`?**
   Si no, agrégalo ahí primero. Un evento no registrado hace que `engine.transition()` lance `WorkflowRuleNotFoundException`.

2. **¿Los guards cubren las precondiciones?**
   Como mínimo:
   - `guardEntidadEnEstado(tipo, estadoEsperado)` — que la entidad esté en el estado del que sale
   - `guardUsuarioTieneRol(rol)` — que el usuario que dispara tenga permiso

3. **¿Los destinatarios están claros?**
   - Por rol: `destinatarioResolver: () => ({ rol: 'SoporteComercial' })` — expande a todos los usuarios de ese rol
   - Por usuario: `destinatarioResolver: (payload) => ({ userId: payload.comercial_id })`

4. **¿El payload trae todo lo que necesitan los side effects?**
   El motor no vuelve a consultar la BD. Si el mensaje del toast dice "SQL de Empresa X asignado a Juan", el nombre de la empresa y el nombre del comercial deben estar en el payload.

5. **¿Se cumple el contrato de 4 puntos con el motor?**
   Transacción activa, row lock previo, assert en service, `ctx.entity` fiel. Ver sección "Contrato con el motor".

---

## Patrón completo (referencia canónica)

```typescript
async convertirEnOuv(
  sqlId: string,
  dto: CrearOuvDto,
  actorUserId: string,
): Promise<{ sql: Sql; ouv: Ouv }> {
  return this.sequelize.transaction(async (transaction) => {
    // 1. Leer con row lock
    const sql = await this.sqlModel.findByPk(sqlId, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!sql) {
      throw new NotFoundException(`SQL ${sqlId} no encontrado`);
    }

    // 2. Assert de estado en el service (primera línea de defensa)
    if (sql.estado !== SqlEstado.Asignado) {
      throw new BadRequestException(
        `SQL ${sqlId} no está en estado Asignado (está en ${sql.estado})`,
      );
    }

    // 3. Assert de ownership si aplica
    if (sql.comercialAsignadoId !== actorUserId) {
      throw new ForbiddenException(
        `Solo el comercial asignado puede convertir este SQL`,
      );
    }

    const estadoAnterior = sql.estado;

    // 4. Crear entidad destino
    const ouv = await this.ouvsService.crearDesdeSQL(sql, dto, actorUserId, transaction);

    // 5. Mutar estado del origen
    await sql.update(
      { estado: SqlEstado.ConvertidoOUV, ouvId: ouv.ouvId },
      { transaction },
    );

    // 6. Invocar motor — ctx.entity refleja el estado real bajo lock
    await this.workflowEngine.transition(
      EntityType.OUV,
      ouv.ouvId,
      'ouv.creada',
      {
        estadoAnterior,
        estadoNuevo: OuvZona.Universo,
        entityLabel: ouv.consecutivo,
        actorUserId,
        payload: {
          sqlId: sql.sqlId,
          comercial_asignado_id: sql.comercialAsignadoId,
          titulo: ouv.titulo,
        },
        entity: { estado: estadoAnterior },  // ← valor real leído en paso 1
      },
      transaction,
    );

    return { sql, ouv };
  });
}
```

---

## Antipatrones (no hacer)

**❌ Escribir directo al estado sin pasar por el motor:**
```typescript
// MAL — el estado cambia pero nadie se entera
await sql.update({ estado: 'Asignado' });
```

**❌ Emitir notificación manual desde el service:**
```typescript
// MAL — duplica la lógica del motor, se desincroniza con las reglas
await this.notificacionesService.crear({...});
this.wsGateway.emit(...);
```

**❌ Llamar `transition()` fuera de transacción:**
```typescript
// MAL — el push WS puede llegar antes del commit
await sql.update({ estado: 'Asignado' });
await this.workflowEngine.transition(...);  // sin transaction
```

**❌ Leer sin lock previo:**
```typescript
// MAL — dos requests concurrentes pueden pasar el assert ambos
const sql = await this.sqlModel.findByPk(sqlId);  // ← falta lock: LOCK.UPDATE
if (sql.estado !== 'Asignado') throw ...;
await this.workflowEngine.transition(...);
```

**❌ `ctx.entity` con estado asumido:**
```typescript
// MAL — hardcodear el estado que "debería tener"
await this.workflowEngine.transition(EntityType.OUV, ..., {
  entity: { estado: 'Asignado' },  // ← literal, no leído
  ...
});
```

**❌ Poner lógica de negocio pesada dentro de un guard:**
```typescript
// MAL — un guard debe ser rápido y sync. Cálculos pesados van en un service
guardCalcularMargen: async (entity) => {
  const margen = await complexPricingCalculation(entity);
  return margen > 0.15;
}
```
En Fase A los guards son simples (rol + estado). En Fase B se agregan guards que delegan a services de dominio dedicados.

---

## Convención de nombres de eventos

Formato: `{entidad}.{accion_en_pasado}` — todo minúsculas, snake_case en la acción.

Ejemplos correctos:
- `lead.mql_aprobado`
- `sql.creado`
- `sql.asignado`
- `sql.cita_reagendada`
- `ouv.creada`
- `ouv.avance_zona`

Incorrectos:
- `CrearOUV` (imperativo, PascalCase)
- `ouv-creada` (kebab-case)
- `ouvCreada` (camelCase sin separador de entidad)

---

## Verificación en PR

Un PR que introduce un nuevo estado o transición debe incluir:

- [ ] Nueva entrada en `workflow.rules.ts` con guards y sideEffects
- [ ] Service de dominio invoca `engine.transition()` dentro de transacción
- [ ] `findByPk` con `lock: transaction.LOCK.UPDATE` sobre la entidad protagonista, ANTES del transition
- [ ] `if (entity.estado !== estadoEsperado) throw` en el service, antes del transition
- [ ] `ctx.entity.estado` refleja el valor real leído bajo lock (no hardcodeado)
- [ ] No hay `.update({ estado: ... })` directo fuera del motor
- [ ] Prueba E2E: el destinatario recibe la notificación (mockear WS gateway)
- [ ] Prueba unitaria: guard rechaza → HTTP 422 con `codigo_error`
- [ ] `audit_log` verificado: la transición queda registrada con usuario, entidad, estado ant/nuevo

---

## Fragilidad conocida — el motor confía en el caller

El diseño actual del motor NO re-consulta la BD dentro de los guards. Confía en `ctx.entity` que el service pasa. La protección real contra condiciones de carrera es el row lock del service, no el guard.

Esto es una decisión consciente de Fase A del motor (ver DR-2026-08). Cuando llegue Fase B, se evaluará si vale la pena inyectar un `EntityLoaderService` que permita a los guards re-consultar. Por ahora, la disciplina del row lock + el enforcement de la regla `800-workflow-transitions.mdc` cubren el 99% de los casos.

Si vas a construir un caso donde **no** puedes hacer row lock antes (raro), documenta la razón en un decision record y proponer una alternativa. No calles el problema.

---

## Referencias

- `spec-workflow-engine.md` — spec completa Fase A
- `DR-2026-08` — decision record del alcance intermedio incremental
- Regla Cursor `800-workflow-transitions.mdc` — enforcement automático del patrón
