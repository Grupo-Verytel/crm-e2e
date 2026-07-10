---
name: tabla-filtrable-paginada
description: Patrón reutilizable de tabla con filtros (draft/applied), paginación server-side y acciones masivas para las bandejas del CRM Frisson (Leads, SQL, Preventa, Campañas, OUV Cerradas, etc.), usando el stack real del proyecto — fetch nativo vía apiRequest(), useState/useEffect, sin librerías de data-fetching ni de tablas. Úsalo al construir cualquier pantalla de "lista" o "bandeja" para replicar exactamente el patrón ya usado en Leads, no una variante distinta por módulo.
paths:
  - "frontend/src/**/*.tsx"
  - "backend/src/modules/**/*.controller.ts"
  - "backend/src/modules/**/*.service.ts"
---

# Tabla filtrable + paginada — patrón transversal

## Stack real de este proyecto (no asumas librerías)

Este CRM **no usa** TanStack Query/Table, SWR, Zustand ni Redux. El frontend es intencionalmente minimalista: React 19 + React Router 7 + Tailwind 4 + `lucide-react`, nada más. La regla `.cursor/rules/200-frontend-react.mdc` es explícita: *"local state + context — no global store unless justified"*. Este skill documenta el patrón manual ya construido en el módulo Leads (`LeadsPage.tsx`) para que el resto de módulos (SQL, Preventa, Pricing, Campañas, OUV Cerradas...) lo repliquen igual, sin que cada dev reinvente su propia variante de `useState`/`useEffect`.

## Por qué existe este skill

El Blueprint define al menos 8 bandejas con la **misma receta**: tabla + filtros + paginación + acciones (Bandeja SQL, Bandeja Preventa, Leads/MQL, Campañas — Lista, OUV Cerradas — Tracking, etc.). Sin este patrón documentado, cada módulo termina con su propia lógica de fetch/filtros ligeramente distinta, lo que hace el mantenimiento y el testing mucho más caro — aunque no haya una librería de por medio, la *convención* sigue teniendo que ser única.

## Contrato backend (NestJS)

### 1. DTO de query estándar

```typescript
// common/dto/pagination-query.dto.ts
import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 20;

  @IsOptional() @IsString()
  sortBy?: string;

  @IsOptional() @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
```

Cada módulo extiende esto con sus propios filtros (no lo dupliques):

```typescript
// modules/comercial/dto/list-sql-query.dto.ts
export class ListSqlQueryDto extends PaginationQueryDto {
  @IsOptional() @IsBoolean() @Type(() => Boolean)
  enBacklog?: boolean;

  @IsOptional() @IsUUID()
  comercialId?: string;

  @IsOptional() @IsEnum(Segmento)
  segmento?: Segmento;
}
```

### 2. Respuesta paginada estándar (coincide con `PaginatedOUVs`, `PaginatedCampaigns`, etc. del Blueprint)

```typescript
// common/dto/paginated-response.dto.ts
export class PaginatedResponseDto<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### 3. Helper de paginación en el service (Sequelize)

```typescript
async listar(query: ListSqlQueryDto): Promise<PaginatedResponseDto<Sql>> {
  const { page, limit, sortBy, sortOrder, enBacklog, comercialId, segmento } = query;

  const where: WhereOptions = {};
  if (enBacklog !== undefined) where.en_backlog = enBacklog;
  if (comercialId) where.comercial_id = comercialId;
  if (segmento) where.segmento = segmento;

  const { rows, count } = await this.sqlModel.findAndCountAll({
    where,
    limit,
    offset: (page - 1) * limit,
    order: sortBy ? [[sortBy, sortOrder ?? 'desc']] : [['fecha_asignacion', 'desc']],
  });

  return {
    data: rows,
    meta: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
  };
}
```

**Regla:** el `where` se construye condicionalmente por filtro presente — nunca metas lógica de negocio (como el cálculo de `en_backlog`) dentro del listado; eso lo pone el workflow (WF003) al momento de escribir el dato, no la query de lectura.

## Contrato frontend (React 19 — patrón manual, sin librerías)

### 1. Capa `api/` por módulo — siempre vía `apiRequest()`

Cada módulo expone sus funciones de fetch en su propia carpeta `api/`, nunca llamando `fetch` directo desde un componente:

```typescript
// modules/comercial/api/sql.ts
import { apiRequest } from '@/lib/api/http-client';

export interface FetchSqlParams {
  page: number;
  limit: number;
  enBacklog?: boolean;
  comercialId?: string;
  segmento?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
}

export function fetchSqls(params: FetchSqlParams): Promise<PaginatedResponse<Sql>> {
  return apiRequest('/api/v1/sqls', { method: 'GET', query: params });
}
```

`apiRequest()` ya resuelve JWT, refresh automático y errores tipados — nunca reimplementes esa parte a nivel de módulo.

### 2. Estado de la página: `useState` + `useEffect` + `useCallback` — patrón exacto de `LeadsPage.tsx`

```tsx
// modules/comercial/pages/SqlBandejaPage.tsx
const [items, setItems] = useState<Sql[]>([]);
const [total, setTotal] = useState(0);
const [page, setPage] = useState(1);
const [listLoading, setListLoading] = useState(false);
const [listError, setListError] = useState<string | null>(null);

// draft = lo que el usuario está editando en los inputs de filtro
// applied = lo que realmente se envía al backend (se sincroniza al pulsar "Aplicar")
const [draft, setDraft] = useState<SqlFiltersState>(initialFilters);
const [applied, setApplied] = useState<SqlFiltersState>(initialFilters);
const appliedKey = JSON.stringify(applied); // fuerza recálculo del useCallback cuando applied cambia

const loadSqls = useCallback(async () => {
  setListLoading(true);
  setListError(null);
  try {
    const data = await fetchSqls({ ...toQuery(applied), page, limit: LIST_LIMIT });
    setItems(data.items);
    setTotal(data.total);
  } catch {
    setListError('No se pudieron cargar los SQLs.');
  } finally {
    setListLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- appliedKey captura los filtros
}, [appliedKey, page]);

useEffect(() => {
  loadSqls();
}, [loadSqls]);

function handleAplicarFiltros() {
  setApplied(draft);
  setPage(1); // todo cambio de filtro resetea a página 1
}
```

**Por qué draft/applied y no filtros reactivos por keystroke:** en bandejas con varios filtros combinables (segmento + comercial + backlog), disparar un fetch por cada tecla es ruidoso y caro. El usuario ajusta todo en `draft` y confirma una vez con "Aplicar" — es el patrón ya validado en Leads, replícalo igual en SQL/Preventa/Pricing en vez de introducir debounce u otra variante.

### 3. Paginación: reutiliza `Pagination.tsx`, no reconstruyas la UI de paginación

```tsx
import { Pagination } from '@/components/Pagination';

<Pagination
  page={page}
  limit={LIST_LIMIT}
  total={total}
  onPageChange={setPage}
/>
```

### 4. Tabla: `<table>` HTML custom con Tailwind — sin librería

Sigue la estructura de `LeadsTableView`: `<table>` semántico, columnas tipadas explícitamente, badges de estado con el skill `badge-estado-por-entidad`, y ordenamiento client-side con `useMemo` **solo si el volumen de la página actual lo justifica** (el ordenamiento real de negocio, si aplica a todo el dataset, va como parámetro `sortBy`/`sortOrder` al backend, no se simula ordenando 20 filas visibles como si fueran el total).

```tsx
function SqlTableView({ items, loading }: { items: Sql[]; loading: boolean }) {
  if (loading) return <TableSkeleton columns={6} rows={LIST_LIMIT} />;
  if (items.length === 0) return <EmptyState message={emptyMessage} />;

  return (
    <table className="min-w-full divide-y divide-neutral-100">
      <thead>
        <tr>
          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Cliente</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Score</th>
          <th className="px-4 py-2 text-left text-xs font-medium text-neutral-500">Estado</th>
          {/* ... */}
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-50">
        {items.map((sql) => (
          <tr key={sql.sql_id} className="hover:bg-neutral-50">
            <td className="px-4 py-2">{sql.cliente}</td>
            <td className="px-4 py-2">{sql.score}</td>
            <td className="px-4 py-2">
              <Badge tone={sql.en_backlog ? 'danger' : 'info'}>
                {sql.en_backlog ? 'En backlog' : sql.estado}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 5. Estado global: solo Context, solo para auth

No introduzcas Context nuevo para filtros o datos de lista — eso vive en el estado local de la página, tal como manda `200-frontend-react.mdc`. `AuthProvider` sigue siendo el único Context del proyecto salvo justificación explícita nueva.

### 6. Copy de estado vacío (según principio de diseño del proyecto)

El estado vacío es una invitación a actuar, no un simple "No hay resultados":

- Bandeja sin filtros activos y sin datos: `"Aún no hay SQLs asignados. Cuando Mercadeo apruebe un MQL, aparecerá aquí."`
- Bandeja con filtros activos y sin resultados: `"No hay SQLs que coincidan con estos filtros."` + botón "Limpiar filtros" (que resetea `draft` y `applied` a la vez).

## Anti-patrones

- ❌ Instalar TanStack Query/Table, SWR, Zustand o Redux "porque ayudaría" — contradice `200-frontend-react.mdc` y genera un segundo patrón de data-fetching conviviendo con el ya construido en Leads. Si en algún momento se justifica (ej. necesidad real de cache cross-página), es una decisión de arquitectura para discutir explícitamente, no algo que un dev decide módulo por módulo.
- ❌ Paginación client-side (traer todos los registros y paginar en el navegador) — con SQLs/OUVs/Leads de alto volumen esto no escala; el backend ya pagina con `page`/`limit`/`total`.
- ❌ Duplicar el DTO de paginación por módulo en el backend en vez de extender `PaginationQueryDto`.
- ❌ Fetch reactivo por cada keystroke de filtro sin pasar por `draft`/`applied` — genera requests innecesarios y no es el patrón ya validado en Leads.
- ❌ Reimplementar la UI de paginación en vez de reutilizar `Pagination.tsx`.
- ❌ Crear un Context nuevo para manejar filtros o listas — el estado de una bandeja es local a su página.
- ❌ Llamar `fetch` directo desde un componente en vez de pasar por la función de `api/` del módulo y `apiRequest()`.

## Checklist de testing

- Verificar que "Aplicar filtros" copia `draft` → `applied` y resetea `page` a 1.
- Verificar `findAndCountAll` (backend) con combinaciones de filtros (incluyendo ninguno) contra datos de fixture.
- Verificar que la acción masiva se deshabilita/oculta correctamente al deseleccionar todas las filas.
- Verificar que `loadX()` maneja el estado de error (`listError`) y que el mensaje se muestra en la UI, no solo en consola.
