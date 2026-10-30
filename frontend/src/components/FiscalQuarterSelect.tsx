import { FISCAL_QUARTER_OPTIONS } from './fiscal-quarter-options';

type FiscalQuarterSelectProps = {
  id: string;
  value: number | null;
  disabled?: boolean;
  title?: string;
  className: string;
  onChange: (value: string) => void;
};

export function FiscalQuarterSelect({
  id,
  value,
  disabled = false,
  title,
  className,
  onChange,
}: FiscalQuarterSelectProps) {
  return (
    <select
      id={id}
      className={className}
      value={value ?? ''}
      disabled={disabled}
      title={title}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Todo el año fiscal</option>
      {FISCAL_QUARTER_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
