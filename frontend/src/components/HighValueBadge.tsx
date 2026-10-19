import { Gem } from 'lucide-react';

const ICON_SIZE = {
  sm: 14,
  md: 18,
} as const;

type Props = {
  size?: keyof typeof ICON_SIZE;
};

const LABEL = 'Cuenta de alto valor';

/** Presentational gem. Callers decide when it is shown. */
export function HighValueBadge({ size = 'sm' }: Props) {
  return (
    <span className="inline-flex shrink-0 text-high-value" title={LABEL}>
      <Gem
        size={ICON_SIZE[size]}
        strokeWidth={2}
        aria-label={LABEL}
        role="img"
      />
    </span>
  );
}
