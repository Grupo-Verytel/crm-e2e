# Module: implementation (web)

Handover. SER-####, kickoff, acta de inicio, hitos RFS/RFB.

## Boundaries (see .cursor/rules/700-modules.mdc)
- Expose ONE public service + DTOs/events. No deep imports from other modules.
- Cross-module access goes through the other module's public service only.
- Shared code -> libs/.

## Wave
Commercial phase — build in its assigned sprint (work plan).

---

## Tarjeta de proyecto (integración PMO)

Slice implementado: el avance del proyecto de una OUV ganada se lee del PMO (Control Project); el
CRM no lo almacena ni lo recalcula.

| Ruta | Contenido |
|------|-----------|
| `/services` | OUV ganadas (`fetchOuvs({ resultado: 'Ganada' })`) |
| `/services/:ouvId` | Indicadores de ejecución + línea de tiempo de estados + alta del proyecto |

- `api/projects-api.ts` — `fetchProyectoEjecucion`, `fetchHistorialEstados`, `crearProyectoPmo`.
- `IndicadoresEjecucion` — los 4 bloques. El signo de la desviación se lee por bloque: en Costos
  positivo es sobrecosto; en los demás, adelanto. Con `available: false` muestra "Sin dato", nunca
  un `0%` que parezca real.
- `CrearProyectoPmoModal` — sólo pide lo que la OUV no responde; el nombre y el valor del contrato
  salen de la OUV si se dejan vacíos.

`PMO_PROJECT_NOT_FOUND` no es un error: significa que el proyecto todavía no se abrió en el PMO, y
es el estado que habilita el botón de alta.

Referencia visual: rama `origin/Design_JD` (maqueta sobre `mock-store`). Spec:
`docs/specs/spec-implementacion-pmo.md`.
