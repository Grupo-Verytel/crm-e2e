# Module: auth (web)

Login, session (JWT + refresh), and route protection for the CRM shell.

## Step 7A — implemented

| Feature | Location |
|---------|----------|
| Login page | `pages/LoginPage.tsx` |
| Session context | `context/AuthProvider.tsx` |
| API client | `api/auth-api.ts` + `lib/api/http-client.ts` |
| Token storage | `lib/api/token-storage.ts` |
| Protected routes | `components/ProtectedRoute.tsx` |
| Hook | `hooks/useAuth.ts` |

## Dev setup

1. Backend running on port 3000 (`npm run start:dev` in `backend/`).
2. Copy `frontend/.env.example` → `frontend/.env` (default proxy base `/api/v1`).
3. `npm run dev` in `frontend/` → http://localhost:5173

Vite proxies `/api/v1` to the NestJS backend.

## Boundaries (see .cursor/rules/700-modules.mdc)

- Module API lives under `api/`; components never call `fetch` directly.
- Cross-module data goes through typed clients in each module's `api/` folder.
- Shared HTTP utilities → `src/lib/api/` (not module internals).

## Wave

Platform module — Sprint 1. Step 7A: login + shell. Step 7B: admin users/roles + audit log UI.
