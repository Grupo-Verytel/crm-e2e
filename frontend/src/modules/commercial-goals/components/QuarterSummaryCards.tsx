import type { VerytelQuarter } from '../lib/verytel-quarter';

export type QuarterCardModel = {
  quarter: VerytelQuarter;
  rangeLabel: string;
  totalLabel: string;
  commercialCount: number;
  isCurrent: boolean;
  isSelected: boolean;
};

type Props = {
  cards: QuarterCardModel[];
  onToggle: (quarter: VerytelQuarter) => void;
};

function countLabel(count: number): string {
  if (count === 1) return '1 comercial con meta';
  return `${count} comerciales con meta`;
}

export function QuarterSummaryCards({ cards, onToggle }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <button
          key={card.quarter}
          type="button"
          aria-pressed={card.isSelected}
          onClick={() => onToggle(card.quarter)}
          className={[
            'rounded border bg-surface p-3 text-left shadow-card outline-none focus-visible:ring-2 focus-visible:ring-accent',
            card.isCurrent ? 'border-accent' : 'border-border',
            card.isSelected ? 'bg-accent/10' : '',
          ].join(' ')}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-ink">Q{card.quarter}</p>
            {card.isCurrent ? (
              <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                Actual
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-muted">{card.rangeLabel}</p>
          <p className="mt-3 text-sm font-bold tabular-nums text-ink">
            {card.totalLabel}
          </p>
          <p className="mt-1 text-xs text-muted">{countLabel(card.commercialCount)}</p>
        </button>
      ))}
    </div>
  );
}
