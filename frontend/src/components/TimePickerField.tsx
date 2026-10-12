import { Clock } from 'lucide-react';

type Props = {
  id?: string;
  value: string;
  onChange: (hhMm: string) => void;
  className?: string;
  stepMinutes?: number;
  /** Free-typed HH:MM instead of the 15-minute select. */
  editable?: boolean;
  'aria-label'?: string;
};

const TIME_INPUT_CLASS =
  'h-9 w-full appearance-none rounded border border-border bg-bg py-0 pl-9 pr-3 text-sm text-ink outline-none focus:border-accent focus:bg-surface';

function normalizeTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function completeTimeInput(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{0,2}))?$/);
  if (!match) return raw;
  const hours = Number(match[1]);
  const minutes = match[2] === undefined || match[2] === '' ? 0 : Number(match[2]);
  if (hours > 23 || minutes > 59) return raw;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

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
  editable = false,
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
      {editable ? (
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="HH:MM"
          aria-label={ariaLabel ?? 'Hora'}
          className={TIME_INPUT_CLASS}
          value={value}
          onChange={(e) => onChange(normalizeTimeInput(e.target.value))}
          onBlur={() => {
            if (!value.trim()) return;
            onChange(completeTimeInput(value));
          }}
        />
      ) : (
      <select
        id={id}
        aria-label={ariaLabel ?? 'Hora'}
        className={TIME_INPUT_CLASS}
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
      )}
    </div>
  );
}
