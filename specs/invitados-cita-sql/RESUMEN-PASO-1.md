# RESUMEN-PASO-1 — Invitados por defecto de la cita SQL

Fecha: 2026-10-29. Rama: `EP-Feature-InvitadosCita`. Sin código de producto.

## Entrega

Especificación EARS en `specs/decisions/2026-10-29-invitados-cita-sql.md`. Incorpora D1–D5 de la aprobación del Paso 0.

Incluye requisitos para:

- attendees de Graph en el alta, con la lista resuelta una sola vez y sin tocar `GraphService`;
- Graph del `PATCH` armado con el snapshot guardado;
- reemplazo del snapshot cuando `POST /:id/cita` reutiliza un `cita_id` no vigente;
- borrado de `sql_cita_attendees` por `ON DELETE CASCADE` al cancelar.

## Excepción a R2

`sql_cita_attendees` no es paranoid y no tiene `deleted_at`. Sigue el ciclo de `sql_citas`, que se borra físicamente. Está escrito en la decisión, sección D4.

## Riesgo conocido

Graph sigue fuera de la transacción. En `assign` el orden queda cita → snapshot → Graph. En `POST /:id/cita` Graph no se mueve de donde está. No se corrige en esta rama.

## Pendiente

No se actualiza `.cursor/skills/registrar-auditoria/SKILL.md` en esta rama. El skill todavía describe un `AuditService.log` escrito a mano. El código vivo, y esta spec, auditan con `AuditHooksService`. La puesta al día del skill queda para otra rama.

## Pruebas

No aplica. No hay código de producto en este paso.
