# AGENTS.md — CRM Frisson / Grupo Verytel

**Versión:** 1.0 — inventario técnico vigente
**Última verificación contra repo:** consolidado a partir de trabajo con Cursor a la fecha de este documento
**Relación con `CONSTITUTION.md`:** este documento contiene el *dato*, la constitución contiene la *regla*. Si un dato aquí cambia (se sube una versión, se agrega una librería aprobada), se actualiza este archivo — no requiere enmienda de constitución salvo que rompa una regla de gobierno.

---

## 1. Stack backend (verificado)

- **Framework:** NestJS 11
- **ORM:** Sequelize vía `@nestjs/sequelize` + `sequelize-typescript`
- **Lenguaje:** TypeScript
- **Base de datos:** MySQL
- **Eventos/tiempo real:** `@nestjs/event-emitter` + `@nestjs/websockets` (Socket.io) — push asíncrono post-commit, **no polling**
- **Autorización:** CASL
- **Autenticación:** JWT
- **Validación global:** `ValidationPipe` con `transform: true`, `whitelist: true`, `forbidNonWhitelisted: true`
- **Orden de implementación backend por módulo:** Models → migración → DTOs → services → controllers

## 2. Stack frontend (verificado — no asumir otras librerías)

- **Presentes:** React 19, React Router 7, Tailwind CSS 4, lucide-react
- **Explícitamente ausentes** (no agregar sin decision record): TanStack Query/Table, SWR, Zustand, Redux, class-variance-authority (CVA), clsx, tailwind-merge, Radix, shadcn
- **Fetching:** `fetch` nativo envuelto en `apiRequest()` (`frontend/src/lib/api/http-client.ts`), con funciones por módulo en carpetas `api/`
- **Estado de listas:** `useState` + `useEffect` + `useCallback` por página
- **Filtros:** patrón draft/applied — el usuario edita estado draft, se copia a applied al presionar "Aplicar", eso dispara el fetch
- **Paginación:** componente compartido `Pagination.tsx`, recibe `page`/`limit`/`total` del backend
- **Tablas:** `<table>` HTML nativo con Tailwind, sin librería de tablas (ver `LeadsTableView`)
- **Estado global:** React Context solo para auth. Regla `.cursor/rules/200-frontend-react.mdc`: estado local + Context, sin store global salvo justificación

## 3. Design system (verificado)

- **Patrón:** `frontend/src/styles/tokens.css` (variables CSS marca Verytel) → `tailwind.config.js` mapea tokens a clases utilitarias (`bg-brand`, `text-ink`, `bg-surface`) → constantes de clase exportadas por módulo (ej. `frontend/src/modules/demand-generation/components/ui.ts`: `primaryButtonClass`, `ghostButtonClass`, `cardClass`) → componentes React simples con mapas `Record<string, string>` para variantes de badge (ej. `StatusBadge.tsx` con `ESTADO_TONE`/`TONE_CLASS`/`LABELS`)
- **Sin carpeta de design system compartida** todavía — solo `Pagination.tsx` y `LoadingScreen` son compartidos; el resto vive por módulo
- Regla `.cursor/rules/600-ui-design.mdc`: CSS tokens + Tailwind 4, sin kits de UI externos

## 4. Modelo de dominio (hechos verificados)

- **Espina de IDs consecutivos:** OUV → PRE → PRI → SER (Oportunidad → Preventa → Pricing → Servicio)
- **Segmentos/verticales:** Gobierno, Defensa y Seguridad, Proyectos Especiales, B2B — Colombia
- **Embudo comercial de 4 zonas:** UNIVERSO → ENCIMA_FUNNEL → EN_FUNNEL → MAYOR_PROBABILIDAD (patrón MEDDIC/Miller Heiman), definido en `FILTROS_EMBUDO_COMERCIAL_v5.pdf`
- **Convención de nomenclatura (`specs/decisions/2026-08-DR-convencion-nombres-ingles.md`):** toda tabla/columna nueva desde 2026-08-10 va en **inglés**. El esquema ya implementado o ya especificado antes de esa fecha se mantiene en español (no se retro-traduce sin DR). Los valores de datos/ENUM siempre en español, en ambos regímenes.
- **Segments y subsegments (`specs/decisions/2026-08-DR-subsegmentos.md`):** `segmento` deja de ser ENUM — se crean tablas nuevas `segments` (id, name, active) y `subsegments` (id, segment_id FK, name, active), ninguna administrable por UI todavía. `leads.segment_id` + `leads.subsegment_id` y `ouvs.segment_id` + `ouvs.subsegment_id` — FK nuevas en inglés, subsegment opcional e independiente entre leads/ouvs. Coexisten con el ENUM viejo `segmento` (español) hasta ejecutar la migración de datos. Resuelve de raíz la inconsistencia `PymesEspeciales` (leads) vs `ProyectosEspeciales` (ouvs). `campaigns.segmento_objetivo` sigue como ENUM, fuera de este cambio por ahora.
- **Modelo de contactos/cuentas (`specs/decisions/2026-08-DR-unificacion-contactos-cuentas-wave1.md` — supersede a los dos DRs de contactos anteriores, que asumían `organizations`/`people` inexistentes):** tablas nuevas `accounts` (adelanto mínimo de Módulo 12; columna `account_id` en `ouvs` pendiente de GC-13 — ver `2026-08-DR-auto-poblar-ouv-account-id.md`) y `people` (maestro de persona, `account_id` obligatorio). Las tablas existentes `lead_contacts` y `ouv_contactos` **se reestructuran, no se renombran** (siguen en español/mixto por ser preexistentes) para llevar la columna nueva `person_id` (inglés) en vez de datos denormalizados — minimiza cambios sobre código ya escrito, `ouv_influencias.contacto_ouv_id` no requiere cambio. La copia de contactos en creación de OUV Vía 1 (`spec-ouv-funnel.md` EARS-02) queda obsoleta: ahora se reutiliza el mismo `person_id`. **Esta unificación mueve alcance de Wave 2/Módulo 12 a Wave 1** — enmienda explícita registrada en el DR, no es un cambio silencioso.
- **Nombre real de tabla de contactos de lead:** `lead_contacts` (confirmado contra `spec-demand-generation.md` v2.2 — `spec-ouv-funnel.md` v1.2 la nombra `contactos` por inconsistencia entre specs, pendiente de corregir ahí).
- **Soft-delete estándar:** columna `deleted_at` + `paranoid: true` en Sequelize, en todas las entidades
- **Roles vigentes (nombre en código, PascalCase sin espacios — la UI puede mostrar label largo):** `EjecutivoComercial`, `SoporteComercial` (Blueprint V2 lo describe también como "Profesional Soporte Comercial" — **es el mismo rol**, ese es solo el label de UI, no un rol aparte — confirmado 2026-08-10), `ProductManager` (`specs/decisions/2026-08-DR-rol-product-manager.md`, seed en PascalCase sin espacio; UI muestra "Product Manager"), `TraductorDeNegocio` (`specs/decisions/2026-08-DR-rol-traductor-negocio.md`, campo nuevo `leads.business_referrer_id` en inglés, login + lectura limitada) — ninguno de los dos últimos está aún en Blueprint V2 formalmente — **no existe `DirectorComercial`**
- **OUVs sin origen lead/SQL:** ~10% de casos (upsell, outbound, licitaciones)

## 5. Estructura de repo

```
crm-e2e/
├── backend/
├── frontend/
├── specs/
│   ├── spec-<módulo>.md          # specs ejecutables en EARS
│   └── decisions/
│       └── YYYY-MM-DR-<tema>.md  # decision records
├── AGENTS.md                     # este documento
├── CONSTITUTION.md               # reglas de gobierno
└── .cursor/
    ├── rules/*.mdc                # convenciones siempre activas
    │   ├── 200-frontend-react.mdc
    │   └── 600-ui-design.mdc
    └── skills/<nombre>/SKILL.md  # playbooks on-demand (Cursor 2.4+)
```

## 6. Artefactos de proceso Cursor (formato exacto)

- **Prompt de Cursor:** siempre texto completo listo para copiar/pegar — nunca una descripción de qué debería contener el prompt.
- **Condiciones de parada:** rotuladas R1–R9 dentro del prompt.
- **`NOTAS-BLOQUEO-N.md`:** obligatorio cuando Cursor se detiene por un STOP CONDITION.
- **`RESUMEN-PASO-N.md`:** obligatorio al cerrar cada gate (spec, backend, frontend).
- **`RESUMEN-EJECUCION.md`:** obligatorio para corridas autónomas nocturnas.

## 7. Skills de Cursor — inventario

**Ya construidas / en uso:**
- (ninguna terminada aún — proceso SDD en formalización)

**Pendientes de construir:**
`speckit-clarify`, `speckit-analyze`, `semaforo-sla`, `badge-estado-por-entidad`, `kanban-drag-validado`, `formulario-stepper`, `workflow-engine-pattern`, `api-contract-endpoint`, `transacciones-sequelize`, `test-ears-criteria`, `pr-checklist-crm`, `seed-datos-demo`

## 8. Documentos de referencia clave

- `Frisson_CRM_Blueprint_V2_19062026.pdf` — blueprint funcional/roles
- `FILTROS_EMBUDO_COMERCIAL_v5.pdf` — lógica de embudo de 4 zonas
- `DIAGRAMA_PROCESO_COMERCIAL_END_TO_END.pdf` — proceso end-to-end
- `spec-<módulo>.md` por módulo, en `specs/`

## 9. Fechas de referencia (dato, no regla)

- **Go-Live Wave 1:** 9 de octubre de 2026
- **Wave 2:** integración ERP/facturación (Siigo/WorldOffice), dashboards ejecutivos, migración Pipedrive, scoring engine numérico

## 10. Herramientas

- **IDE:** Cursor (pagado), `.cursor/rules/` + `.cursor/skills/`
- **Diagramación:** draw.io, Lucidchart

---

*Estado de módulos funcionales (avance de specs/implementación) se mantiene en los propios `spec-<módulo>.md`, no se duplica aquí para evitar desincronización.*
