# Spec — Módulo Auth (login, usuarios, roles, permisos)

**Módulo:** `auth` (plataforma) · **Sprint:** 1 · **Estado:** borrador para validar en taller de reglas (T0/Auth)
**Stack:** NestJS + REST · Sequelize (`sequelize-typescript`) · MySQL · JWT + refresh · RBAC con CASL
**Idioma:** código/identificadores en inglés · términos de dominio en español (KAM, Preventa, Pricing…)

> Notación EARS. Cada criterio tiene un id (EARS-AUTH-##) y debe tener al menos un test (regla 500-testing).

---

## 1. Propósito y alcance

Proveer autenticación y autorización para todo el CRM. Es la base: casi todas las tablas referencian
`users` (created_by, responsable_id, usuario_id), por eso este módulo se construye primero.

**En alcance:** registro/gestión de usuarios por un admin, login, JWT + refresh, RBAC granular por
recurso/acción con CASL, bloqueo por intentos fallidos.
**Fuera de alcance (otros módulos/olas):** SSO/Microsoft 365 (futuro), recuperación de contraseña por
email (depende de servicio de correo — posterior), portal externo del Cliente.

---

## 2. Entidades

### 2.1 `users`
| Campo | Tipo | Regla |
|---|---|---|
| user_id | CHAR(36) PK | UUID v4 |
| email | VARCHAR(180) | único, formato RFC 5321 |
| password_hash | VARCHAR(255) | bcrypt/argon2; nunca se devuelve |
| full_name | VARCHAR(120) | obligatorio |
| role_id | CHAR(36) FK→roles | obligatorio |
| is_active | BOOLEAN | default true |
| failed_login_attempts | SMALLINT | default 0 |
| locked_until | TIMESTAMP NULL | bloqueo temporal |
| last_login_at | TIMESTAMP NULL | — |
| created_at / updated_at / deleted_at | TIMESTAMP | UTC; soft-delete (paranoid) |

### 2.2 `roles`
| Campo | Tipo | Regla |
|---|---|---|
| role_id | CHAR(36) PK | UUID v4 |
| name | VARCHAR(60) | único (ver lista §3) |
| description | VARCHAR(160) | — |
| permissions | JSON | reglas CASL (subject/action/conditions) |
| is_system | BOOLEAN | roles base no se borran |

### 2.3 `refresh_tokens`
| Campo | Tipo | Regla |
|---|---|---|
| token_id | CHAR(36) PK | UUID v4 |
| user_id | CHAR(36) FK→users | — |
| token_hash | VARCHAR(255) | hash del refresh token |
| expires_at | TIMESTAMP | — |
| revoked_at | TIMESTAMP NULL | logout / rotación |

---

## 3. Roles (9 actores del Blueprint + admin)

`Admin`, `DirectorMercadeo`, `GestorMercadeo`, `EjecutivoComercial` (KAM),
`SoporteComercial`, `Preventa`, `Pricing`, `PMO`, `FyA`, `Cliente` (externo, acceso limitado — futuro).

### 3.1 Matriz RBAC — BORRADOR a validar con negocio (taller T0/Auth)
Acciones: C=crear R=ver U=editar A=aprobar X=cerrar/declarar. "—" = sin acceso.

| Recurso \ Rol | Admin | DirMkt | GestMkt | KAM | Soporte | Preventa | Pricing | PMO | F&A |
|---|---|---|---|---|---|---|---|---|---|
| users/roles | CRUA | — | — | — | — | — | — | — | — |
| leads/campaigns | R | CRUA | CRU | R | R | — | — | — | — |
| opportunities (OUV) | R | R | — | CRUX | CRU | R | R | — | — |
| presales (PRE) | R | — | — | R | R | CRUA | R | — | — |
| pricing (PRI) | R | — | — | R | R | R | CRUA | — | — |
| proposals/contracts | R | — | — | CRU | CRUA | R | R | — | — |
| services (SER) | R | — | — | R | R | R | — | CRUAX | R |
| billing (Ola 2) | R | — | — | — | R | — | — | R | CRUA |
| post-sales | R | — | — | R | CRU | — | — | R | — |
| audit-log | R | — | — | — | — | — | — | — | — |

> Esta matriz es una propuesta inicial razonable derivada del Blueprint. Debe ser **firmada por negocio**
> antes de considerarse definitiva. Cargarla como `roles.permissions` (CASL) y poder ajustarla sin recompilar.

---

## 4. Requisitos EARS

### Autenticación
- **EARS-AUTH-01 (Event):** Cuando un usuario envía email y contraseña válidos a `POST /api/v1/auth/login`,
  el sistema deberá responder 200 con un access token (JWT) y un refresh token.
- **EARS-AUTH-02 (Unwanted):** Si las credenciales son inválidas, entonces el sistema deberá responder 401
  sin revelar si el email existe.
- **EARS-AUTH-03 (Ubiquitous):** El sistema deberá almacenar las contraseñas solo como hash (bcrypt/argon2),
  nunca en texto plano, y nunca devolver `password_hash` en ninguna respuesta.
- **EARS-AUTH-04 (State):** Mientras `is_active = false`, el sistema deberá impedir el login del usuario y responder 403.

### Bloqueo por intentos
- **EARS-AUTH-05 (Event):** Cuando un usuario falla el login, el sistema deberá incrementar `failed_login_attempts`.
- **EARS-AUTH-06 (Unwanted):** Si `failed_login_attempts` alcanza 5, entonces el sistema deberá fijar
  `locked_until = now + 15 min` y rechazar logins hasta que expire.
- **EARS-AUTH-07 (Event):** Cuando un login es exitoso, el sistema deberá reiniciar `failed_login_attempts` a 0
  y actualizar `last_login_at`.

### Ciclo de tokens
- **EARS-AUTH-08 (Ubiquitous):** El access token (JWT) deberá expirar según `JWT_EXPIRES_IN` (15m) e incluir
  `user_id` y `role`.
- **EARS-AUTH-09 (Event):** Cuando se llama `POST /api/v1/auth/refresh` con un refresh token válido y no revocado,
  el sistema deberá emitir un nuevo access token y rotar el refresh token (revocar el anterior).
- **EARS-AUTH-10 (Event):** Cuando se llama `POST /api/v1/auth/logout`, el sistema deberá revocar el refresh token del usuario.
- **EARS-AUTH-11 (Unwanted):** Si un refresh token está revocado o expirado, entonces el sistema deberá responder 401.

### Autorización (RBAC / CASL)
- **EARS-AUTH-12 (Ubiquitous):** El sistema deberá proteger toda ruta de negocio con un guard que exija JWT válido;
  por defecto, denegar (deny-by-default).
- **EARS-AUTH-13 (Event):** Cuando un usuario solicita una acción sobre un recurso, el sistema deberá autorizarla
  con CASL según `roles.permissions`; si no está permitida, responder 403.
- **EARS-AUTH-14 (Optional):** Donde un permiso tenga condición (p. ej. "solo oportunidades propias"), el sistema
  deberá evaluar la condición sobre el recurso antes de permitir la acción.

### Gestión de usuarios (admin)
- **EARS-AUTH-15 (Event):** Cuando un Admin crea un usuario, el sistema deberá exigir email único, role_id válido
  y generar el registro con contraseña hasheada.
- **EARS-AUTH-16 (Unwanted):** Si se intenta crear un usuario con un email ya existente, entonces el sistema deberá responder 409.
- **EARS-AUTH-17 (State):** Mientras el actor no tenga rol Admin, el sistema deberá impedir cualquier operación sobre `users` o `roles`.

### Auditoría (enlace con módulo audit)
- **EARS-AUTH-18 (Ubiquitous):** El sistema deberá registrar en `audit_log` los eventos LOGIN, logout, creación/edición
  de usuarios y cambios de rol (ver spec-audit).

---

## 5. Endpoints REST
| Método | Ruta | Acción | Rol |
|---|---|---|---|
| POST | /api/v1/auth/login | login | público |
| POST | /api/v1/auth/refresh | renovar token | autenticado |
| POST | /api/v1/auth/logout | revocar | autenticado |
| GET | /api/v1/auth/me | perfil actual | autenticado |
| GET | /api/v1/users | listar | Admin |
| POST | /api/v1/users | crear | Admin |
| PUT | /api/v1/users/{id} | editar / activar-desactivar | Admin |
| GET | /api/v1/roles | listar | Admin |
| PUT | /api/v1/roles/{id} | editar permisos | Admin |

## 6. Definition of Done
- Modelos `users`, `roles`, `refresh_tokens` + migración que crea las tablas en MySQL.
- Login, refresh, logout, guards JWT y autorización CASL funcionando.
- Roles base sembrados (seed) con la matriz §3.1.
- Todos los criterios EARS-AUTH-## con test que pasa.
- Toda escritura pasa por la ruta auditada (spec-audit).
