import { formatCompactMoney } from "../../discovery/lib/ouv-dashboard-format";

export const figureButtonClass =
  "rounded text-left text-accent underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function ReportFigureButton({
  count,
  amount,
  extra,
  subject,
  metric,
  onClick,
}: {
  count: number;
  amount: number;
  extra?: string;
  subject: string;
  metric?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Ver detalle de ${subject}`}
      data-metric={metric}
      data-count={count}
      data-amount={amount}
      className={figureButtonClass}
    >
      <span className="block font-bold">
        {count}
        {extra ? <span className="font-normal"> {extra}</span> : null}
      </span>
      <span className="block text-xs">{formatCompactMoney(amount)}</span>
    </button>
  );
}
