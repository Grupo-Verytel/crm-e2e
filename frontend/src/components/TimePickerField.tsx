import { Clock } from 'lucide-react';

type Props = {
  id?: string;
  value: string;
  onChange: (hhMm: string) => void;
  className?: string;
  stepMinutes?: number;
  'aria-label'?: string;
};

function buildOptions(stepMinutes: number): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += stepMinutes) {
      options.push(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
      );
    }
  }
  return options;
}

/** Themed time select — replaces native type=time popup. */
export function TimePickerField({
  id,
  value,
  onChange,
  className = '',
  stepMinutes = 15,
  'aria-label': ariaLabel,
}: Props) {
  const options = buildOptions(stepMinutes);
  if (value && !options.includes(value)) {
    options.unshift(value);
  }

  return (
    <div className={`relative ${className}`}>
      <Clock
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-accent"
        strokeWidth={2}
        aria-hidden
      />
      <select
        id={id}
        aria-label={ariaLabel ?? 'Hora'}
        className="h-9 w-full appearance-none rounded border border-border bg-bg py-0 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">--:--</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
