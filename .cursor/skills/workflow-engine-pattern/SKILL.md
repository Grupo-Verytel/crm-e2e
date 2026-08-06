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
  {                         // payload
    comercial_id: dto.comercial_id,
    nombre_lead: sql.lead.nombre,
    // ... datos que los sideEffects necesitarán
  },
  transaction              // Transaction Sequelize activa
);
```

El motor se encarga de: validar guards, ejecutar side effects (notificar), registrar en `audit_log`, y disparar push WebSocket post-commit.

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

5. **¿La transición está dentro de una transacción?**
   El motor requiere `Transaction` activa. Servicios que no usen transacción rompen el patrón:
   ```typescript
   await this.sequelize.transaction(async (t) => {
     await sql.update({ estado: 'Asignado', comercial_id, fecha_asignacion }, { transaction: t });
     await this.workflowEngine.transition('SQL', sql.sql_id, 'sql.asignado', payload, t);
   });
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

**❌ Llamar `engine.transition()` fuera de transacción:**
```typescript
// MAL — el push WS puede llegar antes del commit, o quedar huérfano si commit falla
await sql.update({ estado: 'Asignado' });
await this.workflowEngine.transition(...);  // sin transaction
```

**❌ Poner lógica de negocio pesada dentro de un guard:**
```typescript
// MAL — un guard debe ser rápido y sync. Cálculos pesados van en un service de dominio
// invocado desde el sideEffect en Fase B.
guardCalcularMargen: async (entity) => {
  const margen = await complexPricingCalculation(entity); // pesado
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
- `sql.convertido_ouv`
- `ouv.preventa_solicitada`

Incorrectos:
- `AsignarSQL` (imperativo, PascalCase)
- `sql-asignado` (kebab-case)
- `sqlAsignado` (camelCase sin separador de entidad)

---

## Verificación en PR

Un PR que introduce un nuevo estado o transición debe incluir:

- [ ] Nueva entrada en `workflow.rules.ts` con guards y sideEffects
- [ ] Service de dominio invoca `engine.transition()` dentro de transacción
- [ ] No hay `.update({ estado: ... })` directo fuera del motor
- [ ] Prueba E2E: el destinatario recibe la notificación (mockear WS gateway)
- [ ] Prueba unitaria: guard rechaza → HTTP 422 con `codigo_error`
- [ ] `audit_log` verificado: la transición queda registrada con usuario, entidad, estado ant/nuevo

---

## Referencias

- `spec-workflow-engine.md` — spec completa Fase A
- `DR-2026-08` — decision record del alcance intermedio incremental
- Regla Cursor `800-workflow-transitions.mdc` — enforcement automático del patrón
