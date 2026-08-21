# DR — Administración de Empresas (organizations) y Contactos (people)


> ⚠️ **SUPERSEDIDO** por `2026-08-DR-unificacion-contactos-cuentas-wave1.md` (2026-08-10) — este DR asumía tablas `organizations`/`people` que no existen en el repo real. Se conserva por trazabilidad histórica, no usar como referencia técnica.
**Fecha:** 2026-08-10
**Estado:** Aprobado
**Aprobado por:** Evilio Díaz (arquitecto/tech lead)
**Relacionado:** `specs/decisions/2026-08-DR-modelo-contactos-unificado.md`

## Contexto

`organizations` y `people` ya existen en Blueprint V2 como tablas maestras, pero **solo referenciadas como FK opcional desde `leads`** — no hay evidencia de pantallas o endpoints de administración independientes (crear, listar, editar, buscar). El cambio de reglas de negocio pide volverlas administrables con menú propio.

## Decisión

1. **Creación de `organizations`:** cualquier rol autenticado puede crear una empresa — sin restricción de RBAC adicional sobre este punto específico. El usuario puede seleccionar una `organization` existente o crear una nueva en el momento (desde lead, OUV, o desde su propio menú).
2. **Creación de `people`:** tiene su propio menú/flujo de creación, independiente del de `organizations` y del de lead/OUV.
3. **Regla dura:** todo `people` (contacto) creado a partir de ahora **debe estar asociado a una `organization`** — `people.org_id` (o el campo equivalente) pasa a ser obligatorio para altas nuevas. Registros históricos sin organización quedan pendientes de un plan de saneamiento de datos (fuera de alcance de este DR).
4. Ambos flujos de creación (`organizations` y `people`) son **independientes entre sí y del formulario de lead/OUV** — es decir, un lead/OUV consume `organizations`/`people` ya creados o dispara su creación desde su propio formulario, pero la administración vive en su propio módulo/menú, no queda enterrada dentro del formulario de lead.

## Pendiente para spec

- Definir a qué módulo pertenece este nuevo menú de administración — corresponde al punto 12 del alcance original ("Gestión de Cuentas"), que nunca tuvo spec. Se recomienda crear `spec-gestion-cuentas.md` como spec nuevo, en vez de anexar esto a `spec-demand-generation.md`.
- Definir criterios EARS de unicidad para `organizations` (¿por NIT? ¿por nombre?) y para `people` (¿por email? Blueprint V2 ya marca `leads.email` con "unicidad parcial").
- Resolver el pendiente del DR de contactos: si `leads.contacto_nombre`/`empresa_nombre` (denormalizados) se conservan como snapshot o se deprecan.

## Alternativas descartadas

- Restringir la creación de empresas solo a roles comerciales — descartado explícitamente por el arquitecto: "cualquier rol puede crear una empresa".
- Anidar la administración de `organizations`/`people` dentro del formulario de lead — descartado: el cliente pidió menú de creación independiente.
