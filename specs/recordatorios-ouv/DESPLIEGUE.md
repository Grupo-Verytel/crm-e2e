# Despliegue — Recordatorios de OUV

Fecha: 2026-10-17. Migración: `backend/database/migrations/20261017100000-extend-reminders-ouv-source.js`. Es re-ejecutable: cada paso consulta `information_schema` y se salta si ya está aplicado.

Este repo no define certification ni producción. No hay manifiesto de réplicas, ni Compose, ni proceso con más de una instancia. La migración del Paso 6 solo se aplicó en la base local. El conteo de instancias de cada ambiente hay que confirmarlo en el hosting antes de encender Outlook.

## Instancias

| Ambiente | Instancias del backend | Efecto |
|---|---|---|
| Local | 1 (`npm run start:dev`) | Un solo `dispatchDue` y, si el flag está encendido, un solo job de Outlook |
| Certification | No está en el repo | Si es 1, el riesgo de abajo no aplica. Si es más de 1, sí |
| Producción | No está en el repo. No hay base de producción cableada aquí | Igual que certification |

El job de Outlook reclama cada fila con `SELECT … FOR UPDATE SKIP LOCKED`. Dos instancias no crean dos eventos de la misma fila. `dispatchDue` no usa ese bloqueo: solo un flag en memoria del proceso. Con más de una instancia puede crear dos notificaciones para el mismo recordatorio.

## Certification

1. Respaldo de la tabla `reminders` antes de migrar.
2. Revalidar la precondición. Tiene que dar 0:

```sql
SELECT COUNT(*) AS null_sources
FROM reminders
WHERE interaction_id IS NULL;
```

Si no es 0, no correr la migración: el `CHECK` de una sola fuente no puede crearse.
3. `npm run migration:run` en `backend`. Si se corta a la mitad, volver a correrla.
4. Variables del backend, con el flag apagado:

```
FOLLOW_UP_YELLOW_DAYS=2
OUTLOOK_SYNC_ENABLED=false
OUTLOOK_SYNC_MAX_ATTEMPTS=5
OUTLOOK_SYNC_INTERVAL_MS=60000
CRM_PUBLIC_URL=https://<dominio-de-certification>
```

`CRM_PUBLIC_URL` solo es obligatoria cuando el flag pasa a `true`. Un valor que no sea `http` o `https` impide el arranque.
5. Confirmar que los comerciales de prueba están en el grupo de la application access policy de Exchange, y que su correo es `@grupoverytel.com`.
6. Probar el CRM con el flag en `false`: alta de recordatorio de OUV, semáforo, campana, realizado y cancelado. Esas filas quedan `NOT_REQUIRED`.
7. Encender `OUTLOOK_SYNC_ENABLED=true` solo aquí, reiniciar y crear un recordatorio con un usuario de prueba. Ver el evento, la alarma, la cancelación y un realizado que no toque Outlook.
8. Los recordatorios creados con el flag apagado no se sincronizan solos. Si se quieren llevar a Outlook los de OUV futuros y no realizados:

```sql
UPDATE reminders
SET outlook_sync_status = 'PENDING',
    outlook_sync_attempts = 0,
    outlook_last_error = NULL
WHERE deleted_at IS NULL
  AND ouv_interaction_id IS NOT NULL
  AND completed_at IS NULL
  AND status <> 'Cancelado'
  AND outlook_sync_status = 'NOT_REQUIRED'
  AND outlook_event_id IS NULL
  AND event_at > UTC_TIMESTAMP();
```

No incluye cancelados, realizados ni los que ya tienen evento.

## Producción

El mismo orden que certification, después de que el usuario de prueba haya pasado allí.

1. Respaldo de `reminders`.
2. La misma consulta de `interaction_id IS NULL`. Tiene que dar 0.
3. `migration:run`.
4. Las mismas variables, con `OUTLOOK_SYNC_ENABLED=false` y `CRM_PUBLIC_URL` en el dominio de producción.
5. Confirmar el grupo de Exchange de los comerciales antes de pensar en el flag.
6. Dejar el flag apagado hasta cerrar la prueba funcional del CRM.
7. Encender el flag solo cuando certification haya mostrado el alta, la alarma, la cancelación y el realizado.
8. Si hace falta sincronizar los que nacieron en `NOT_REQUIRED`, usar el mismo `UPDATE` de arriba, en una ventana acordada.

## Reversión

- Apagar `OUTLOOK_SYNC_ENABLED` y reiniciar. El job se detiene en el acto. Los eventos ya creados se quedan en Outlook; el CRM no los borra al apagar el flag.
- Si hay que revertir el esquema: `npm run migration:undo` en `backend`. El `down` devuelve `ON UPDATE CASCADE` a `reminders_ibfk_2` y quita las columnas nuevas. Hacerlo con el respaldo a mano y sin tráfico de recordatorios.
