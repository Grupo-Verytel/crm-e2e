# Module: auth (web)

Login, usuarios, roles y permisos (RBAC/CASL). JWT + refresh. Owns: users, roles, sessions.

## Boundaries (see .cursor/rules/700-modules.mdc)
- Expose ONE public service + DTOs/events. No deep imports from other modules.
- Cross-module access goes through the other module's public service only.
- Shared code -> libs/.

## Wave
Platform module — build in Sprint 1.
