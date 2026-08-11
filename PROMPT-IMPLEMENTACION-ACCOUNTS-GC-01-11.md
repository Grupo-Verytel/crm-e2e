# PROMPT — Implementación Wave 1a: módulo `accounts` (GC-01…11)

**Copia/pega este bloque completo en Cursor Agent.**  
**Spec:** `docs/specs/spec-gestion-cuentas.md` v0.4 (APROBADO)  
**Alcance:** solo GC-01…11 (tablas + CRUD + menús Empresas/Contactos).  
**Fuera de este prompt:** GC-12, GC-13, `ouvs.account_id`, reestructurar `lead_contacts`/`ouv_contactos`, formularios lead/OUV.

---

## Rol

Eres el implementador backend→frontend del CRM Frisson (`crm-e2e`). Stack fijo: NestJS 11 + Sequelize + MySQL + React 19 + Vite + Tailwind 4 + lucide-react. Sin TanStack Query/Table, SWR, Zustand, Redux, CVA, clsx, tailwind-merge, Radix, shadcn.

Lee antes de tocar código: `CONSTITUTION.md`, `AGENTS.md`, `docs/specs/spec-gestion-cuentas.md` v0.4, `docs/specs/decisions/2026-08-DR-convencion-nombres-ingles.md`, `.cursor/rules/100-backend-nestjs.mdc`, `300-sequelize-audit.mdc`, `700-modules.mdc`, `200-frontend-react.mdc`, `600-ui-design.mdc`.

## Objetivo

Crear el módulo **`accounts`** (Nest + React) que administra maestros `accounts` y `people` según GC-01…11.

## Orden de trabajo (gates internos)

1. Models → migración → DTOs → services → controllers (backend).  
2. Registrar `AccountsModule` en `app.module.ts`.  
3. Frontend: `frontend/src/modules/accounts` + nav + rutas.  
4. Al cerrar: escribir `RESUMEN-PASO-ACCOUNTS-GC-01-11.md` en la raíz.

No saltes a frontend antes de que el backend compile y las migraciones corran en local.

## Backend — módulo `backend/src/modules/accounts`

Estructura estándar: `accounts.module.ts`, `controllers/`, `services/`, `models/`, `dtos/`. Exportar **un** servicio público (p. ej. `AccountsService`) para que otros módulos lo inyecten después; no exponer modelos.

### Modelos

**`accounts`**
- PK `account_id` CHAR(36) UUID
- `name` VARCHAR(160) NOT NULL
- `tax_id` VARCHAR(20) NULL
- timestamps + `deleted_at` (`paranoid: true`)

**`people`**
- PK `person_id` CHAR(36) UUID
- `name` VARCHAR(120) NOT NULL
- `job_title` VARCHAR(80) NULL
- `email` VARCHAR(180) NULL
- `phone` VARCHAR(20) NULL
- `account_id` CHAR(36) NOT NULL FK → `accounts.account_id`
- timestamps + `deleted_at` (`paranoid: true`)

Índices: FK `people.account_id`; búsqueda por `accounts.name`, `accounts.tax_id`, `people.email`, `people.name`.

### Unicidad (servicio + DB donde sea posible)

- **Accounts (GC-04) — dos chequeos obligatorios en create/update:**
  1. Combinación `LOWER(name)` + `tax_id`. Si ambos `tax_id` son NULL, dos cuentas con el mismo `name` (case-insensitive) = duplicado → **rechazar en servicio** (MySQL UNIQUE no bloquea múltiples NULL).
  2. Si `tax_id` viene **informado**, debe ser **único por sí solo** entre `accounts` no soft-deleted (independiente del `name`). Ejemplo a cubrir: "Constructora ABC S.A.S." y "Constructora ABC SAS" con el mismo NIT → el segundo alta se rechaza. Preferir UNIQUE parcial / índice único donde `tax_id IS NOT NULL`, o validación equivalente en servicio.
- **People email (GC-09):** si `email` informado, único entre no soft-deleted (índice único parcial o chequeo en servicio).

`tax_id`: texto libre, sin validación NIT/DIAN (la unicidad es por igualdad exacta del string almacenado, no por normalización DIAN).

### API REST (propuesta; prefijo `/accounts`)

Autenticación JWT en todos. CASL subjects: `Account`, `Person`.

| Método | Ruta | Quién | Criterio |
|---|---|---|---|
| GET | `/accounts?q=&page=&limit=` | cualquier autenticado | listar/buscar por name/tax_id (GC-03) |
| GET | `/accounts/:accountId` | cualquier autenticado | detalle |
| POST | `/accounts` | cualquier autenticado | crear (GC-02) |
| PATCH | `/accounts/:accountId` | cualquier autenticado | editar name/tax_id (GC-05) |
| DELETE | `/accounts/:accountId` | solo `SoporteComercial` | soft-delete restringido (GC-06) |
| GET | `/accounts/people?q=&account_id=&page=&limit=` | cualquier autenticado | listar/buscar people |
| GET | `/accounts/people/:personId` | cualquier autenticado | detalle |
| POST | `/accounts/people` | cualquier autenticado | crear con `account_id` obligatorio (GC-08) |
| PATCH | `/accounts/people/:personId` | cualquier autenticado | solo name, job_title, email, phone — **nunca** `account_id` (GC-10) |
| DELETE | `/accounts/people/:personId` | solo `SoporteComercial` | soft-delete restringido (GC-11) |

Soft-delete:
- Account: rechazar si hay `people` activos con ese `account_id`.
- Person: rechazar si existen filas activas en `lead_contacts` u `ouv_contactos` con `person_id`. **Hoy esas columnas no existen en el repo** → si la columna `person_id` no está en el modelo/tabla, no hay referencias que bloquear; no inventes la reestructuración aquí.

Auditoría: usar el mecanismo central de `audit` (hooks), no escribir filas a mano en el service.

RBAC soft-delete: además de CASL `delete` solo para roles SoporteComercial (y seed/migración de permisos), validar en service el rol/permiso.

### CASL / seeds de roles

Agregar subjects `Account` y `Person`:
- Todos los roles autenticados existentes: `create`, `read`, `update` sobre ambos.
- Solo `SoporteComercial`: también `delete` sobre ambos.
- Actualizar seeds/migraciones de permisos del módulo auth como ya se hace para Lead/Opportunity.

### NO hacer en este prompt

- No agregar `ouvs.account_id`.
- No tocar `lead_contacts` ni `ouv_contactos` (ni `person_id`).
- No implementar GC-12 ni GC-13.
- No cambiar formularios de lead/OUV.
- No jerarquía de cuentas, salud, historial, fusión de people.

## Frontend — `frontend/src/modules/accounts`

- Menú plataforma (o comercial, según quede más limpio con el sidebar actual): ítems **"Empresas"** y **"Contactos"** (GC-01, GC-07).
- Actualizar `frontend/src/lib/navigation.ts` con subjects `Account` / `Person`.
- Rutas lazy bajo p. ej. `/accounts/empresas` y `/accounts/contactos`.
- Listas: patrón draft/applied + `Pagination.tsx` + `<table>` nativo (como Leads).
- Crear account: búsqueda previa por name/tax_id antes de confirmar (GC-03).
- Crear person: selector/búsqueda de account obligatoria; no guardar sin `account_id`.
- Editar person: no mostrar campo editable de empresa/`account_id`.
- Soft-delete: visible solo si el usuario puede `delete` (SoporteComercial).
- Tokens Verytel (`tokens.css`); sin hex hardcodeados; UI en español.
- API vía `apiRequest()` en `frontend/src/modules/accounts/api/`.

## Condiciones de parada (STOP)

Si ocurre cualquiera, detente, escribe `NOTAS-BLOQUEO-ACCOUNTS-1.md` y espera:

- **R1:** El repo ya tiene tablas/modelos `accounts`/`people` con otro esquema incompatible.
- **R2:** No hay forma clara de seedear permisos CASL para nuevos subjects sin romper roles existentes.
- **R3:** Soft-delete de `people` requiere columnas `person_id` en puentes que el prompt prohíbe crear — documenta el comportamiento implementado (skip check) y continúa solo si es exactamente el caso “columna ausente → no bloquea”.
- **R4:** Conflicto con Article II: código existente contradice el spec v0.4 en un punto no cubierto arriba.
- **R5:** Migración falla en MySQL local y no hay fix seguro sin `sync({ force })`.
- **R6:** Se pide implícitamente implementar GC-12/13 u `ouvs.account_id` — rechaza y documenta.
- **R7:** Librería no permitida parece “necesaria” — no la agregues; documenta.
- **R8:** Ambigüedad de UX de menú (dónde cuelga Empresas/Contactos) que bloquea navegación — pregunta al arquitecto.
- **R9:** Tests e2e existentes rompen de forma no relacionada y el fix sale del alcance.

## Criterios de hecho (Definition of Done)

- [ ] Migración crea `accounts` y `people` con soft-delete.
- [ ] Endpoints anteriores funcionan con JWT + CASL.
- [ ] Unicidad GC-04 (combinación name+tax_id **y** tax_id solo cuando informado) + GC-09 cubiertas (servicio + índice razonable).
- [ ] Soft-delete restringido GC-06/GC-11 + solo SoporteComercial.
- [ ] `account_id` de person inmutable en PATCH.
- [ ] Menús Empresas y Contactos en UI con list/search/create/edit.
- [ ] `AccountsModule` exporta servicio público; sin deep imports.
- [ ] `RESUMEN-PASO-ACCOUNTS-GC-01-11.md` escrito.
- [ ] Sin cambios a `ouvs`, `lead_contacts`, `ouv_contactos` salvo lectura opcional defensiva para GC-11.

## Al terminar

No abras PR ni hagas commit a menos que el usuario lo pida. Entrega el resumen y la lista de archivos tocados.
