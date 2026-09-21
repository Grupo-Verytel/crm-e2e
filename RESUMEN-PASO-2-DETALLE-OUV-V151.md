# RESUMEN-PASO-2 — Detalle OUV origen/canal (spec v1.5.1)

**Fecha:** 2026-09-17  
**Spec:** `docs/specs/spec-ouv-funnel.md` v1.5.1  
**Alcance:** requisitos 1–2, **frontend del detalle**. Cierre no se tocó.  
**Estado:** completado — pendiente de verificación humana en el navegador

---

## Qué se implementó

### Nav (EARS-35)

- `OuvDetailPage` ya no renderiza `DiscoveryNav`. Queda el link volver (`backLinkForResultado`).
- `DiscoveryNav` se conserva en bandejas y catálogos.
- `OuvDetailNav` (Detalle / Preventa / Interacciones) no se tocó.

### Origen / canal (EARS-36)

- Tipo `Ouv` incluye `origin` y `source_channel`.
- `buildOuvMetaFields` muestra **Origen** y **Canal de origen** (NULL → "—"; canal con `CANAL_ORIGEN_LABEL`).
- En modo edición esos dos campos son `dt/dd` de solo lectura (no van en PATCH).
- `OuvReadonlyHeaderCard` (oferta/cierre) hereda el mismo grid.

### Proyecto (EARS-40 v1.5.1)

- **Se conserva** en vista y edición (Recurrente / No recurrente). Reversión explícita vs v1.5.

### Header y cierre (EARS-41) — no tocados

- Botón Contactos, `OuvConfigMenu` (Editar / Avanzar / Retroceder / Cerrar).
- Plazo, probabilidad, ciudad, región.
- `CierreOuvModal` / `WonCelebration` / sección Cierre.

No se reintrodujeron Consecutivo, Origen OUV ni Estado OUV.

---

## Cómo verificar

1. Abrir una OUV creada desde SQL: Origen y Canal de origen con el snapshot del lead.
2. Abrir una OUV directa o anterior a v1.5: ambos "—".
3. Confirmar que no hay pestañas Bandeja / Ganadas / Perdidas / Descartadas en el detalle; sí el link volver.
4. Editar: Proyecto, Contactos y Cerrar siguen igual; origen/canal no se editan.

---

**Siguiente:** requisito 3 de cierre (ya implementado en crm-e2e — congelado) o commit de este PASO 2.
