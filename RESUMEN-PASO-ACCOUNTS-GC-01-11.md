# RESUMEN-PASO-ACCOUNTS-GC-01-11

**Fecha:** 2026-08-10  
**Estado:** completado — Wave 1a GC-01…11  
**Spec:** `docs/specs/spec-gestion-cuentas.md` v0.4  
**Prompt:** `PROMPT-IMPLEMENTACION-ACCOUNTS-GC-01-11.md`

---

## Qué se hizo

### Backend — módulo `accounts`

| Pieza | Ruta |
|---|---|
| Models | `backend/src/modules/accounts/models/{account,person}.model.ts` |
| Service público | `backend/src/modules/accounts/services/accounts.service.ts` (exportado) |
| Controllers | `accounts.controller.ts`, `people.controller.ts` (`/accounts/people` registrado primero) |
| Module | `accounts.module.ts` → importado en `app.module.ts` |
| Migración tablas | `20260810180000-create-accounts-people.js` |
| Migración CASL | `20260810180100-add-account-person-permissions.js` |
| Seed matrix | `database/seeders/lib/role-permissions.js` — subject group `accounts` |

**GC-04:** unicidad en servicio — (1) `LOWER(name)+tax_id` incl. ambos NULL; (2) `tax_id` informado único solo. Sin UNIQUE DB por soft-delete.  
**GC-09:** email informado único en servicio.  
**GC-06/11:** soft-delete restringido; CASL `delete` solo `SoporteComercial`.  
**GC-11 / R3:** `person_id` aún no existe en `lead_contacts`/`ouv_contactos` → el chequeo consulta `information_schema` y **no bloquea** si la columna falta.

### Frontend

- Menús plataforma **Empresas** / **Contactos** (`navigation.ts`)
- Rutas `/accounts/empresas`, `/accounts/contactos`
- Listas draft/applied + `Pagination` + tablas nativas
- Crear empresa: botón “Buscar si ya existe” (GC-03)
- Crear contacto: empresa obligatoria; editar no permite cambiar `account_id` (GC-10)
- Eliminar visible solo con permiso `delete`

### Fuera de alcance (cumplido)

Sin `ouvs.account_id`, sin reestructurar `lead_contacts`/`ouv_contactos`, sin GC-12/13.

---

## Cómo probar

1. Migraciones ya corridas en local (`db:migrate` OK).
2. **Re-login** (o refresh de sesión) para cargar permisos `Account`/`Person` en el JWT/me.
3. Abrir Empresas → crear/buscar/editar; con rol `SoporteComercial` probar soft-delete.
4. Abrir Contactos → crear con empresa; editar sin cambiar empresa.

---

## Archivos tocados (principales)

- `backend/src/modules/accounts/**`
- `backend/src/app.module.ts`
- `backend/database/migrations/20260810180000-*.js`, `20260810180100-*.js`
- `backend/database/seeders/lib/role-permissions.js`
- `frontend/src/modules/accounts/**`
- `frontend/src/lib/navigation.ts`
- `frontend/src/routing/AppRoutes.tsx`
- `.cursor/rules/700-modules.mdc` (ya actualizado en gate previo)
