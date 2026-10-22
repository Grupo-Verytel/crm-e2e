import { useRef, type KeyboardEvent } from 'react';
import type { VerytelQuarter } from '../lib/verytel-quarter';

const QUARTERS: VerytelQuarter[] = [1, 2, 3, 4];

type Props = {
  id?: string;
  value: VerytelQuarter;
  labelledBy?: string;
  disabled?: boolean;
  onChange: (quarter: VerytelQuarter) => void;
};

export function QuarterSegmentedControl({
  id,
  value,
  labelledBy,
  disabled = false,
  onChange,
}: Props) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function move(fromIndex: number, delta: number) {
    const next = (fromIndex + delta + QUARTERS.length) % QUARTERS.length;
    onChange(QUARTERS[next]);
    buttonRefs.current[next]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, -1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(QUARTERS[0]);
      buttonRefs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(QUARTERS[3]);
      buttonRefs.current[3]?.focus();
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-labelledby={labelledBy}
      className="inline-flex rounded border border-border bg-bg p-1"
    >
      {QUARTERS.map((quarter, index) => {
        const selected = value === quarter;
        return (
          <button
            key={quarter}
            ref={(node) => {
              buttonRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(quarter)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={[
              'rounded px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:cursor-not-allowed disabled:opacity-40',
              selected ? 'bg-accent/15 font-bold text-accent' : 'text-muted',
            ].join(' ')}
          >
            Q{quarter}
          </button>
        );
      })}
    </div>
  );
}
