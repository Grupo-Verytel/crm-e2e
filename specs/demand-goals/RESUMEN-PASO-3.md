# RESUMEN-PASO-3 — Metas semanales de generación de demanda (frontend)

Fecha: 2026-10-29. Sin cambios de backend ni de migraciones. El frontend compiló con `npx tsc -b --noEmit`.

## Archivos

- `frontend/src/modules/demand-generation/pages/MarketingDashboardPage.tsx` — engranaje, tarjetas y recarga del tablero.
- `frontend/src/modules/demand-generation/components/MarketingDashboardGoalsModal.tsx` — modal de un trimestre.
- `frontend/src/modules/demand-generation/api/dashboard-api.ts` — GET, PUT y DELETE de metas.
- `frontend/src/modules/demand-generation/types.ts` — `weekly.goals` y el contrato del lote.
- `frontend/src/modules/demand-generation/lib/can-edit-demand-goals.ts` — el engranaje mira `create` o `update` de `DemandGoal`.
- `frontend/src/modules/demand-generation/lib/bogota-fiscal.ts` — año y trimestre iniciales. No importa metas comerciales.
- `frontend/src/components/fiscal-quarter-options.ts` — las cuatro etiquetas de `FiscalQuarterSelect`, en un archivo aparte para no romper el fast refresh.

## Pantalla

El engranaje es `.icon-btn` con `Settings`, 36×36 px, en `actions` de `DemandNav`. `title` y `aria-label`: «Metas de generación de demanda». No compara el nombre del rol.

El modal tiene overlay, X, cuerpo con scroll y pie con `ghostButtonClass` / `primaryButtonClass`. Se cierra con la X, el fondo y Cancelar. Si hay cambios, pide confirmación. No hay acordeón. Año fiscal y un solo trimestre, con las etiquetas «Q1 · 01 feb – 30 abr» y las demás. Tres enteros «Meta semanal»: Interacciones, Leads del período y Convertidos a OUV. Al cambiar año o trimestre vuelve a pedir el GET. La ayuda, solo informativa, dice «≈ 20 por quincena · ≈ 131 en el trimestre» para semanal 10 y un Q de 92 días. Guardar manda un solo PUT. Un trimestre a medias muestra «Completa las tres metas del trimestre o déjalas vacías.» y no cierra. Si ya hay metas, aparece «Quitar metas del Q» y pide confirmación antes de un DELETE por id.

Las tres tarjetas ya no tienen donut ni 50 / 3 / 3. Muestran Real, Meta del período, el porcentaje y una barra. Menos de 70 % usa `bg-danger` / `text-danger`, de 70 a 99 `bg-warning` / `text-warning`, y 100 o más `bg-semaphore-verde` / `text-semaphore-verde`. La barra no pasa de 100 % de ancho; el texto sí muestra 200 %. Sin periodo: «Selecciona un período». Con meta 0: «Sin meta definida». La tercera tarjeta y el título de su detalle dicen «Convertidos a OUV». El ícono List sigue abriendo el detalle. Embudo, barras de canal y barras de segmento quedaron como estaban. La segunda tarjeta conserva el rótulo que ya tenía según el rango («Leads del periodo», «Leads del 2025», «Leads de la semana»).

## Lo que se vio en el navegador

Sesión de Admin por el formulario, y sesiones de Erika Robles (`DirectorMercadeo`) y Carol Beltrán (`GestorMercadeo`) con un access token de 15 minutos: sus contraseñas no son la del admin de seed. `GET /auth/me` leyó el rol y los permisos de la base.

| Estado | Qué se vio |
|---|---|
| Sin periodo | Las tres tarjetas en 0, texto «Selecciona un período», sin barra. |
| Año 2025, sin metas | «Sin meta definida» en las tres, sin barra. La de leads dice «Leads del 2025». |
| 17–23 oct 2026, dentro de Q3 | Real 6 / meta 10 / 60 % en rojo. Real 5 / meta 6 / 83 % en ámbar. Real 2 / meta 1 / 200 % en verde, barra al 100 % del ancho. |
| 28 oct–3 nov 2026, cruza Q3→Q4 | Metas prorrateadas 9, 9 y 4. Porcentajes 11 %, 11 % y 0 %. No coincide con ninguna meta semanal guardada. |
| Detalle | El List de la tercera tarjeta abre «Convertidos a OUV» y lista las OUV del rango. |
| Modal | Q3 2026 cargó 10, 6 y 1, con la ayuda de quincena y trimestre. Guardar deshabilitado sin cambios. Vaciar un campo y guardar deja el modal abierto con el aviso de las tres metas. |
| DirectorMercadeo | Erika Robles ve el engranaje junto a Dashboard. |
| GestorMercadeo | Carol Beltrán ve el tablero y las tarjetas. No ve el engranaje. |

## Smoke HTTP

`erobles@grupoverytel.com` tiene `create`, `read`, `update` y `delete` sobre `DemandGoal`. `cbeltran@grupoverytel.com` no tiene ninguna. Gestor responde 403 `{ "code": "FORBIDDEN", "message": "Insufficient permissions" }` en GET, PUT y DELETE. El PUT inválido no dejó filas.

PUT de alta, Q3 2026, 201:

```json
{
  "fiscal_year": 2026,
  "quarter": 3,
  "goals": [
    { "metric": "INTERACTIONS", "weekly_target": 10 },
    { "metric": "LEADS", "weekly_target": 6 },
    { "metric": "CONVERTED_OUV", "weekly_target": 1 }
  ]
}
```

El mismo trimestre con Interacciones en 12 respondió 200 y conservó los `target_id`. Se dejó otra vez en 10. Q4 se creó en 201 con semanales 8, 14 y 7.

Semana 17–23 oct: `target` 10, 6 y 1; `attainment_pct` 60, 83 y 200. Semana 28 oct–3 nov: `target` 9, 9 y 4. Sin periodo: `target` null. Año 2025: `target` 0 y `attainment_pct` null.

Después de las capturas, DELETE de las seis filas respondió 200 `{ "deleted": true }`. `GET ?year=2026` quedó con `items` vacío. Esos PUT y DELETE son el smoke pedido; no hubo `migration:run`, `migration:undo` ni SQL de esquema.

## Defecto de backend, sin corregir

Un `weekly_target` de `-1` no llega al servicio. El `ValidationPipe` responde 400 con `message` en arreglo: `goals.2.La meta semanal debe ser un entero entre 0 y 2147483647.`, más `error: "Bad Request"` y `statusCode: 400`. No trae `code: "VALIDATION"`. El modal, si recibe ese cuerpo, muestra el texto del arreglo. En pantalla el cliente corta el caso antes de enviarlo.

## Adaptaciones frente a crm-e2e-DesignJD

- Se quitó el acordeón Anual / Trimestre / Quincena / Semana. Un año y un trimestre.
- Las metas son semanales. Quincena y trimestre solo se calculan en la ayuda y en la barra.
- El guardado es un PUT del lote, no un PUT por tipo de periodo.
- El permiso es `DemandGoal`, no el nombre `DirectorMercadeo` ni `Admin`.
- Las tarjetas usan la meta del periodo filtrado, no 50 / 3 / 3 ni el donut.
- La tercera tarjeta dice «Convertidos a OUV».
- Cero es una meta válida y en el tablero se lee «Sin meta definida». Borrar es soft-delete por id.

## STOP

Sin paso siguiente hasta aprobar este resumen.
