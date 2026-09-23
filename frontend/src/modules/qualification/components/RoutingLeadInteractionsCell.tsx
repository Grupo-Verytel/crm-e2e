import { splitDateTimeLines } from '../lib/sql-appointments';
import type { SqlInteraction } from '../types/sql-interaction.types';

type Props = {
  interactions: SqlInteraction[];
};

export function RoutingLeadInteractionsCell({ interactions }: Props) {
  const latest = interactions[0];

  if (!latest?.fecha) {
    return <span className="text-sm text-muted">—</span>;
  }

  const formatted = splitDateTimeLines(latest.fecha);

  return (
    <span className="text-sm text-ink">
      <span className="block">{formatted.primary}</span>
      {formatted.secondary ? (
        <span className="block text-muted">{formatted.secondary}</span>
      ) : null}
    </span>
  );
}
