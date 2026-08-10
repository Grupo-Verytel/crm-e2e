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
- **`ouv_contactos`:** tabla independiente, **sin FK a `lead_contacts`**
- **Soft-delete estándar:** columna `deleted_at` + `paranoid: true` en Sequelize, en todas las entidades
- **Roles vigentes (Blueprint V2):** `EjecutivoComercial`, `SoporteComercial`, `Profesional Soporte Comercial` — **no existe `DirectorComercial`**
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
