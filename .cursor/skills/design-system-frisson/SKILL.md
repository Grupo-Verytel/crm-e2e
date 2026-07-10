---
name: design-system-frisson
description: Tokens de marca, paleta y convención de componentes visuales (botones, badges, cards) del CRM Frisson usando el patrón real del repo — tokens.css + tailwind.config.js + constantes de clase por módulo (ui.ts) + componentes con mapas Record, sin librerías de variantes (no CVA/clsx/shadcn/Radix). Úsalo al crear cualquier componente visual nuevo o al portear una pantalla del Blueprint (dashboards, bandejas, formularios) para que el estilo sea consistente entre los 3 devs.
paths:
  - "frontend/src/**/*.tsx"
  - "frontend/src/**/*.ts"
  - "frontend/src/styles/**/*.css"
---

# Design System — CRM Frisson

## Stack real de este proyecto (no asumas librerías)

Este frontend **no usa** `class-variance-authority`, `clsx`, `tailwind-merge`, Radix ni shadcn. La regla `.cursor/rules/600-ui-design.mdc` es explícita: tokens CSS + Tailwind 4, sin UI kits externos. El patrón real, de mayor a menor nivel:

1. **`frontend/src/styles/tokens.css`** — CSS variables de marca Verytel (fuente única de verdad del color).
2. **`tailwind.config.js`** — mapea esas variables a clases utilitarias (`bg-brand`, `text-ink`, `bg-surface`, `border-border`, etc.).
3. **Constantes de clase por módulo** (`ui.ts`) — strings de Tailwind ya compuestos y exportados, ej. `primaryButtonClass`, `ghostButtonClass`, `cardClass` en `frontend/src/modules/demand-generation/components/ui.ts`.
4. **Componentes React con mapas `Record`** para variantes de tono — ej. `StatusBadge.tsx` con `ESTADO_TONE` / `TONE_CLASS` / `LABELS`.

No hay todavía una carpeta `frontend/src/components/` de design system compartido — solo `Pagination` y `LoadingScreen` viven ahí; el resto vive por módulo. Este skill documenta el patrón para que, si se decide extraer algo a compartido, se haga siguiendo esta misma convención — sin introducir CVA u otra librería sin que el equipo lo acuerde explícitamente.

## Principio rector

Nunca hardcodees un hex, un `px` de spacing suelto, o un color de estado inventado dentro de un componente. Todo color sale de `tokens.css` vía las clases que expone `tailwind.config.js`. Si necesitas un tono que no existe, se agrega al token primero (y se avisa al equipo), no se improvisa inline con `bg-[#2F5496]`.

## Tokens de marca — patrón actual (verificar valores exactos contra `tokens.css` del repo antes de asumir estos nombres)

```css
/* frontend/src/styles/tokens.css */
:root {
  /* Marca — Verytel / Frisson */
  --brand: #2F5496;
  --brand-700: #1F386A; /* hover/active de brand */

  /* Superficie y texto */
  --bg: #F7F8FA;
  --surface: #FFFFFF;
  --ink: #1B1F27;
  --border: #E4E7EC;

  /* Acento — reservado para CTAs críticos, no para estados */
  --accent: #F26522;
  --accent-700: #B04413;
}
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: 'var(--brand)', 700: 'var(--brand-700)' },
        accent: { DEFAULT: 'var(--accent)', 700: 'var(--accent-700)' },
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        border: 'var(--border)',
      },
    },
  },
};
```

**Antes de agregar tokens semánticos nuevos (success/warning/danger/info para SLA y estados), revisa qué existe ya en `tokens.css` — si el equipo ya definió algo parecido con otro nombre, reutilízalo en vez de duplicar.** Si no existe, propone algo consistente con el patrón plano actual (nombre simple + variante `-700` para hover/texto sobre fondo claro), no una escala completa `50-900` que no encaja con el resto del sistema.

## Regla de uso: brand vs accent

- **`brand`** es el color de navegación, acciones principales, headers, links — el color "CRM" en el 90% de la interfaz.
- **`accent`** (naranja) se reserva para **llamados a la acción críticos y alertas de atención** (ej. botón "Crear OUV", flag de SQL en backlog). Si `accent` aparece en más del 10% de una pantalla, está mal usado — pierde su función de énfasis.
- **Nunca** reutilices `accent` para estados de éxito/error — para eso van tokens semánticos dedicados (ver arriba), no el naranja de marca.

## Componentes — patrón real, sin librería de variantes

### Constantes de clase por módulo (`ui.ts`)

Sigue exactamente el patrón ya usado en `demand-generation`:

```typescript
// modules/<modulo>/components/ui.ts
export const primaryButtonClass =
  'rounded bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40';

export const ghostButtonClass =
  'rounded border border-border px-4 py-2 text-sm font-bold text-ink hover:bg-bg disabled:cursor-not-allowed disabled:opacity-40';

export const dangerButtonClass =
  'rounded bg-danger px-4 py-2 text-sm font-bold text-white hover:bg-danger-700 disabled:cursor-not-allowed disabled:opacity-40';

export const cardClass = 'rounded bg-surface shadow-card';
```

Uso en el componente — `<button>` nativo, sin wrapper de variantes:

```tsx
import { primaryButtonClass, ghostButtonClass } from './ui';

<button className={primaryButtonClass} onClick={handleCrearOuv} disabled={isSubmitting}>
  Crear OUV
</button>
<button className={ghostButtonClass} onClick={handleCancelar}>
  Cancelar
</button>
```

**Cada módulo nuevo (Calificación, Preventa, Pricing, etc.) crea su propio `ui.ts` siguiendo este mismo patrón** — si dos módulos necesitan exactamente las mismas clases, es la señal de que ya vale la pena extraerlas a `frontend/src/components/` compartido, pero esa extracción se decide en equipo, no unilateralmente por quien esté implementando ese módulo.

### Badge de estado — mapas `Record`, sin CVA (patrón `StatusBadge.tsx`)

```tsx
// modules/<modulo>/components/StatusBadge.tsx
type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const ESTADO_TONE: Record<string, Tone> = {
  Ganada: 'success',
  RFS: 'success',
  RFB: 'success',
  EnRevision: 'warning',
  MQL_PENDING: 'warning',
  Perdida: 'danger',
  Vencida: 'danger',
  Borrador: 'neutral',
  EnGestion: 'info',
};

const LABELS: Record<string, string> = {
  Ganada: 'Ganada',
  MQL_PENDING: 'Pendiente aprobación',
  // ... resto de estados legibles del módulo
};

const TONE_CLASS: Record<Tone, string> = {
  success: 'border-success bg-success/10 text-success-700',
  warning: 'border-warning bg-warning/10 text-warning-700',
  danger:  'border-danger bg-danger/10 text-danger-700',
  info:    'border-info bg-info/10 text-info-700',
  neutral: 'border-border bg-bg text-ink',
};

export function StatusBadge({ value }: { value: string }) {
  const tone = ESTADO_TONE[value] ?? 'neutral';
  const label = LABELS[value] ?? value;
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-bold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
```

**Este es el mismo componente que alimenta a `semaforo-sla` y `badge-estado-por-entidad`** — cada módulo define su propio `ESTADO_TONE`/`LABELS` (los estados de OUV no son los de SER ni los de FACTURA), pero todos reutilizan el mismo `TONE_CLASS` con los 5 tonos fijos (`success`/`warning`/`danger`/`info`/`neutral`) para que el vocabulario visual sea uno solo en todo el CRM.

### Consecutivos (OUV-0010, PRE-0110): siempre `font-mono`

```tsx
<span className="font-mono text-sm text-ink">{ouv.consecutivo}</span>
```

Convención visual deliberada: ayuda a los usuarios comerciales a distinguir de un vistazo un consecutivo de un nombre de cliente en tablas y headers de detalle.

## Accesibilidad — no negociable

- Todo elemento interactivo (botón, tab, fila de tabla clickeable, card de Kanban) debe tener estado de foco visible — agrega `focus-visible:ring-2 focus-visible:ring-brand` a cualquier clase de botón/interactivo nueva, siguiendo el mismo patrón de composición de `primaryButtonClass`.
- Los badges de estado nunca dependen solo del color — siempre llevan texto (`"SLA vencido"`, no un punto de color solo).
- Contraste AA: si agregas un tono nuevo a `TONE_CLASS`, verifica contraste de `text-*-700` sobre el fondo `/10` antes de darlo por bueno.

## Anti-patrones

- ❌ `className="bg-[#2F5496]"` — usa `bg-brand`, nunca el hex inline.
- ❌ Instalar `class-variance-authority`, `clsx` o `tailwind-merge` para "simplificar" el manejo de variantes — el proyecto ya resolvió esto con constantes de clase + `Record`, y no está decidido adoptar una librería.
- ❌ Copiar el `Badge`/Button de shadcn o cualquier UI kit como referencia de implementación — la convención de este repo es explícitamente sin UI kits externos.
- ❌ Reutilizar `accent` como color de "warning" porque "también es naranja" — son conceptualmente distintos (CTA de marca vs estado de alerta).
- ❌ Duplicar `primaryButtonClass`/`cardClass` copiando el string en cada módulo en vez de definir el propio `ui.ts` del módulo (o extraerlo a compartido si ya se repite en 2+ módulos, previa conversación con el equipo).
