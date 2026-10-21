# Despliegue — Gerente Comercial en OUVs

Fecha: 2026-10-20. Una migración: `backend/database/migrations/20261020120000-gerente-comercial-manage-high-value.js`. Agrega solo `{ action: "manage_high_value", subject: "Account" }` a la fila cuyo `name` es `Gerente Comercial`. Si esa fila no existe, avisa y termina bien: no crea el rol. Se puede volver a correr. El `down` quita solo esa regla.

No hay variables nuevas.

En local el ciclo correr → deshacer → volver a correr ya se hizo en el Paso 1. La fila pasó de 30 a 31 reglas y la única nueva fue `manage_high_value` / `Account`.

## Antes de migrar, en cada ambiente

Parar si la fila no existe o el nombre no es exactamente `Gerente Comercial` (con espacio). No renombrar ni crear el rol. Avisar a Evilio y decirle qué nombre hay, si hay otro parecido, y qué usuarios salen en la segunda consulta.

```sql
SELECT role_id, name, is_active
FROM roles
WHERE name = 'Gerente Comercial'
   OR name LIKE '%Gerente%Comercial%';

SELECT u.user_id, u.full_name, u.email, u.is_active, r.name AS role_name
FROM users u
JOIN roles r ON r.role_id = u.role_id
WHERE r.name = 'Gerente Comercial';
```

La primera consulta debe devolver una fila con `name` = `Gerente Comercial`. Anotar los usuarios de la segunda antes de seguir.

Respaldo de `roles` antes de migrar.

```bash
mysqldump roles > roles-antes-gerente-comercial.sql
```

## Local

Ya aplicado. Si hay que repetirlo: la verificación de arriba, el respaldo, `npm run migration:run` en `backend` y la consulta de abajo.

## Certification y producción

El mismo orden en los dos. Producción va después de que la prueba de certification haya pasado.

1. La verificación de la fila y de los usuarios. Si falla, detener y avisar a Evilio.
2. Respaldo de `roles`.
3. `npm run migration:run` en `backend`.
4. Confirmar que `manage_high_value` / `Account` está una sola vez en esa fila.

```sql
SELECT r.name, COUNT(*) AS high_value_rules
FROM roles r
JOIN JSON_TABLE(
  CAST(r.permissions AS JSON),
  '$[*]' COLUMNS (
    action VARCHAR(64) PATH '$.action',
    subject VARCHAR(64) PATH '$.subject'
  )
) jt
WHERE r.name = 'Gerente Comercial'
  AND jt.action = 'manage_high_value'
  AND jt.subject = 'Account'
GROUP BY r.name;
```

`high_value_rules` debe ser 1.

5. Avisar a quienes tengan el rol `Gerente Comercial`: deben cerrar sesión y volver a entrar. Hasta entonces el cliente no tiene `ouv_board_default`, `can_create_direct_ouv`, `can_act_as_assigned_commercial` ni el permiso nuevo. El checkbox de alto valor sigue el permiso que cargó al entrar.
6. Avisar a Soporte Comercial: el CSV de `/opportunities` ahora exporta según el filtro aplicado en pantalla. Sin filtro sigue exportando lo que el rol puede leer.
7. Prueba rápida con un Gerente de ese ambiente: entra a `/opportunities` y ve solo las suyas; en una OUV propia puede avanzar o retroceder; en una ajena lee la bitácora y no escribe; puede marcar una cuenta de alto valor. Con Ejecutivo Comercial y con Soporte Comercial, la bandeja se ve como antes. Con Soporte, un CSV con filtro de comercial trae solo ese comercial.

## Reversión

`npm run migration:undo` en `backend`, una vez. Quita solo `manage_high_value` / `Account` de `Gerente Comercial`. El resto de las reglas de esa fila queda. Hacerlo con el respaldo a mano.

El código de la bandeja, de los guards y del CSV no se deshace con esa migración. Revertir el despliegue completo es volver la rama, no solo el `down`.
