# RESUMEN-PASO-3 — Influencias multi-contacto (frontend)

**Fecha:** 2026-09-24  
**Estado:** implementado sobre el panel actual de la ficha OUV. Sin merge y sin push.  
`npx tsc -b` del frontend OK. No hay herramientas de navegador en esta sesión: no se hizo clic real en la UI.

## Componentes

- `InfluenciasSection.tsx` — encabezado con badge del filtro (dato de `filtro.passed` y `filtro.greenTypes`, sin recalcular D3).
- `InfluenciaCard.tsx` — vacío, avatares apilados (máx. 3 y `+N`), “N contacto(s)”, puntos de calificación, borde verde solo si el tipo está en `greenTypes`.
- `InfluenciaDetallePanel.tsx` — filas compactas, estado de 3 opciones, nota con tooltip, quitar con confirmación.
- `InfluenciaNotaModal.tsx` — reutiliza `ModalShell`. Escape cierra; si hay cambios, pide confirmación.
- `EstadoSegmentedControl.tsx` — sin Amarillo; modo `compact`.
- `ouv-vocab.ts` — tonos `TONE` / `TONE_CLASS` / `LABELS` sin Amarillo.
- `OuvDetailPage.tsx` y `ouvs-api.ts` — alta, baja, calificación y nota por contacto. Optimista en la calificación, con rollback si la API falla.
- `AvanceZonaModal.tsx` — muestra el conteo que vino del backend. Si el avance falla, el mensaje es el `detail` RFC 7807 (`http-client.ts` lee `detail`).

## Estados

| Estado | Qué se ve |
|---|---|
| Tipo vacío | Círculo punteado con “+” y “Sin asignar”. Panel: “Aún no hay contactos en esta influencia”. |
| 1 contacto | Un avatar, “1 contacto”, un punto. |
| 3 contactos | Tres avatares, “3 contactos”, tres puntos. |
| 5 contactos | Tres avatares y “+2”, “5 contactos”. “Agregar contacto” deshabilitado, tooltip “Máximo 5 contactos por influencia”. |
| Nota vacía | Ícono tenue. |
| Nota con texto | Ícono de acento y tooltip de hasta 3 líneas. Clic o Enter abre el modal. En táctil (`hover: none`) no hay tooltip. |
| Modal con cambios | Escape o Cancelar pide confirmación antes de cerrar. |
| Filtro no cumplido | Badge neutro “Filtro: X de 2 tipos en verde”. |
| Filtro cumplido | El mismo badge en verde. |

## Checklist E2E manual

1. Abrir una OUV en curso sin influencias: cinco tarjetas “Sin asignar” y badge “Filtro: 0 de 2”.
2. Agregar un contacto existente a Económica y calificarlo Verde con un clic. El punto queda verde y el borde de la tarjeta también. El badge sigue en 1 de 2.
3. Agregar otro contacto al mismo tipo en Verde: el badge no pasa a 2.
4. Poner Técnica en Verde: el badge pasa a “2 de 2” en verde.
5. Llegar a 5 contactos en un tipo: el botón queda deshabilitado.
6. Nota vacía y nota con texto: tooltip, modal, contador n/1000, confirmación si hay cambios sin guardar.
7. Quitar un contacto: confirmación con el nombre y el tipo.
8. Avanzar hacia En funnel sin cumplir el filtro: se ve el `detail` del backend, no un texto inventado en el cliente.
9. Usuario o Coach en Verde no ponen borde de filtro ni suben el badge.
