const FISCAL_QUARTER_OPTIONS = [
  { value: 1, label: 'Q1 · 01 feb – 30 abr' },
  { value: 2, label: 'Q2 · 01 may – 31 jul' },
  { value: 3, label: 'Q3 · 01 ago – 31 oct' },
  { value: 4, label: 'Q4 · 01 nov – 31 ene' },
] as const;

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
