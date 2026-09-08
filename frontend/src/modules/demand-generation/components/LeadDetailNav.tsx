export type LeadDetailTab = 'detalle' | 'interacciones';

const tabClass = (active: boolean) =>
  [
    '-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors',
    active
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

type Props = {
  active: LeadDetailTab;
  onChange: (tab: LeadDetailTab) => void;
};

/** Nav del detalle Lead — Detalle | Interacciones (mismo patrón que OUV). */
export function LeadDetailNav({ active, onChange }: Props) {
  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Detalle de lead"
    >
      <button
        type="button"
        className={tabClass(active === 'detalle')}
        onClick={() => onChange('detalle')}
        aria-current={active === 'detalle' ? 'page' : undefined}
      >
        Detalle
      </button>
      <button
        type="button"
        className={tabClass(active === 'interacciones')}
        onClick={() => onChange('interacciones')}
        aria-current={active === 'interacciones' ? 'page' : undefined}
      >
        Interacciones
      </button>
    </nav>
  );
}
