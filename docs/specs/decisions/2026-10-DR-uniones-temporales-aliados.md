# DR — Uniones temporales y aliados como empresas ejecutoras

**Fecha:** 2026-10-14
**Estado:** Propuesto (pendiente de aprobación del tech lead)
**Rama:** `FEATURE_ET_OFERTA_ALIADOS`
**Dispara desde:** diseño en `Design_JD` (`/offers/:ouvId` → Datos Proyecto → botones «Crear unión temporal» / «Crear aliado»), que guardaba ambos catálogos en `localStorage`.

## Contexto

El expediente de la venta ganada (`won_sales` + `won_sale_members`) ya vive en MySQL. Sus filas de empresa ejecutora solo admitían `Frisson`, `Verytel` y `UT`. Además:

- la UT era un nombre fijo («Unión temporal»), sin NIT ni catálogo;
- «Aliado» no aparece en ningún spec (los prompts HU-F01/F04 solo nombran Frisson/Verytel/UT), así que es alcance nuevo;
- el % de ingresos era entero.

El diseño de `Design_JD` agregó catálogos de UT y aliados (NIT + nombre), pero en `localStorage`. Cada navegador veía su propia lista y el NIT duplicado solo se detectaba en el equipo que lo creó.

## Decisión

Respuestas del negocio (2026-10-14):

| Pregunta | Respuesta |
|---|---|
| ¿La UT lleva integrantes y su %? | No. Solo NIT y nombre; el % se asigna por proyecto. |
| ¿N aliados por proyecto? | Por ahora uno (por validar). |
| ¿Quién crea UT/aliados? | Solo SoporteComercial. |
| ¿Decimales en %? | Sí, todos los %, máximo 1 decimal. |
| NIT de Frisson/Verytel | Siguen fijos en el frontend por ahora. |
| ¿Validar NIT? | Sí, con dígito de verificación (DIAN). |

### Modelo

- Tablas nuevas `joint_ventures` y `partners` (catálogos propios de Cierre de Oferta, **no** se reutiliza `accounts`): `tax_id` (base del NIT, solo dígitos, UNIQUE), `verification_digit`, `name`, `active`, `created_by`, timestamps, `deleted_at`.
- `won_sale_members`: columnas nuevas `joint_venture_id` y `partner_id` (FK, `ON DELETE RESTRICT`); el ENUM `empresa` suma `Aliado`. `nombre` queda como foto del nombre al asignarla; el backend lo sobrescribe con el nombre vigente del catálogo.
- `participacion_pct` pasa de SMALLINT a `DECIMAL(4,1)` en `won_sale_members` y `won_sales`.

### Reglas

- **NIT:** se escribe `base-DV` (admite puntos y espacios). Base de 6–15 dígitos y DV correcto según los pesos de la DIAN. Es único por catálogo; si el NIT estaba borrado lógicamente, se restaura en vez de duplicarse. Si ya existe, responde 409.
- **Borrador (cada `PUT` del expediente):** una fila por empresa (máx. 1 UT y 1 aliado); `jointVentureId` solo en filas UT y `partnerId` solo en filas Aliado; la UT o el aliado deben existir y estar activos. No exige la suma del 100%.
- **Envío al PMO** (`POST /implementation/projects/:ouvId`): exige al menos una fila, la UT y el aliado elegidos del catálogo y la suma exacta de 100.0% (validada en décimas). Si no se cumple, responde 400 `EXECUTING_COMPANIES_INCOMPLETE` y no se llama al PMO.
- **CASL:** subjects `JointVenture` y `Partner`. `create` para SoporteComercial y Admin. `read` para todo rol que lee `WonSale`, incluida Planeación Comercial, creada desde la UI.

### API

| Método | Ruta | Permiso |
|---|---|---|
| GET | `/offer-closing/joint-ventures` | read JointVenture |
| POST | `/offer-closing/joint-ventures` `{ nit, nombre }` | create JointVenture |
| GET | `/offer-closing/partners` | read Partner |
| POST | `/offer-closing/partners` `{ nit, nombre }` | create Partner |

## Alternativas descartadas

- **Reutilizar `accounts` con un tipo (Cliente/Aliado/UT):** evita NIT repetidos entre clientes y aliados, pero toca una tabla usada por leads y OUV a semanas del Go-Live. Se puede migrar luego con otro DR.
- **Tabla de integrantes de la UT:** el negocio confirmó que no aplica.
- **Exigir el 100% en cada guardado:** rompe el autoguardado del formulario, que hace un `PUT` en cada edición.

## Pendientes

- Confirmar si habrá N aliados. Si sí, se quita la regla de una fila por empresa en `WonSaleService.validarMiembros` (sin migración).
- NIT de Frisson (`900784911-1`) y Verytel (`830050633-1`): fijos en `FormularioDatosProyecto.tsx` con los valores que dio el negocio. Según el cálculo de la DIAN el DV debería ser `3` y `7`; falta confirmarlo contra el RUT.
- No hay UI para editar ni desactivar UT/aliados.
- Expedientes existentes con fila `UT` sin `joint_venture_id` no pueden enviarse al PMO hasta elegir la UT del catálogo.
- `/offers` todavía usa `shared/project/mock-store.ts` (`localStorage`) como base y caché del registro de pantalla. El expediente ya se lee y guarda en backend; quitar ese store es otro paso (11 llamadas, incluidas las pantallas de implementation).
