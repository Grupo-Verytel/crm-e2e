# 2026-10-20 — El rol Gerente Comercial ya existe en `roles`

Estado: aprobada con el Paso 0 (2026-10-20). Q1=A, Q2=B limitado, Q3=B, Q4=A, Q5=A, Q6 nueva. No crea ni renombra el rol.

## D1 — Fila existente, nombre con espacio

El prompt habla de `GerenteComercial`. En este ambiente el nombre real es **`Gerente Comercial`** (con espacio).

| Dónde | Resultado |
|---|---|
| Tabla `roles` (MySQL de `backend/.env`, base `crm_e2e`) | Fila `role_id` `c306c9d3-1a8c-470a-8eb3-4c2f80abbaa9`, `name` = `Gerente Comercial`, `description` null, `is_system` = 1, `is_active` = 1. |
| `backend/database/seeders/lib/role-permissions.js` `BASE_ROLES` (`:134-183`) | No está. |
| Migraciones y seeders del repo | Ninguna inserta ese nombre. |
| `docs/specs/spec-auth.md:59-62` | No está. |
| `AGENTS.md` §4 | No lo lista. El DR `2026-10-18-cuenta-alto-valor.md:23-25` dice que no existe. Ese dato era cierto para el catálogo de código y es falso para la tabla `roles` de este ambiente. |
| Frontend | Ningún archivo compara el nombre del rol. |

`UsersService.findActiveByRoleName` compara `roles.name` exacto (`users.service.ts:47-51`). Hay que usar `Gerente Comercial`, no `GerenteComercial`. `canReadAllOuvs` compacta espacios (`ouv-access.ts:10-22`), así que las dos grafías ya devuelven verdadero en el test (`ouv-access.spec.ts:12-13`). Eso no siembra el rol.

Hay otras filas distintas que no son este rol: `Gerente Operaciones`, `Gerente PMO`, `Gerente Preventa`, `Gerente Producto` y `KAM`. No se tocan.

## D1 — Acceso que se conserva

`roles.permissions` de esta fila no se edita en este cambio, salvo que el Paso 0 apruebe un permiso que hoy no está (pregunta Q3 del resumen). No entra a `BASE_ROLES`. No hay migración de alta de rol.

El Artículo VI.1 de `CONSTITUTION.md` prohíbe que un spec o un seed introduzca un rol nuevo. Esta decisión no lo introduce: usa la fila que ya está. El Artículo II manda cuando el prompt (`GerenteComercial`) choca con la tabla (`Gerente Comercial`).

## D1 — `manage_high_value` (Q3=B)

La fila no tenía `{ action: 'manage_high_value', subject: 'Account' }`. Evilio aprobó agregarla. Una migración de datos re-ejecutable inserta solo esa regla en la fila cuyo `name` es la constante del rol. El `down` quita solo esa regla. Si la fila no existe, la migración lo registra y termina bien: no crea el rol.

El tooltip del checkbox pasa a: «Solo Soporte Comercial, Administrador o Gerente Comercial pueden cambiar esta marca.»

## D-NOMBRE — Una constante

El texto `Gerente Comercial` vive en un solo módulo del backend. Las comparaciones importan esa constante. No se repite el literal.

## D-ME — Default de bandeja y alta directa (Q1=A)

`GET /auth/me` calcula `ouv_board_default`: `'own'` solo para este rol, `'all'` para los demás. `can_create_direct_ouv` es verdadero para `EjecutivoComercial` y para este rol. El frontend no compara nombres de rol.

## D-GUARD — Ampliación de acceso aprobada (Q2=B limitado)

Evilio aprobó que los guards `sql.cita_reagendada`, `sql.convertido_ouv`, `sql.descartado`, `ouv.creada_directa`, `ouv.avance_zona` y `ouv.retroceso_zona` acepten a este rol **solo cuando el actor es el comercial asignado** de esa OUV o de ese SQL. No puede actuar sobre las de otro. Esto amplía lo que el rol puede hacer hoy. El resto de su matriz no cambia, salvo Q3.

## D-ASIGNACION — Catálogos (Q4=A)

`GET /discovery/ouvs/ejecutivos-comerciales`, `GET /leads/appointment-commercials` y las validaciones de reasignar OUV, asignar SQL, cita de SQL y cita de lead aceptan activos de `EjecutivoComercial` y de este rol. El duplicado `GET /discovery/ejecutivos-comerciales` no se toca. Queda en deuda.

## D-CSV — Filtro aplicado (Q5=A)

El CSV de `/opportunities` usa el filtro aplicado, incluido el default «yo», para todo rol que puede filtrar. El CSV de Soporte también deja de ignorar el filtro.

## D-LECTURA — Bitácora (Q6)

`canReadOuv` permite a este rol leer interacciones y recordatorios de cualquier OUV. La escritura en OUV ajena no cambia.

## D-DEUDA — Catálogo de código

El rol vive solo en la tabla `roles`. En el Paso 3 se propone, en un decision record aparte, agregarlo a `BASE_ROLES` con los permisos que tenga entonces. Este cambio no lo hace.

Antes de desplegar hay que verificar en cada ambiente que la fila exista, con este nombre exacto, y qué usuarios la tienen. Si no existe o el nombre es distinto, se detiene el despliegue.
