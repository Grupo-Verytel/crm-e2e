# Despliegue — Cuenta de alto valor

Fecha: 2026-10-18. Dos migraciones, en este orden por el timestamp:

1. `backend/database/migrations/20261018120000-add-accounts-is-high-value.js` — columna `accounts.is_high_value BOOLEAN NOT NULL DEFAULT false`. Sin índice.
2. `backend/database/migrations/20261018120100-account-high-value-permission.js` — agrega `{ action: "manage_high_value", subject: "Account" }` a `SoporteComercial` y `Admin` si no está.

Las dos miran el estado actual y se pueden volver a correr. `npm run migration:run` en `backend` las aplica en ese orden. No hay variables nuevas.

Este repo no define certification ni producción. El ciclo de migrar, deshacer y volver a migrar del Paso 1 se hizo en la base local.

## Local

Ya aplicado en el Paso 1. Si hay que repetirlo: respaldo, `migration:run` y las dos consultas de abajo.

## Certification

1. Respaldo de `accounts` y de `roles` antes de migrar.

```bash
mysqldump accounts roles > accounts-roles-antes-alto-valor.sql
```

2. `npm run migration:run` en `backend`. Si se corta a la mitad, volver a correrla: la columna no se duplica y la regla no se inserta dos veces.
3. Verificar la columna y que la regla está una sola vez. `EjecutivoComercial` no debe salir en la segunda consulta.

```sql
SHOW COLUMNS FROM accounts LIKE 'is_high_value';

SELECT COUNT(*) AS null_flags
FROM accounts
WHERE is_high_value IS NULL;

SELECT r.name, COUNT(*) AS high_value_rules
FROM roles r
JOIN JSON_TABLE(
  CAST(r.permissions AS JSON),
  '$[*]' COLUMNS (
    action VARCHAR(64) PATH '$.action',
    subject VARCHAR(64) PATH '$.subject'
  )
) jt
WHERE jt.action = 'manage_high_value'
  AND jt.subject = 'Account'
GROUP BY r.name;
```

La columna es `tinyint(1)`, `Null = NO`, `Default = 0`. `null_flags` es 0. La segunda consulta devuelve solo `SoporteComercial` y `Admin`, cada una con `high_value_rules = 1`.

4. Avisar a Soporte Comercial y a Administrador: quien tenga la sesión abierta debe salir y volver a entrar. Hasta entonces el checkbox sigue deshabilitado, porque el cliente carga `user.permissions` al entrar. El backend ya aplica la regla en el request siguiente.
5. Prueba rápida: entrar con Soporte Comercial, marcar una cuenta, ver el ícono en Empresas y en una OUV de esa cuenta (kanban, lista y detalle). Entrar con Ejecutivo Comercial y ver el checkbox deshabilitado. Entrar con Administrador, quitar la marca y ver que el ícono desaparece.

## Producción

El mismo orden que certification, después de que esa prueba haya pasado allí.

1. Respaldo de `accounts` y de `roles`.
2. `migration:run`.
3. Las mismas dos consultas. Misma expectativa.
4. El mismo aviso de cerrar sesión y volver a entrar.
5. La misma prueba rápida, con una cuenta de prueba.

## Reversión

`npm run migration:undo` en `backend`, dos veces.

1. La primera deshace el permiso: quita solo `manage_high_value` / `Account` de `SoporteComercial` y `Admin`. El resto de reglas queda.
2. La segunda quita la columna `is_high_value`.

Hacerlo con el respaldo a mano. Después de la primera, el checkbox deja de poder guardar la marca aunque la sesión siga abierta, porque el guard recarga los permisos en cada request.
