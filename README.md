# CRM Frisson — CRM end-to-end de Grupo Verytel

CRM interno para cubrir el **proceso comercial completo** de Grupo Verytel / Frisson Technologies: desde la captura de leads (TOFU) hasta la posventa (ChurnRate), pasando por OUV, Preventa (PRE), Pricing (PRI) y Servicio (SER).

El repositorio agrupa **dos proyectos autónomos** (`backend/` y `frontend/`) bajo un mismo sistema de reglas (`.cursor/rules/` + `AGENTS.md`). No hay paquete `shared/` por diseño: backend y frontend se comunican solo por **REST**.

---

## Tabla de contenidos

1. [Stack tecnológico](#stack-tecnológico)
2. [Arquitectura general](#arquitectura-general)
3. [Los 10 módulos](#los-10-módulos)
4. [Estructura del repositorio](#estructura-del-repositorio)
5. [Backend (NestJS)](#backend-nestjs)
6. [Frontend (React)](#frontend-react)
7. [Autenticación y permisos (CASL)](#autenticación-y-permisos-casl)
8. [Auditoría](#auditoría)
9. [API REST](#api-rest)
10. [Sistema de diseño (Verytel)](#sistema-de-diseño-verytel)
11. [Puesta en marcha local](#puesta-en-marcha-local)
12. [Base de datos: migraciones y seeds](#base-de-datos-migraciones-y-seeds)
13. [Pruebas](#pruebas)
14. [Convenciones del proyecto](#convenciones-del-proyecto)
15. [Especificaciones (EARS)](#especificaciones-ears)
16. [Usuarios de prueba](#usuarios-de-prueba)
17. [Estado actual del desarrollo](#estado-actual-del-desarrollo)
18. [Iniciar la aplicación](#iniciar-la-aplicación)

---

## Stack tecnológico

| Capa | Tecnología | Notas |
|------|------------|-------|
| **Monorepo** | Repo único, dos `package.json` | `backend/` y `frontend/` son proyectos independientes |
| **Backend** | Node.js + **NestJS 11** | API REST, arquitectura modular |
| **ORM** | **Sequelize** (`@nestjs/sequelize` + `sequelize-typescript`) | Modelos tipados, migraciones con sequelize-cli |
| **Base de datos** | **MySQL** | Timestamps en UTC |
| **Auth** | **JWT** (access + refresh) + **CASL** | RBAC por rol; guards globales |
| **Validación** | `class-validator` + `class-transformer` | DTOs en cada endpoint |
| **Frontend** | **React 19** + **TypeScript** + **Vite 8** | SPA con lazy loading |
| **Estilos** | **Tailwind CSS 4** + tokens CSS propios | Paleta Verytel; sin colores hardcodeados |
| **Routing** | React Router 7 | Rutas protegidas por sesión y rol |
| **Testing** | Jest (backend unit + e2e) | Criterios EARS mapeados 1:1 a tests |

**Lo que NO se usa (decisión de arquitectura fija):** GraphQL, Prisma/TypeORM, Redux global, UI kits externos, colores fuera de la paleta Verytel.

---

## Arquitectura general

```
┌─────────────────────────────────────────────────────────────────┐
│                         NAVEGADOR (SPA)                         │
│  React + Vite  →  módulos en frontend/src/modules/              │
│  Cliente API tipado por módulo (api/)                           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP REST  /api/v1
                             │ Bearer JWT
┌────────────────────────────▼────────────────────────────────────┐
│                      NESTJS (backend/)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────────────┐  │
│  │  auth    │  │  audit   │  │  demand-generation (+ otros) │  │
│  │ JWT/CASL │  │ hooks →  │  │  controllers → services →    │  │
│  │          │  │ audit_log│  │  models (Sequelize)           │  │
│  └──────────┘  └──────────┘  └──────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────────┘
                             │ Sequelize
┌────────────────────────────▼────────────────────────────────────┐
│                         MySQL (crm_e2e)                          │
└─────────────────────────────────────────────────────────────────┘
```

### Principios de diseño

1. **Modular monolith.** Diez módulos de negocio con fronteras estrictas. Un módulo **nunca** importa internals de otro; solo consume su **servicio público** exportado.
2. **Spec-first.** Los módulos core tienen especificación EARS en `docs/specs/` antes del código. Los tests de integración referencian criterios EARS.
3. **Toda escritura se audita.** Create/update/delete pasan por Sequelize hooks → tabla `audit_log`.
4. **Consecutivos inmutables.** OUV, PRE, PRI y SER se generan de forma atómica (row lock) y no se editan una vez emitidos.
5. **REST desacoplado.** No hay tipos compartidos automáticamente entre backend y frontend; cada lado define sus DTOs/tipos. Si en el futuro hace falta, se puede añadir un `shared/` en la raíz.

### Flujo comercial (8 fases + 2 plataforma)

```
Leads (TOFU → MOFU → MQL → SQL)
    → Calificación (scoring, ICP)
        → Discovery (OUV-####-Cliente)
            → Technical-feasibility (PRE-####)
                → Pricing (PRI-####)
                    → Offer-closing (propuestas, contratos)
                        → Implementation (SER-####, RFS/RFB)
                            → Post-sales (renovaciones, ChurnRate)

Plataforma: auth (usuarios/roles) · audit (audit_log)
```

---

## Los 10 módulos

| # | Módulo (`kebab-case`) | Fase | Identificador clave | Estado |
|---|------------------------|------|---------------------|--------|
| — | `auth` | Plataforma | JWT, roles, CASL | Implementado |
| — | `audit` | Plataforma | `audit_log` | Implementado |
| 1 | `demand-generation` | Generación de demanda | Leads, campañas, TOFU→SQL | Implementado |
| 2 | `qualification` | Calificación | Scoring, ICP, nurturing | Scaffold |
| 3 | `discovery` | Oportunidades | **OUV**-####-Cliente | Scaffold |
| 4 | `technical-feasibility` | Preventa | **PRE**-#### | Scaffold |
| 5 | `pricing` | Pricing | **PRI**-#### | Scaffold |
| 6 | `offer-closing` | Oferta y cierre | Propuestas, contratos | Scaffold |
| 7 | `implementation` | Implementación | **SER**-####, RFS/RFB | Scaffold |
| 8 | `post-sales` | Posventa | Renovaciones, ChurnRate | Scaffold |

Cada módulo existe en **ambos** proyectos:

- `backend/src/modules/<modulo>/`
- `frontend/src/modules/<modulo>/`

---

## Estructura del repositorio

```
crm-e2e/
├── AGENTS.md                    # Constitución del proyecto (Cursor la lee siempre)
├── README.md                    # Este archivo
├── .cursor/rules/*.mdc          # Reglas de arquitectura, UI, testing, módulos
│
├── docs/
│   └── specs/                   # Especificaciones EARS por módulo
│       ├── spec-auth.md
│       ├── spec-audit.md
│       └── spec-demand-generation.md
│
├── backend/                     # API NestJS (puerto 3000)
│   ├── .env.sample              # Plantilla de variables → copiar a .env
│   ├── database/
│   │   ├── migrations/          # Migraciones Sequelize
│   │   └── seeders/             # Roles, usuario admin, usuario sistema
│   ├── src/
│   │   ├── main.ts              # Bootstrap: prefix /api/v1, ValidationPipe
│   │   ├── app.module.ts        # Importa módulos activos
│   │   ├── config/              # Configuración DB, JWT
│   │   ├── database/            # DatabaseModule (Sequelize)
│   │   └── modules/             # Los 10 módulos
│   └── test/                    # Tests e2e (auth, audit, demand-generation)
│
└── frontend/                    # SPA React (puerto 5173)
    ├── .env.example
    ├── vite.config.ts           # Proxy /api/v1 → localhost:3000
    ├── tailwind.config.js       # Tema ligado a tokens.css
    └── src/
        ├── main.tsx             # Entrypoint
        ├── App.tsx              # BrowserRouter + AuthProvider
        ├── routing/AppRoutes.tsx
        ├── layout/              # AppLayout, Sidebar, Header, BrandMark
        ├── lib/                 # Cliente HTTP, format, navegación
        ├── styles/              # tokens.css + global.css (paleta Verytel)
        └── modules/             # Los 10 módulos (espejo del backend)
```

---

## Backend (NestJS)

### Estructura interna de un módulo

Cada módulo bajo `backend/src/modules/<modulo>/` sigue esta convención:

```
<modulo>/
├── <modulo>.module.ts       # Registra controllers, providers, exports
├── controllers/             # Capa HTTP delgada: valida DTO → delega al servicio
├── services/                # Reglas de negocio
│   └── <modulo>.service.ts  # ← Servicio PÚBLICO (único export del módulo)
├── models/                  # Entidades Sequelize
├── dtos/                    # Request/response + class-validator
├── events/                  # (opcional) eventos de dominio
├── lib/                     # Utilidades internas del módulo
├── constants/
└── ports/                   # (opcional) interfaces para adaptadores externos
```

**Regla de oro:** los controllers son delgados. La lógica vive en `services/`. Otros módulos solo inyectan el **servicio público** exportado en `<modulo>.module.ts`.

### Ejemplo: `demand-generation`

| Pieza | Responsabilidad |
|-------|-----------------|
| `LeadsController` | CRUD leads, interacciones, checklist, transiciones de estado |
| `CampaignsController` | Campañas, import CSV |
| `MqlsController` | Aprobación/rechazo MQL (Director de Mercadeo) |
| `DashboardController` | KPIs de marketing |
| `DemandGenerationService` | **Fachada pública** — orquesta LeadsService, StateMachine, etc. |
| `LeadStateMachineService` | Máquina de estados TOFU→MOFU→MQL_PENDING→SQL |

### Guards globales (auth)

En `AuthModule` se registran como `APP_GUARD`:

1. **`JwtAuthGuard`** — exige Bearer token en todas las rutas (salvo `@Public()`).
2. **`CaslGuard`** — verifica permisos con `@CheckAbility({ action, subject })`.

Si una acción devuelve `403 Insufficient permissions`, el rol del usuario no tiene el `action`/`subject` requerido en la matriz RBAC (`backend/database/seeders/lib/role-permissions.js`).

### Módulos activos en `app.module.ts`

```typescript
imports: [DatabaseModule, AuthModule, AuditModule, DemandGenerationModule]
```

Los demás módulos comerciales tienen carpeta scaffold con `README.md` pero aún no están cableados.

---

## Frontend (React)

### Estructura interna de un módulo

```
frontend/src/modules/<modulo>/
├── README.md
├── types.ts              # Tipos del dominio (espejo de los DTOs del backend)
├── api/                  # Cliente REST tipado (nunca fetch inline en componentes)
├── pages/                # Pantallas (lazy-loaded vía *Lazy.tsx)
├── components/           # UI del módulo
├── hooks/                # Lógica reutilizable
└── lib/                  # Utilidades del módulo
```

### Capas transversales (fuera de módulos)

| Carpeta | Contenido |
|---------|-----------|
| `layout/` | `AppLayout`, `Sidebar`, `Header` — shell tipo Pipedrive |
| `routing/AppRoutes.tsx` | Definición de rutas + lazy loading |
| `lib/api/http-client.ts` | Cliente HTTP con refresh automático de JWT |
| `lib/navigation.ts` | Items del sidebar filtrados por permisos CASL |
| `styles/tokens.css` | Variables CSS Verytel (única fuente de color/tipografía) |

### Rutas principales

| Ruta | Módulo | Descripción |
|------|--------|-------------|
| `/login` | auth | Inicio de sesión |
| `/demand` | demand-generation | Leads (vista Lista / Kanban) |
| `/demand/leads/:id` | demand-generation | Detalle de lead |
| `/demand/campaigns` | demand-generation | Campañas |
| `/demand/mqls` | demand-generation | Bandeja MQL (solo Director de Mercadeo) |
| `/demand/dashboard` | demand-generation | Dashboard marketing |
| `/admin/users` | auth | Gestión de usuarios y roles (solo Admin) |
| `/admin/audit` | audit | Consulta de audit_log (solo Admin) |
| `/opportunities`, `/qualification`, … | — | Placeholders (próximamente) |

### Comunicación con el backend

- En desarrollo, Vite hace **proxy** de `/api/v1` → `http://localhost:3000` (`vite.config.ts`).
- Variable `VITE_API_BASE_URL` (default `/api/v1`) en `frontend/.env`.
- Cada módulo tiene su carpeta `api/` con funciones tipadas que usan `apiRequest<T>()`.

---

## Autenticación y permisos (CASL)

### Flujo de sesión

1. `POST /api/v1/auth/login` → `access_token` + `refresh_token`.
2. El frontend guarda tokens en `localStorage` y los adjunta como `Authorization: Bearer …`.
3. Si el access token expira, `http-client.ts` renueva automáticamente con el refresh token.
4. `GET /api/v1/auth/me` devuelve usuario + `permissions[]` (reglas CASL).

### Roles del sistema (seed)

| Rol | Permisos destacados |
|-----|---------------------|
| `Admin` | Lectura global; gestión de usuarios/roles/audit |
| `DirectorMercadeo` | CRUD+A en leads/campañas; aprueba MQL |
| `GestorMercadeo` | CRU en leads/campañas; gestiona el embudo TOFU→MQL |
| `EjecutivoComercial` | Oportunidades (OUV), propuestas |
| `SoporteComercial` | Recibe SQL, gestiona oportunidades |
| `Preventa`, `Pricing`, `PMO`, `FyA` | Fases posteriores del embudo |

La matriz completa está en `backend/database/seeders/lib/role-permissions.js`.

### Cómo se protege un endpoint

```typescript
@Post()
@CheckAbility({ action: 'create', subject: 'Lead' })
create(@Body() dto: CreateLeadDto) { ... }
```

### Cómo se filtra el menú lateral

`frontend/src/lib/navigation.ts` define `subjects` por ítem. El `Sidebar` muestra solo los módulos donde el rol tiene al menos un permiso sobre alguno de esos subjects.

---

## Auditoría

- Tabla `audit_log` con hooks de Sequelize en todos los modelos auditables.
- `AuditContextInterceptor` captura el `userId` del JWT en cada request.
- Consulta vía `GET /api/v1/audit-log` (solo Admin).
- Spec: `docs/specs/spec-audit.md`.

---

## API REST

| Convención | Valor |
|------------|-------|
| Base path | `/api/v1` |
| Auth | `Authorization: Bearer <access_token>` |
| Listados | `?page=1&limit=20` → `{ items, total, page, limit }` |
| Filtros | Query params: `estado`, `segmento`, `responsable_id`, `from`, `to` |
| Errores | `{ code, message, details? }` |
| Borrado | No hay DELETE en registros de negocio; se usa soft-delete por estado |

### Endpoints activos (demand-generation)

| Método | Ruta | Acción |
|--------|------|--------|
| `GET` / `POST` | `/leads` | Listar / crear leads |
| `GET` / `PUT` | `/leads/:id` | Detalle / actualizar |
| `POST` | `/leads/:id/interactions` | Registrar interacción |
| `PUT` | `/leads/:id/checklist` | Actualizar checklist |
| `POST` | `/leads/:id/transition-to-mofu` | TOFU → MOFU |
| `POST` | `/leads/:id/transition-to-mql` | MOFU → MQL_PENDING |
| `POST` | `/leads/:id/discard` | Descartar (motivo obligatorio) |
| `POST` | `/leads/bulk-import` | Import CSV (202 async) |
| `GET` / `POST` | `/campaigns` | Campañas |
| `GET` | `/mqls` | Bandeja MQL |
| `POST` | `/mqls/:id/approve` | Aprobar → SQL |
| `POST` | `/mqls/:id/reject` | Rechazar → Reciclaje |
| `GET` | `/dashboard/marketing` | KPIs |

---

## Sistema de diseño (Verytel)

Dirección visual: **herramienta de trabajo** (estructura tipo Pipedrive), no landing page. Fondo blanco dominante, densidad de información alta en tablas y pipelines.

| Token | Valor | Uso |
|-------|-------|-----|
| `--brand-primary` | `#0033A0` | Sidebar activo, header, botones primarios |
| `--brand-turquoise` | `#2DCCD3` | Solo acento (indicadores positivos) |
| `--ink` | `#1D1D1B` | Texto principal |
| `--bg` / `--surface` | `#F5F6FA` / `#FFFFFF` | Canvas / tarjetas |
| Tipografía | Century Gothic → **Questrial** (fallback) | `Aller` solo en el logo SVG |

**Reglas:**

- Nunca hardcodear hex ni fuentes en componentes; usar clases Tailwind ligadas a `tokens.css`.
- Máximo un elemento bold por pantalla.
- Copy en español en la UI; términos de dominio sin traducir: OUV, PRE, PRI, SER, MOFU, ICP, etc.

---

## Puesta en marcha local

### Requisitos previos

- **Node.js** ≥ 20
- **MySQL** 8.x en ejecución
- **npm** (cada proyecto tiene su propio `package.json`)

### 1. Clonar y abrir

```bash
git clone <url-del-repo>
cd crm-e2e
```

Abre la **raíz del repo** en Cursor para que cargue `AGENTS.md` y `.cursor/rules/`.

### 2. Backend

```bash
cd backend
cp .env.sample .env          # Editar credenciales MySQL y JWT
npm install
npm run migration:run        # Crear tablas
npm run seed:run             # Roles + usuario admin + usuario sistema
npm run start:dev            # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env         # VITE_API_BASE_URL=/api/v1 (default con proxy)
npm install
npm run dev                  # http://localhost:5173
```

### 4. Verificar

1. Abre `http://localhost:5173/login`.
2. Inicia sesión con el usuario admin (ver [Usuarios de prueba](#usuarios-de-prueba)).
3. Navega a **Generación de demanda** → Leads.

---

## Base de datos: migraciones y seeds

```bash
cd backend

npm run migration:run        # Aplicar migraciones pendientes
npm run migration:status     # Ver estado
npm run migration:undo       # Revertir la última

npm run seed:run             # Roles + admin + system user
npm run seed:undo            # Revertir seeds
```

### Migraciones existentes

| Archivo | Contenido |
|---------|-----------|
| `20250626120000-create-auth-audit-tables` | users, roles, refresh_tokens, audit_log |
| `20250627120000-create-demand-generation-tables` | leads, campaigns, interactions |
| `20250703120000-create-demand-generation-checklist-mql-sql` | checklist, mqls, sqls |
| `20250627130000-add-referido-origen-to-leads` | Ajuste enum origen |

---

## Pruebas

```bash
cd backend

npm test                     # Unit tests (*.spec.ts)
npm run test:e2e             # E2E (auth, audit, demand-generation)
npm run test:cov             # Cobertura
```

```bash
cd frontend

npm run lint                 # ESLint
npm run build                # tsc + vite build (verifica tipos)
```

Los tests e2e de demand-generation validan criterios EARS (DG-01 a DG-15).

---

## Convenciones del proyecto

| Tema | Regla |
|------|-------|
| **Idioma del código** | Inglés (identificadores, comentarios, commits) |
| **Términos de dominio** | Español sin traducir: OUV, PRE, PRI, SER, Preventa, Pricing, MOFU, ICP, RFS, RFB, WinRate, ChurnRate |
| **Secretos** | Solo en `.env`; nunca en código ni en Git |
| **Fronteras de módulo** | Un servicio público + DTOs por módulo; sin imports cruzados de internals |
| **Escrituras** | Siempre auditadas |
| **Consecutivos** | Inmutables una vez emitidos; generación atómica |
| **UI** | Tokens Verytel; sin hex hardcodeado |
| **Specs** | EARS antes del código en módulos core |

Documentación de reglas detallada: `.cursor/rules/` (numeradas 000–700).

---

## Especificaciones (EARS)

| Spec | Módulo | Versión |
|------|--------|---------|
| `docs/specs/spec-auth.md` | auth | — |
| `docs/specs/spec-audit.md` | audit | — |
| `docs/specs/spec-demand-generation.md` | demand-generation | v2.0 |

Formato EARS: requisitos **ubicuos**, **basados en evento**, **basados en estado**, **comportamiento no deseado** y **opcionales**. Cada criterio tiene ID (ej. `DG-12`) y un test asociado.

---

## Usuarios de prueba

> Solo para entorno local. Las credenciales del admin vienen de `backend/.env` (seeder).

| Rol | Email | Contraseña (default en `.env.sample`) |
|-----|-------|---------------------------------------|
| **Admin** | `admin@verytel.local` | `ChangeMe123!` |

Otros usuarios de negocio (`DirectorMercadeo`, `GestorMercadeo`, etc.) se crean desde **Admin → Usuarios** asignando el rol correspondiente.

### Si ves `Insufficient permissions`

Significa que el rol del usuario **no tiene** el permiso CASL (`action` + `subject`) que exige el endpoint. Soluciones:

1. Inicia sesión con un rol que sí tenga permiso (ej. `GestorMercadeo` para crear/editar leads).
2. Verifica la matriz en `backend/database/seeders/lib/role-permissions.js`.
3. Desde Admin, revisa los permisos del rol en la UI de roles.
4. Tras cambiar permisos en BD, **cierra sesión y vuelve a entrar** para refrescar el JWT.

---

## Estado actual del desarrollo

| Área | Estado |
|------|--------|
| Auth (login, JWT, usuarios, roles, CASL) | Listo |
| Audit (hooks + consulta) | Listo |
| Demand-generation (leads, campañas, MQL, dashboard) | Listo |
| Leads UI (lista + kanban guiado + excepciones) | Listo |
| Qualification → Post-sales (7 módulos) | Scaffold + placeholders |
| Dashboards analíticos avanzados | Wave 2 (octubre) |
| Integración ERP / migración Pipedrive | Wave 2 (octubre) |

---

## Recursos adicionales

- **Constitución del proyecto:** `AGENTS.md`
- **Reglas Cursor:** `.cursor/rules/`
- **README por módulo:** `backend/src/modules/<modulo>/README.md` y `frontend/src/modules/<modulo>/README.md`

---

## Iniciar la aplicación

Requisitos: **Node.js ≥ 20** y **MySQL 8.x** en ejecución. Setup completo (`.env`, migraciones, seeds) en [Puesta en marcha local](#puesta-en-marcha-local).

Usa **dos terminales** — backend y frontend son proyectos independientes.

### Primera vez

**Terminal 1 — Backend**

```bash
cd backend
cp .env.sample .env          # Editar credenciales MySQL y JWT
npm install
npm run migration:run
npm run seed:run
npm run start:dev            # http://localhost:3000
```

**Terminal 2 — Frontend**

```bash
cd frontend
cp .env.example .env         # VITE_API_BASE_URL=/api/v1 (default con proxy)
npm install
npm run dev                  # http://localhost:5173
```

### Uso diario

**Terminal 1 — Backend**

```bash
cd backend
npm run start:dev
```

**Terminal 2 — Frontend**

```bash
cd frontend
npm run dev
```

### URLs

| Servicio | URL |
|----------|-----|
| Frontend | http://localhost:5173 |
| Login | http://localhost:5173/login |
| API | http://localhost:3000/api/v1 |

En desarrollo, Vite hace proxy de `/api/v1` → `http://localhost:3000`. Credenciales de prueba en [Usuarios de prueba](#usuarios-de-prueba).
