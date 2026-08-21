# RESUMEN-PR3-PRIMA — `ouv.creada` solo a SoporteComercial

**Fecha:** 2026-08-07  
**Alcance:** Un único cambio en destinatarios de `ouv.creada`. Sin rol DirectorComercial.

---

## Diff exacto aplicado

Archivo: `backend/src/modules/workflow-engine/workflow.rules.ts`  
Regla: `eventType: 'ouv.creada'`

```diff
   destinatarios: [
-    { tipo: 'rol', resolver: () => 'DirectorComercial' },
     { tipo: 'rol', resolver: () => 'SoporteComercial' },
   ],
```

Guards, `titulo` y `mensaje` sin cambios.

---

## Confirmaciones

| Check | Resultado |
|---|---|
| Solo ese archivo modificado | Sí (`git status` / diff) |
| PR-3 anterior (rol + seeder) descartado | Sí — revertido antes; `role-permissions.js` sin `DirectorComercial`; sin seeder ni `.env.sample` de ese rol |
| `npm run build` (backend) | OK |
| Test dedicado de la regla | No existe |
| Migraciones / frontend | No requeridos |

---

## Verificación manual pendiente

1. Crear una OUV nueva (SQL `Asignado` → convertir).
2. Confirmar **1 fila** en `notifications` con `event_type = 'ouv.creada'`.
3. `recipient_user_id` debe ser un usuario con rol `SoporteComercial` (no DirectorComercial).
