# RESUMEN-PASO-6 — Modales + bandeja Soporte + admin catálogos

**Fecha:** 2026-08-07  
**Estado:** completado — esperando aprobación humana  
**Build:** `npm run build` (frontend) **OK**

---

## Qué se entregó

### Modales (detalle OUV)
| Modal | Spec | Comportamiento |
|---|---|---|
| `AvanceZonaModal` | 8.6 | Destino, guards a evaluar, checklist zona destino, confirma `POST …/avanzar` |
| `RetrocesoZonaModal` | 8.7 | Destino + motivo TEXT obligatorio → `POST …/retroceder` |
| `CierreOuvModal` | 8.8 | Selector Ganada / Perdida / Descartada; formulario dinámico + catálogos |
| `CrearOuvDirectaModal` | 8.4 | Ya existía (PASO 5) |
| `ContactoFormModal` | 8.5 | Ya existía (PASO 5) |

Detalle: botones **Avanzar / Retroceder / Cerrar OUV** abren modales (ya no `prompt`).

### Bandeja Soporte (8.2)
- Misma bandeja con `all=true` + banner “vista Soporte”
- `DiscoveryNav` con links a catálogos (solo Soporte/Admin)

### Admin catálogos (8.9)
| Ruta | CRUD |
|---|---|
| `/opportunities/admin/motivos-perdida` | motivos pérdida |
| `/opportunities/admin/motivos-descarte` | motivos descarte |
| `/opportunities/admin/zona-checklist-templates` | plantillas checklist |

API client: `discovery/api/catalogos-api.ts`  
Rutas protegidas con `RoleRoute` (`SoporteComercial`, `Admin`).

### Fuera de alcance (Wave 2)
Override, reapertura, `motivos_reapertura` — no incluidos.

---

## Archivos clave

| Path | Rol |
|---|---|
| `discovery/components/AvanceZonaModal.tsx` | Avance |
| `discovery/components/RetrocesoZonaModal.tsx` | Retroceso |
| `discovery/components/CierreOuvModal.tsx` | Cierre |
| `discovery/components/DiscoveryNav.tsx` | Nav módulo |
| `discovery/api/catalogos-api.ts` | Client admin |
| `discovery/pages/MotivosCatalogoPage.tsx` | Admin motivos |
| `discovery/pages/ZonaChecklistAdminPage.tsx` | Admin templates |
| `discovery/pages/OuvDetailPage.tsx` | Integra modales |
| `routing/AppRoutes.tsx` | Rutas admin antes de `:id` |

---

## Checklist E2E manual

Prerrequisito: roles re-seedeados (permisos `ouv-motivos` / `ouv-catalogs`).

### Ejecutivo Comercial (dueño)
- [ ] Crear OUV directa desde bandeja
- [ ] Agregar / editar / eliminar contacto
- [ ] Guardar presupuesto confirmado
- [ ] Avanzar a Encima Funnel (modal muestra guard presupuesto) — falla sin presupuesto
- [ ] Poner ≥2 influencias en Verde; avanzar a En Funnel
- [ ] Retroceder con motivo; sin motivo no confirma
- [ ] Cerrar: Perdida / Descartada con motivo de catálogo
- [ ] Cerrar Ganada solo desde Mayor Probabilidad + monto

### Soporte Comercial
- [ ] Bandeja lista todas las OUVs; sin botón Crear / Avanzar
- [ ] Detalle en solo lectura de zona/cierre
- [ ] CRUD motivos pérdida y descarte
- [ ] CRUD plantillas checklist; tras crear UNIVERSO, nuevas OUVs / siembra al avanzar muestran items

### Regresión
- [ ] Ejecutivo no accede a `/opportunities/admin/*` (redirect)
- [ ] Eventos `ouv.*` refrescan bandeja/detalle

---

## Notas

1. Sin plantillas en `zona_checklist_templates`, el checklist nace vacío (esperado).
2. Kanban sigue sin drag-and-drop; el avance se hace desde el detalle.
3. Competidor ganador se pide si el nombre del motivo contiene “competidor”.

---

## DETENERSE

PASO 6 listo. **No continúo** hasta tu aprobación explícita (cierre del plan de 6 pasos).
