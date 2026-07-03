# CRM Frisson — Starter (Cursor)

Internal end-to-end CRM for Grupo Verytel / Frisson Technologies.
Two autonomous projects (`backend/` + `frontend/`) under one repo, governed by a shared rule system.

## Structure
```
crm-frisson/
├── AGENTS.md              # project constitution (Cursor reads it always)
├── .cursor/rules/*.mdc    # rule system (applies to both projects)
├── backend/               # NestJS project (autonomous: own package.json)
│   └── src/modules/       # the 10 modules
└── frontend/              # React + Vite project (autonomous: own package.json)
    ├── tailwind.config.js
    └── src/
        ├── modules/       # the 10 modules (mirrors backend)
        ├── layout/        # Sidebar, Header, AppLayout, BrandMark
        ├── lib/           # navigation.ts
        └── styles/        # tokens.css + global.css
```

## The 10 modules (inside each project's src/modules)
Commercial: demand-generation · qualification · discovery (OUV) · technical-feasibility (PRE) ·
pricing (PRI) · offer-closing · implementation (SER) · post-sales.
Platform: auth (users/roles/login) · audit.

## Design identity (Verytel — minimalist, white)
- Primary `#0033A0` (sidebar active, header, primary buttons). Turquoise `#2DCCD3` accent only.
- White-dominant (`#FFFFFF` / `#F5F6FA`), ink `#1D1D1B`. Extended blues for charts only (Dashboards = Wave 2).
- Structure like Pipedrive (tables/pipeline first). Type: `"Century Gothic", "Questrial", system-ui`
  (Century Gothic not yet licensed → Questrial fallback). `Aller` only inside the logo SVG.

## Conventions
- Code/identifiers/comments in **English**. Domain terms stay Spanish: OUV, PRE, PRI, SER, Preventa, Pricing, ICP, MOFU, RFS, RFB.
- Every write is audited. Consecutivos immutable, issued atomically.

## Getting started
1. Open the repo root in Cursor — it picks up `AGENTS.md` and `.cursor/rules` automatically.
2. `cd backend` → scaffold the real NestJS app (keep the `src/modules` folders).
3. `cd frontend` → scaffold the real Vite app; import `src/styles/global.css` in the entrypoint; wire `tailwind.config.js`.
4. `cp .env.example backend/.env` and fill values.
5. Replace `frontend/src/layout/BrandMark.tsx` with the official Verytel logo SVG.

## Note on shared code
REST keeps backend and frontend decoupled (no auto-shared types), so there is no `shared/` package
by design — simpler. If later you want to reuse DTO types in the frontend, add a small `shared/`
folder at the root and reference it from both. Not needed to start.


## Usuarios de pruebas
admin@verytel.local
ChangeMe123!

erobles@grupoverytel.com
Verytel2025*
