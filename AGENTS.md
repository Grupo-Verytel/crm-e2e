# CRM Frisson — Project Constitution (AGENTS.md)

Internal end-to-end CRM for Grupo Verytel / Frisson Technologies. Covers the 8-phase
commercial process plus platform modules (auth, audit). Read this before any task.

## Stack (fixed — do not change)
- Monorepo (workspaces). Backend: Node.js + NestJS + REST. ORM: Sequelize
  (`@nestjs/sequelize` + `sequelize-typescript`). DB: MySQL. Frontend: React + TypeScript + Vite.
- Auth: JWT + refresh, RBAC via CASL. Audit: Sequelize hooks → `audit_log`.

## Non-negotiables
1. **Module boundaries.** The system is split into 10 modules (see `.cursor/rules/700-modules.mdc`).
   A module never imports another module's internals; cross-module calls go through its public
   service/API only. Shared code, if ever needed, lives in a root `shared/` folder.
2. **Language.** Code, identifiers, comments, commit messages → English.
   Domain vocabulary stays in Spanish as-is: OUV, PRE, PRI, SER, Preventa, Pricing, ICP,
   MOFU, RFS, RFB, WinRate, ChurnRate. Do not translate these.
3. **No secrets in code.** Use env vars. Never hardcode credentials, hosts, or tokens.
4. **Every write is audited.** create/update/delete must flow through the audited path.
5. **Spec-first.** For core/compliance modules, an EARS spec exists before code. Tests map 1:1
   to EARS criteria (see `500-testing.mdc`).
6. **Design system only.** Never hardcode a hex color or font in a component. Use the tokens
   in `frontend/src/styles` (see `600-ui-design.mdc`).

## Consecutivos (domain identifiers — never editable once issued)
OUV-####-Cliente (Oportunidad) → PRE-#### (Preventa) → PRI-#### (Pricing) → SER-#### (Servicio).
Generated atomically (row lock / FOR UPDATE).

## What NOT to do
- Do not introduce GraphQL (this project is REST).
- Do not introduce a new ORM, DB engine, or UI kit.
- Do not add colors outside the Verytel palette.
- Do not use the `Aller` font anywhere except the logo SVG.
