# Despliegue — Metas comerciales

Fecha: 2026-10-20. Dos migraciones, en este orden:

1. `backend/database/migrations/20261020231000-create-commercial-goals.js` — tabla `commercial_goals`, columna generada `active_marker` e índices. El `down` elimina la tabla.
2. `backend/database/migrations/20261020231100-commercial-goal-permissions.js` — agrega `create`, `read`, `update` y `delete` de `CommercialGoal` a las filas `SoporteComercial` y `Admin`. Si la fila no está, no la crea. El `down` quita solo esas cuatro reglas.

No hay variables de entorno nuevas.

Esta corrida no aplicó ninguna de las dos. `DB_HOST` de `backend/.env` no es localhost y R9 prohíbe migrar contra esa base (DA-14). El ciclo local queda para quien tenga una base local, o para el ambiente que Evilio designe.

## Antes de migrar

Respaldo de `roles`. La tabla `commercial_goals` todavía no existe; el respaldo de roles alcanza para revertir el permiso. Si se vuelve a correr sobre un ambiente que ya la tiene, respaldar también esa tabla.

```bash
mysqldump --single-transaction roles > roles-antes-metas-comerciales.sql
```

Confirmar que existen Soporte y Admin, y anotar cuántas reglas tiene cada uno:

```sql
SELECT name, JSON_LENGTH(CAST(permissions AS JSON)) AS rules
FROM roles
WHERE name IN ('SoporteComercial', 'Admin');
```

## Aplicar

En `backend/`:

```bash
npm run migration:run
```

Comprobar la tabla y que cada rol tiene las cuatro reglas una sola vez:

```sql
SHOW CREATE TABLE commercial_goals;

SELECT r.name, jt.action
FROM roles r
JOIN JSON_TABLE(
  CAST(r.permissions AS JSON),
  '$[*]' COLUMNS (
    action VARCHAR(40) PATH '$.action',
    subject VARCHAR(40) PATH '$.subject'
  )
) jt
WHERE r.name IN ('SoporteComercial', 'Admin')
  AND jt.subject = 'CommercialGoal'
ORDER BY r.name, jt.action;
```

Deben salir, para cada rol: `create`, `delete`, `read`, `update`.

Soporte Comercial y Admin cierran sesión y vuelven a entrar. Si no, el engranaje no aparece aunque el servidor ya exija el permiso.

## Prueba funcional

El checklist de `RESUMEN-PASO-2.md`: alta de un Ejecutivo y un Gerente en el mismo Q y distinto segmento, duplicado, edición con rastro en Auditoría (la abre Admin), borrado y alta otra vez, Q4 nov–ene, tarjetas, Ejecutivo y Gerente sin acceso, Admin con acceso.

## Reversión

El `undo` deshace la última migración. Hay que ejecutarlo dos veces: primero los permisos, después la tabla.

```bash
npm run migration:undo
npm run migration:undo
```

Eso quita las reglas `CommercialGoal` y elimina `commercial_goals` con sus filas. No toca otras reglas de Soporte ni de Admin. Después, esas dos personas vuelven a iniciar sesión.

Si solo se quiere quitar el permiso y conservar las metas, un único `undo` alcanza, y solo si la de permisos fue la última en aplicarse.
