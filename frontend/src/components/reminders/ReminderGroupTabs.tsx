import type { ReminderGroup, RemindersCounts } from './types';

const GROUPS: Array<{ id: ReminderGroup; label: string }> = [
  { id: 'OVERDUE', label: 'Vencidos' },
  { id: 'TODAY', label: 'Hoy' },
  { id: 'UPCOMING', label: 'Próximos' },
];

type Props = {
  counts: RemindersCounts;
  active: ReminderGroup[];
  onToggle: (group: ReminderGroup) => void;
};

export function ReminderGroupTabs({ counts, active, onToggle }: Props) {
  return (
    <div className="flex border-b border-border" role="tablist" aria-label="Recordatorios">
      {GROUPS.map((group) => {
        const selected = active.includes(group.id);
        const className = [
          '-mb-px flex-1 border-b-2 px-3 py-2 text-xs transition-colors',
          selected
            ? 'border-accent font-bold text-accent'
            : 'border-transparent text-muted hover:text-accent',
        ].join(' ');
        return (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={selected}
            className={className}
            onClick={() => onToggle(group.id)}
          >
            {group.label}
            <span className="ml-1">({counts[group.id]})</span>
          </button>
        );
      })}
    </div>
  );
}
