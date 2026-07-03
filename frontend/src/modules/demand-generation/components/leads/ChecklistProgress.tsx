import type { ChecklistProgress as Progress } from '../../hooks/useChecklistProgress';

/**
 * Binary checklist progress ("2/4") as four filled/empty segments — not a
 * circular gauge, because this is a count of met criteria, not a score.
 */
export function ChecklistProgress({
  progress,
  compact = false,
}: {
  progress: Progress | null | undefined;
  compact?: boolean;
}) {
  if (progress === undefined) {
    return <span className="text-xs text-muted">…</span>;
  }

  if (progress === null) {
    return <span className="text-xs text-muted">—</span>;
  }

  const { checked, total } = progress;
  const complete = checked >= total;

  return (
    <span
      className="inline-flex items-center gap-2"
      title={`${checked} de ${total} criterios cumplidos`}
    >
      <span className="flex gap-0.5" aria-hidden="true">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={`h-1.5 w-3 rounded-full ${
              index < checked
                ? complete
                  ? 'bg-turquoise'
                  : 'bg-brand'
                : 'bg-border'
            }`}
          />
        ))}
      </span>
      {compact ? null : (
        <span
          className={`text-xs font-bold ${complete ? 'text-ink' : 'text-muted'}`}
        >
          {checked}/{total}
        </span>
      )}
    </span>
  );
}
