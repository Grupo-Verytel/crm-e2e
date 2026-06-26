# Module: post-sales (web)

Posventa. Novedades, renovaciones, bajas, upgrades. ChurnRate.

## Boundaries (see .cursor/rules/700-modules.mdc)
- Expose ONE public service + DTOs/events. No deep imports from other modules.
- Cross-module access goes through the other module's public service only.
- Shared code -> libs/.

## Wave
Commercial phase — build in its assigned sprint (work plan).
