# Module: audit (web)

Escritor central de audit_log (hooks Sequelize) + API de consulta de auditoria.

## Boundaries (see .cursor/rules/700-modules.mdc)
- Expose ONE public service + DTOs/events. No deep imports from other modules.
- Cross-module access goes through the other module's public service only.
- Shared code -> libs/.

## Wave
Platform module — build in Sprint 1.
