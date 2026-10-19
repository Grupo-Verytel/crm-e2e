# RESUMEN-PASO-2 — Frontend

Fecha: 2026-10-18. Sin commit de este paso. Sin push.

`crm-e2e-DesignJD` no tiene diseño de esta marca. Se usó el design system de `crm-e2e`.

## Decisiones visuales

- `--high-value` es `#4C3BCF` en claro (7.41:1 sobre `#FFFFFF`) y `#C4B5FD` en oscuro (7.77:1 sobre `#2A2A2A`). El oscuro está en `:root[data-theme='dark']` y otra vez en `html[data-theme='dark']`, porque ese selector gana. Clase `text-high-value`.
- `HighValueBadge` es solo el ícono `Gem`: 14 px en `sm` (lista y tarjeta) y 18 px en `md` (cabeceras). `title` y `aria-label`: «Cuenta de alto valor». `shrink-0`, así el nombre se trunca y el ícono no.
- En la tarjeta kanban el nombre va en un `truncate` dentro de un flex. La columna tiene `min-w-0` para que la grilla de cuatro columnas pueda encogerse en móvil y en escritorio. Si no cabe, se corta el nombre.
- El checkbox usa el mismo patrón que los del formulario de usuario y del lead: `flex items-center gap-2 text-sm` e input con `mt-0.5`.
- Sin permiso, el `title` está en un envoltorio (un input `disabled` no muestra tooltip al pasar el mouse) y el mismo texto está en un nodo `sr-only` referenciado con `aria-describedby`.
- El 403 se escribe dentro del formulario, en `text-danger`, y no usa el toast. El modal no se cierra y los campos quedan como estaban. El texto es siempre «No tienes permiso para cambiar la marca de alto valor.» Nunca se muestra `FORBIDDEN`.
- El ícono de la cabecera del modal mira la cuenta ya guardada, no el checkbox sin guardar.
- El formulario de lead abre el mismo `AccountFormModal` (`LeadFormModal.tsx` cerca de la línea 1122). `selectAccount` solo usa nombre y NIT, así que el campo nuevo no cambia ese flujo. No se tocó el resto del alta de lead.

## Verificación

`npm run build` en `frontend`: `tsc -b` y `vite build` en verde.

ESLint limpio en `HighValueBadge.tsx`, `can-manage-high-value.ts`, `types.ts` y `ouvs-api.ts`.

Los archivos que ya existían (`AccountFormModal.tsx`, `AccountsListPage.tsx`, `OuvsBoardPage.tsx`, `OuvDetailHeaderCard.tsx`, `VentaGanadaDetailPage.tsx`) siguen con avisos previos de `react-hooks` (setState dentro de un effect, refs). No son de este cambio y no se reescribieron.

No hay herramientas de navegador en esta sesión. No se pudo pulsar el flujo en claro, oscuro y móvil. El recorte del nombre en la tarjeta está en el CSS descrito arriba.

## Prueba manual para Evilio

1. Entrar con Soporte Comercial. Crear una empresa con «Cuenta de alto valor» marcado. En Empresas, el ícono `Gem` queda junto al nombre.
2. Abrir una OUV de esa cuenta. El ícono está junto a la empresa en el kanban, en la vista lista del tablero y en la cabecera del detalle (junto a Organización).
3. Salir y entrar con Ejecutivo Comercial. En alta y en edición el checkbox se ve deshabilitado, con el valor actual, y el tooltip «Solo Soporte Comercial o Administrador pueden cambiar esta marca.»
4. Salir y entrar con Administrador. Quitar la marca y guardar. El ícono desaparece de la lista de empresas y de las OUVs de esa cuenta.
5. Desde el formulario de un lead, «crear empresa»: con Soporte Comercial o Administrador el checkbox se puede marcar; con Ejecutivo Comercial queda deshabilitado y la empresa se crea sin la marca. El lead sigue pudiendo elegir esa empresa.
6. Quien ya tenía la sesión abierta debe salir y volver a entrar para que el checkbox se habilite. Hasta entonces el servidor igual rechaza un `true` con 403, y el modal muestra el mensaje en español sin cerrarse.

## Archivos

- `frontend/src/styles/tokens.css`
- `frontend/src/styles/global.css`
- `frontend/tailwind.config.js`
- `frontend/src/components/HighValueBadge.tsx`
- `frontend/src/modules/accounts/lib/can-manage-high-value.ts`
- `frontend/src/modules/accounts/types.ts`
- `frontend/src/modules/accounts/components/AccountFormModal.tsx`
- `frontend/src/modules/accounts/pages/AccountsListPage.tsx`
- `frontend/src/modules/discovery/api/ouvs-api.ts`
- `frontend/src/modules/discovery/pages/OuvsBoardPage.tsx`
- `frontend/src/modules/discovery/components/OuvDetailHeaderCard.tsx`
- `frontend/src/modules/offer-closing/pages/VentaGanadaDetailPage.tsx` — el OUV de respaldo, que no trae cuenta, declara `account_is_high_value: false`. El detalle real sigue viniendo de `GET /discovery/ouvs/:id`.
