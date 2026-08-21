# RESUMEN-PASO-5 — Frontend bandeja + detalle OUV + contactos

**Fecha:** 2026-08-07  
**Estado:** completado — esperando aprobación humana antes del PASO 6  
**Build:** `npm run build` (frontend) **OK**

---

## Qué se entregó

### API client
`frontend/src/modules/discovery/api/ouvs-api.ts` — list/detail, crear directa, zonas, contactos, influencias, checklist, presupuesto.

### Bandeja (`/opportunities`)
- Vista dual **Lista / Kanban**
- Filtros Wave 1: zona, gap, texto, rango `created_at` (draft/apply)
- `Pagination` reutilizada
- Botón **Crear OUV directa** (solo `EjecutivoComercial`) + modal mínimo
- Refetch silencioso ante eventos `ouv.*` vía `IN_APP_NOTIFICATION_EVENT`
- Soporte/Admin: `all=true` en listado

### Detalle (`/opportunities/:id`)
- Encabezado con badges (consecutivo, zona, resultado, origen, gap)
- Banner de alerta si `tiene_gap`
- **Panel contactos:** listar / agregar / editar / eliminar + badge si asignado a influencia
- Panel influencias (3 tarjetas: estado, contacto de la misma OUV, notas)
- Panel presupuesto
- Panel checklist (zona actual)
- Sección cierre (si `resultado ≠ EnCurso`)
- Avanzar / retroceder (retroceso con `prompt` de motivo — modal formal en PASO 6)
- Refetch si llega notificación OUV de esa entidad

### Routing
`AppRoutes.tsx`: `/opportunities` y `/opportunities/:id` dejan de ser placeholder.

---

## Archivos clave

| Path | Rol |
|---|---|
| `discovery/api/ouvs-api.ts` | Client |
| `discovery/lib/ouv-vocab.ts` | Zonas / enums UI |
| `discovery/components/ui.ts`, `OuvBadges.tsx` | Estilos / badges |
| `discovery/components/CrearOuvDirectaModal.tsx` | Crear directa |
| `discovery/components/ContactoFormModal.tsx` | Agregar/editar contacto |
| `discovery/pages/OuvsBoardPage.tsx` | Bandeja |
| `discovery/pages/OuvDetailPage.tsx` | Detalle |
| `routing/AppRoutes.tsx` | Rutas |

---

## Diferido a PASO 6 (según plan)

- Modales formales de avance / cierre (ganar/perder/descartar)
- Bandeja Soporte dedicada + admin catálogos UI
- Pulir modal de transición (checklist destino + guards)

---

## Sugerencias post-implementación

1. Deep-link en `NotificationBell` para `entity_type=OUV` → `/opportunities/:id`.
2. Tras convertir SQL→OUV, navegar a `/opportunities/:ouv_id`.
3. Kanban: drag-and-drop no incluido (spec: abrir modal de transición; PASO 6).

---

## DETENERSE

PASO 5 listo. **No avanzo al PASO 6** hasta tu aprobación explícita.
