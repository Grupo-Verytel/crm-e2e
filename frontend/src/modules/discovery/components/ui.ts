export const inputClass =
  'h-9 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface';

export const labelClass = 'mb-1 block text-xs font-bold text-ink';

/** Solid PANTONE Oriole + pointer glow. */
export const primaryButtonClass =
  'btn-glow rounded px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40';

/** Outline Oriole; fills + glow on hover. */
export const ghostButtonClass =
  'btn-glow-outline rounded px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40';

/** Toggle de icono (vista/filtro). Inactivo = outline Oriole; activo = fondo Oriole. */
export const iconToggleClass =
  'btn-glow-outline inline-flex h-9 w-9 items-center justify-center rounded';

export const iconToggleActiveClass =
  'btn-glow inline-flex h-9 w-9 items-center justify-center rounded text-white';

export const cardClass = 'rounded bg-surface shadow-card';

export const badgeClass =
  'inline-flex items-center rounded px-2 py-0.5 text-xs font-bold';

export const tabClass =
  'border-b-2 border-transparent px-3 py-2 text-sm text-muted hover:text-accent';

export const tabActiveClass =
  'border-b-2 border-accent px-3 py-2 text-sm font-bold text-accent';
