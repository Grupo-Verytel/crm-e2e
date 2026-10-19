# QA — Cuenta de alto valor

Fecha: 2026-10-18. Una fila por REQ-01 a REQ-10.

«Manual Evilio» es la prueba que aprobó el Paso 2, incluido el kanban en escritorio y en móvil. No hubo AJ.

| Req | Cómo se probó | Evidencia | Resultado |
|---|---|---|---|
| REQ-01 | Test automático y migración | `account-high-value.spec.ts`: omitir el campo en el alta deja `false`. Paso 1: `SHOW COLUMNS` dio `tinyint(1) NOT NULL DEFAULT 0` y `COUNT` de `NULL` = 0. Una segunda `up` no falla | OK |
| REQ-02 | Test automático y manual Evilio | El spec: `SoporteComercial` y `Admin` tienen la regla una vez, y crean y editan la marca. Paso 2, puntos 1 y 4: crear marcada y desmarcarla | OK |
| REQ-03 | Test automático | El spec: `EjecutivoComercial` tiene create/update de `Account` y no tiene la regla. Enviar `true` en el alta, o un valor distinto en la edición, es 403 y no llama a `create` ni a `update`. Editar sin el campo deja la marca | OK |
| REQ-04 | Test automático | El spec dispara `afterUpdate` de `Account` contra `AuditHooksService` y espera una fila `UPDATE` con `campo_modificado = is_high_value`. El servicio no escribe `audit_log` | OK |
| REQ-05 | Test automático y manual Evilio | El spec de cuentas incluye el campo en lista y detalle. `ouv-high-value.spec.ts`: una página llama `findHighValueByAccountIds` una vez; cuenta ausente o `account_id` nulo → `false`. Paso 2, punto 2: el ícono salió en kanban, lista y detalle de esa OUV | OK |
| REQ-06 | Test automático y manual Evilio | El spec de OUV: `account_id` nulo no consulta `accounts`. Paso 2, punto 2: `Gem` junto a la empresa en la tarjeta, en la fila y en la cabecera. Punto 4: al quitar la marca, el ícono desaparece. Kanban en escritorio y móvil: el nombre se trunca y el ícono no pasa a una segunda línea | OK |
| REQ-07 | Manual Evilio | Paso 2, punto 1: ícono junto al nombre en Empresas. Punto 4: desaparece al desmarcar. El detalle de la cuenta es el modal de edición; la cabecera muestra `HighValueBadge` `md` si la cuenta guardada está marcada | OK |
| REQ-08 | Revisión de modelo | `accounts` no tiene columna padre ni hijo. El alta y la edición escriben solo la fila de esa cuenta. No hay test de herencia porque no hay vínculo que probar | OK |
| REQ-09 | Manual Evilio | Paso 2, puntos 3 y 5: con Ejecutivo Comercial el checkbox queda deshabilitado, muestra el valor actual y el tooltip «Solo Soporte Comercial o Administrador pueden cambiar esta marca.». Con Soporte Comercial o Administrador se puede marcar, también al crear la empresa desde el lead. Sin permiso el modal no manda `is_high_value` | OK |
| REQ-10 | Test automático y manual Evilio | Los tipos de cuenta y de OUV agregan el campo y no quitan otros. `npx jest --forceExit --no-coverage` en `backend`: 71 suites verdes, incluidas las de alta, edición, avance, cierre y presupuesto de OUV. Paso 2: esas pantallas siguieron usables con el ícono al lado | OK |
