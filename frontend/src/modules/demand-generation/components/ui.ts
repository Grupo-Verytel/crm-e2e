export const inputClass =
  'h-9 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface';

export const labelClass = 'mb-1 block text-xs font-bold text-ink';

/** Solid PANTONE Oriole + pointer glow. */
export const primaryButtonClass =
  'btn-glow rounded px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40';

/** Outline Oriole; fills + glow on hover. */
export const ghostButtonClass =
  'btn-glow-outline rounded px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-40';

export const cardClass = 'rounded bg-surface shadow-card';

export const contactRowGridClass =
  'grid min-h-10 grid-cols-1 items-start gap-2 md:grid-cols-[5.5rem_minmax(0,1fr)_minmax(12.5rem,1fr)_2rem] md:items-center';

export const contactRowClass =
  `${contactRowGridClass} border-b border-border py-1.5`;

export const contactTableHeaderClass =
  'text-[10px] font-bold uppercase tracking-wider text-muted';

export const influenceChipClass =
  'rounded-[14px] border border-border bg-transparent px-2.5 py-0.5 text-[11px] leading-tight text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';

export const influenceChipPressedClass =
  'rounded-[14px] border border-accent bg-accent px-2.5 py-0.5 text-[11px] font-bold leading-tight text-[color:var(--login-panel-right)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand';
