const TONE_CLASS: Record<string, string> = {
  neutral: 'border-border text-muted',
  brand: 'border-brand text-brand',
  positive: 'border-turquoise text-ink',
  warning: 'border-warning text-warning',
  danger: 'border-danger text-danger',
};

const ESTADO_TONE: Record<string, keyof typeof TONE_CLASS> = {
  Nuevo: 'neutral',
  TOFU: 'brand',
  MOFU: 'brand',
  MQL_PENDING: 'warning',
  SQL: 'positive',
  Reciclaje: 'warning',
  Descartado: 'danger',
  // Campaign
  Borrador: 'neutral',
  Activa: 'positive',
  Pausada: 'warning',
  Finalizada: 'neutral',
  Cancelada: 'danger',
  // MQL
  Activo: 'warning',
  ConvertidoSQL: 'positive',
  Devuelto: 'danger',
};

const LABELS: Record<string, string> = {
  // Lead estados — spec §1/§4 machine: TOFU → MOFU → BOFU → SQL
  Nuevo: 'Nuevo',
  TOFU: 'TOFU',
  MOFU: 'MOFU',
  MQL_PENDING: 'BOFU',
  SQL: 'SQL',
  Reciclaje: 'En reciclaje',
  Descartado: 'Descartado',
  // MQL lifecycle
  ConvertidoSQL: 'Convertido a SQL',
};

export function StatusBadge({ value }: { value: string }) {
  const tone = ESTADO_TONE[value] ?? 'neutral';
  const label = LABELS[value] ?? value;

  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-bold ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}
