import { abbreviateCop, formatCopIntegerInput, parseCopInteger } from '../lib/cop-amount';
import { inputClass, labelClass } from './ui';

type Props = {
  id: string;
  value: string;
  error?: string;
  disabled?: boolean;
  onChange: (formatted: string) => void;
};

export function CopAmountInput({ id, value, error, disabled, onChange }: Props) {
  const amount = parseCopInteger(value);
  const hint = amount === null ? '' : abbreviateCop(amount);

  return (
    <div>
      <label className={labelClass} htmlFor={id}>
        Valor de la meta
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
          $
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={(event) => onChange(formatCopIntegerInput(event.target.value))}
          className={`${inputClass} pl-7 text-right tabular-nums`}
        />
      </div>
      {hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
