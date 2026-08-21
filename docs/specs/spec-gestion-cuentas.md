# spec-gestion-cuentas.md

**Versión:** 0.4 — APROBADO (2026-08-10)
**Módulo Nest/FE:** `accounts` (adelanto acotado de Módulo 12) — reabierto a Wave 1 por `2026-08-DR-unificacion-contactos-cuentas-wave1.md`
**Decision records de origen:** `2026-08-DR-unificacion-contactos-cuentas-wave1.md`, `2026-08-DR-convencion-nombres-ingles.md`, `2026-08-DR-accounts-por-lead.md`, `2026-08-DR-auto-poblar-ouv-account-id.md`

> Aprobado por el arquitecto tras `speckit-clarify` + resolución de inconsistencias de `speckit-analyze` (2026-08-10).

---

## 1. Contexto

Este spec construye la versión mínima de gestión de empresas/contactos: tablas `accounts` y `people` (nombres en inglés, por `2026-08-DR-convencion-nombres-ingles.md`), con administración propia — separada del formulario de lead/OUV — en el módulo Nest/FE **`accounts`**.

**FK en `ouvs`:** la columna **`ouvs.account_id`** (inglés) es **nueva** (no existía en el repo; la migración funnel la había diferido). Se agregará al implementar GC-13 en discovery/calificación — **fuera del prompt GC-01…11**. Apunta a `accounts.account_id`. UI en español.

## 2. Modelo de datos

### 2.1 Tabla `accounts` (nueva)

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| account_id | UUID | Sí | PK |
| name | VARCHAR(160) | Sí | Parte de la clave de unicidad (case-insensitive) |
| tax_id | VARCHAR(20) | No | Texto libre en Wave 1 — sin validación de formato NIT/DIAN |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | Sí (deleted_at no) | Soft-delete estándar del proyecto |

**Unicidad (Wave 1) — dos reglas (GC-04):**
1. Combinación `name` (case-insensitive) + `tax_id`: mismo nombre con el mismo `tax_id` (incluido ambos `NULL`) = duplicado rechazado. Mismo nombre con NIT distinto = cuentas distintas.
2. Cuando `tax_id` viene **informado**, debe ser **único por sí solo** entre `accounts` no soft-deleted (independiente del `name`) — evita duplicados por NIT con razón social escrita distinto (ej. "Constructora ABC S.A.S." vs "Constructora ABC SAS").

En MySQL el UNIQUE compuesto no bloquea múltiples `NULL` en `tax_id` → la unicidad con `tax_id` NULL (regla 1) se **refuerza en servicio**. Para la regla 2: UNIQUE parcial / índice único sobre `tax_id` donde no es NULL, o chequeo en servicio.

### 2.2 Tabla `people` (nueva)

| Campo | Tipo | Oblig. | Notas |
|---|---|---|---|
| person_id | UUID | Sí | PK |
| name | VARCHAR(120) | Sí | — |
| job_title | VARCHAR(80) | No | — |
| email | VARCHAR(180) | No | RFC 5321; unicidad global cuando informado |
| phone | VARCHAR(20) | No | E.164 |
| account_id | UUID | Sí | FK `accounts.account_id` — obligatorio; **inmutable tras el alta** |
| created_at / updated_at / deleted_at | TIMESTAMPTZ | Sí (deleted_at no) | Soft-delete estándar del proyecto |

**Unicidad de email (Wave 1):** cuando `email` está informado, UNIQUE global entre `people` no soft-deleted. `NULL`/vacío puede repetirse (UNIQUE parcial o validación en servicio).

## 3. Criterios EARS — Administración de `accounts` (GC-01…06 — alcance prompt Wave 1a)

**GC-01.** El sistema DEBE exponer un menú "Empresas" independiente del formulario de creación de lead/OUV.

**GC-02.** CUANDO un usuario autenticado (cualquier rol) crea una `account`, el sistema DEBE persistirla si cumple unicidad §2.1 y registrar el alta en `audit_log`.

**GC-03.** CUANDO un usuario intenta crear una `account`, el sistema DEBE permitir buscar primero si ya existe (por `name` y/o `tax_id`) antes de confirmar la creación.

**GC-04.** SI se intenta crear o actualizar una `account`, el sistema DEBE rechazar la operación sin guardar cuando ocurra cualquiera de estas condiciones sobre registros no soft-deleted:
1. Ya existe otra `account` con la misma combinación `name` (case-insensitive) + `tax_id` (incluido ambos `NULL`).
2. `tax_id` viene informado y ya existe otra `account` con el mismo `tax_id`, **aunque el `name` sea distinto**.

**GC-05.** CUANDO un usuario autenticado (cualquier rol) edita `name` o `tax_id` de una `account`, el sistema DEBE aplicar GC-04 y registrar el cambio en `audit_log`.

**GC-06.** CUANDO `SoporteComercial` solicita soft-delete de una `account`, el sistema DEBE rechazar la operación SI existen `people` no soft-deleted con ese `account_id`; SI no hay, DEBE marcar `deleted_at` y registrar en `audit_log`. Otros roles NO DEBEN poder soft-deletear `accounts`.

## 4. Criterios EARS — Administración de `people` (GC-07…11 — alcance prompt Wave 1a)

**GC-07.** El sistema DEBE exponer un menú "Contactos" independiente del formulario de lead/OUV y del menú "Empresas".

**GC-08.** CUANDO un usuario autenticado (cualquier rol) crea un `person`, el sistema DEBE exigir `account_id` y rechazar el alta si falta; DEBE persistir y registrar en `audit_log`.

**GC-09.** SI se intenta crear o actualizar un `person` con `email` informado que ya existe en otro `person` no soft-deleted, ENTONCES el sistema DEBE rechazar la operación.

**GC-10.** CUANDO un usuario autenticado (cualquier rol) edita un `person`, el sistema DEBE permitir cambiar solo `name`, `job_title`, `email` y `phone`. El sistema NO DEBE permitir cambiar `account_id` tras el alta (corregir empresa = crear otro `person`).

**GC-11.** CUANDO `SoporteComercial` solicita soft-delete de un `person`, el sistema DEBE rechazar la operación SI existen filas activas en `lead_contacts` o `ouv_contactos` que referencien ese `person_id`; SI no hay, DEBE marcar `deleted_at` y registrar en `audit_log`. Otros roles NO DEBEN poder soft-deletear `people`.

> **Nota GC-11 en Wave 1a:** mientras `lead_contacts`/`ouv_contactos` aún no tengan `person_id` en el repo, el soft-delete solo verifica referencias cuando la columna/FK exista; si no existe, no hay referencias que bloquear. No reestructurar esas tablas en este prompt.

## 5. Consumo desde otros módulos

### 5.1 Contratos que este módulo expone

- API/servicio público de `accounts` para crear/buscar/editar/soft-delete `accounts` y `people`.
- `lead_contacts.person_id` / `ouv_contactos.person_id` — consumo en prompts posteriores (demand-generation / discovery).
- `ouvs.account_id` — columna nueva; se agrega y puebla en prompts de discovery/calificación (GC-13).

### 5.2 Reglas diferidas a prompts de módulos vecinos (NO implementar en Wave 1a)

**GC-12** *(fuente: `2026-08-DR-accounts-por-lead.md`; EARS-40..42 ya en `spec-demand-generation.md`)*. Un lead = una `account`; rechazo si el `person` no coincide.

**GC-13** *(fuente: `2026-08-DR-auto-poblar-ouv-account-id.md`)*. CUANDO se crea una OUV desde SQL (Vía 1), el sistema DEBE setear `ouvs.account_id` = `account_id` del `person` del contacto principal (`lead_contacts.position = 1`). En creación directa, `account_id` permanece nullable / seleccionable; no obligatorio en Wave 1.

## 6. Fuera de alcance (Wave 1)

- Jerarquía de cuentas padre/hijas.
- Indicadores de salud de cuenta / historial a nivel de cuenta.
- Validación de formato NIT / dígito DIAN.
- Fusión de `people` o cambio de `account_id` post-alta.
- Reestructurar `lead_contacts` / `ouv_contactos` (prompts vecinos).
- Agregar/poblar `ouvs.account_id` (GC-13 — prompts discovery/calificación).
- Recalcular `ouvs.account_id` tras conversión (sin sync automática).

## 7. Dependencias

- **Bloquea (después de Wave 1a):** flujos de contacto en demand-generation / calificación / ouv-funnel.
- **Depende de:** auth (JWT + CASL), audit (hooks/`audit_log`).
- **Módulo:** `backend/src/modules/accounts` y `frontend/src/modules/accounts`.

---

## Checklist

- [x] `speckit-clarify` cerrado
- [x] Aprobación explícita del arquitecto (2026-08-10)
- [x] `ouvs.account_id` (no `cuenta_id`) — columna nueva en inglés
- [x] Módulo Nest/FE = `accounts`
- [x] Alcance prompt Wave 1a = GC-01…11 solamente
- [x] EARS-40..42 en `spec-demand-generation.md` (GC-12)
- [x] GC-13 documentado en ouv-funnel / calificacion (implementación diferida)
