# DR — Unificación Contactos Lead↔OUV↔Cuenta en Wave 1 (reabre alcance, corrige modelo)

**Fecha:** 2026-08-10
**Estado:** Aprobado
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Supersede a:** `2026-08-DR-modelo-contactos-unificado.md` y `2026-08-DR-admin-empresas-contactos.md` (ambos basados en tablas `organizations`/`people` del PDF Blueprint V2, que **no existen** en el repo real — corregido tras revisar `spec-demand-generation.md` v2.2 y `spec-ouv-funnel.md` v1.2 reales)
**Verificado contra:** `spec-demand-generation.md` v2.2, `spec-ouv-funnel.md` v1.2, `spec-calificacion.md` v2.1

## Parte 1 — Enmienda de alcance (Artículo VIII de CONSTITUTION.md)

### Contexto

`spec-ouv-funnel.md` v1.2 documenta que la unificación de contactos Lead↔OUV↔Cuenta **ya fue intentada** (v1.1) y **revertida** (v1.2: *"`contactos.lead_id` vuelve a NOT NULL (revierte cambio de v1.1)"*), quedando explícitamente listada en "Fuera de alcance (Wave 2 o después): Modelo unificado de contactos Lead↔OUV↔Cuenta (Módulo 12)".

El Artículo VIII de `CONSTITUTION.md` exige decision record explícito para mover cualquier capacidad de Wave 2 a Wave 1.

### Decisión

Se **reabre el alcance de Wave 1** para incluir la unificación de contactos y una versión mínima de `accounts` (adelanto parcial de Módulo 12), motivado por el cambio de reglas de negocio del cliente (punto 5 y 3–4 del cambio comunicado 2026-08-10). El resto de Módulo 12 (jerarquía de accounts padre/hijas, indicadores de salud, historial de interacciones a nivel de cuenta) **sigue diferido a Wave 2** — esta enmienda es acotada, no abre todo el módulo.

## Parte 2 — Modelo técnico corregido

### Corrección de nombres de tabla

- La tabla de contactos de lead se llama **`lead_contacts`** (confirmado contra `spec-demand-generation.md` v2.2, no `contactos` como la nombra por inconsistencia `spec-ouv-funnel.md` v1.2 — **flag para corregir esa inconsistencia en `spec-ouv-funnel.md` cuando se actualice**).
- No existen `organizations` ni `people`. El adelanto de Módulo 12 usa el nombre **`accounts`**, ya anticipado como FK target en `ouvs.account_id` (`spec-ouv-funnel.md` v1.2, hoy nullable/sin tabla real detrás).

### Decisión de modelo — minimiza churn sobre las tablas existentes

1. Se crea tabla nueva **`accounts`** (adelanto mínimo de Módulo 12): `account_id`, `name`, `tax_id` (opcional — NIT colombiano), `created_at`/`updated_at`/`deleted_at` (soft-delete estándar). Sin jerarquía padre/hija, sin indicadores de salud — eso sigue en Wave 2.
2. Se crea tabla nueva **`people`** (maestro de persona, antes inexistente): `person_id`, `name`, `job_title`, `email`, `phone`, `account_id` (FK a `accounts`, **obligatorio** — todo contacto debe tener empresa), `created_at`/`updated_at`/`deleted_at`.
3. **`lead_contacts` se reestructura** (no se elimina el nombre, minimiza churn en código ya escrito): pierde las columnas denormalizadas (`empresa_nombre`, `nombre`, `cargo`, `email`, `telefono`) y gana `person_id` (FK a `people`, columna nueva en inglés). Mantiene `lead_id`, `position` (1..3), timestamps — estas columnas ya existían antes de esta sesión, se quedan como están. Pasa de "tabla de datos" a "tabla intermedia".
4. **`ouv_contactos` se reestructura igual**: pierde `nombre`/`cargo`/`email`/`telefono` denormalizados, gana `person_id` (FK a `people`, columna nueva en inglés). Mantiene `contacto_ouv_id` (PK, sin cambio — así `ouv_influencias.contacto_ouv_id` **no requiere ningún cambio**), `ouv_id`, `notas`, timestamps, `deleted_at` — columnas existentes, se quedan como están.
5. **Se elimina la copia de contactos en la creación de OUV (Vía 1)**: `spec-ouv-funnel.md` EARS-02 ("copiar todos los contactos del lead a `ouv_contactos`") queda **obsoleto**. En su lugar, al crear la OUV desde SQL, el sistema debe **reutilizar los mismos `person_id`** del lead origen, creando filas nuevas en `ouv_contactos` que apunten a las `people` ya existentes (no se duplica el dato de la persona, solo la relación).
6. Cualquier rol autenticado puede crear una `cuenta` nueva (confirmado en `2026-08-DR-admin-empresas-contactos.md`, se mantiene).
7. Toda `persona` creada debe estar asociada a una `cuenta` (confirmado, se mantiene).

### Impacto en specs existentes — hallazgos para la próxima sesión de `speckit-clarify`

- `spec-demand-generation.md` §3.2 (`lead_contacts`) — reestructurar tabla, agregar flujo de selección/creación de `persona`+`cuenta` en el formulario de lead.
- `spec-ouv-funnel.md` EARS-02 y changelog v1.2 — quedan **obsoletos**, requieren nueva versión (v1.3) que reemplace "copiar contactos" por "reutilizar person_id existente".
- `spec-ouv-funnel.md` §10 "Fuera de alcance" — remover la línea "Modelo unificado de contactos Lead↔OUV↔Cuenta (Módulo 12)", ya no aplica.
- Nuevo `spec-gestion-accounts.md` (ya en borrador v0.1) — actualizar para usar `accounts`/`people`, no `organizations`/`people`.

### Migración de datos (resuelto 2026-08-10)

Confirmado con el arquitecto: **no hay datos reales en `lead_contacts`/`ouv_contactos` todavía** — ambiente de desarrollo/staging sin producción activa.

**Decisión: opción C — ambiente limpio, sin migrador de datos.** Antes de aplicar el cambio de schema (agregar `person_id`, quitar columnas denormalizadas), se **trunca** `lead_contacts`/`ouv_contactos` en los ambientes existentes. No se construye ningún script/job de migración ni lógica de deduplicación de empresas para datos históricos — no aplica porque no hay datos que preservar.

Si en el futuro (antes del go-live de Wave 1) llegara a cargarse data real antes de este cambio, este DR debe revisarse — la opción C deja de ser válida y correspondería opción A o B del hallazgo original.

## Alternativas descartadas

- Mantener contactos separados como pide `spec-ouv-funnel.md` v1.2 — descartado: el arquitecto confirmó mover a Wave 1 pese al revert anterior.
- Nombrar las tablas nuevas `organizations`/`empresas`/`people`/`contactos` — descartado: `accounts` ya está anticipado como FK target real en `ouvs.account_id`; usar cualquier otro nombre crea una segunda tabla de empresa redundante.
