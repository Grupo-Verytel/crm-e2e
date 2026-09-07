import { Clock } from 'lucide-react';

type Props = {
  id?: string;
  value: string;
  onChange: (hhMm: string) => void;
  className?: string;
  stepMinutes?: number;
  /** Primera hora ofrecida, `HH:mm` inclusive. */
  minTime?: string;
  /** Última hora ofrecida, `HH:mm` inclusive. */
  maxTime?: string;
  'aria-label'?: string;
};

// `HH:mm` con ceros a la izquierda se ordena igual como texto que como hora,
// así que la comparación de cadenas basta para acotar el rango.
function buildOptions(
  stepMinutes: number,
  minTime: string,
  maxTime: string,
): string[] {
  const options: string[] = [];
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += stepMinutes) {
      const option = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      if (option >= minTime && option <= maxTime) options.push(option);
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
  minTime = '00:00',
  maxTime = '23:59',
  'aria-label': ariaLabel,
}: Props) {
  const options = buildOptions(stepMinutes, minTime, maxTime);
  // Una hora ya guardada fuera del rango (dato viejo, o un rango que cambió)
  // se conserva como opción: si no, el select se vaciaría solo al abrirlo.
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
