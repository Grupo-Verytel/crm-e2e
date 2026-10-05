import { Link } from 'react-router-dom';
import type {
  QualificationDashboardDetailItem,
  QualificationDashboardDetailKind,
} from '../api/qualification-dashboard-api';
import { formatCopAmount } from '../lib/qualification-dashboard-money';

const MQL_BANDEJA_KINDS = new Set<QualificationDashboardDetailKind>([
  'mql_bandeja',
  'mql_with_cita',
]);

const OUV_VALUE_KINDS = new Set<QualificationDashboardDetailKind>([
  'ouvs_universo',
  'ouvs_encima_funnel',
  'ouvs_en_funnel',
  'ouvs_mayor_probabilidad',
  'ouvs_won',
  'ouvs_lost',
  'ouvs_discarded',
  'sql_converted_ouv',
]);

function dash(value: string | null | undefined): string {
  return value?.trim() || '—';
}

function formatOccurredAt(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value.slice(0, 10);
  return d.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function daysInBandeja(sinceIso: string | null): string {
  if (!sinceIso) return '—';
  const start = new Date(sinceIso).getTime();
  if (Number.isNaN(start)) return '—';
  const days = Math.floor((Date.now() - start) / 86_400_000);
  if (days < 0) return '—';
  return days === 1 ? '1 día' : `${days} días`;
}

function detailHref(item: QualificationDashboardDetailItem): string | null {
  if (item.sql_id) return `/qualification/sqls/${item.sql_id}`;
  if (item.entity === 'lead') return `/demand/leads/${item.id}`;
  if (item.entity === 'sql') return `/qualification/sqls/${item.id}`;
  if (item.entity === 'ouv') return `/opportunities/${item.id}`;
  return null;
}

export function QualificationDashboardDetailTable({
  kind,
  items,
}: {
  kind: QualificationDashboardDetailKind;
  items: QualificationDashboardDetailItem[];
}) {
  const showDaysInBandeja = MQL_BANDEJA_KINDS.has(kind);
  const showAmount = OUV_VALUE_KINDS.has(kind);
  const lastColumnLabel = showDaysInBandeja ? 'Días en bandeja' : 'Fecha';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-border bg-bg text-xs uppercase text-muted">
          <tr>
            <th className="px-5 py-3 font-bold">Referencia</th>
            <th className="px-5 py-3 font-bold">Segmento</th>
            <th className="px-5 py-3 font-bold">Estado</th>
            <th className="px-5 py-3 font-bold">Detalle</th>
            {showAmount ? (
              <th className="px-5 py-3 font-bold">Valor</th>
            ) : null}
            <th className="px-5 py-3 font-bold">{lastColumnLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => {
            const href = detailHref(item);
            return (
              <tr key={`${item.entity}-${item.id}`}>
                <td className="px-5 py-3">
                  {href ? (
                    <Link
                      to={href}
                      className="font-bold text-accent hover:text-accent-700 hover:underline"
                    >
                      {dash(item.label)}
                    </Link>
                  ) : (
                    <span className="font-bold text-ink">{dash(item.label)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-ink">{dash(item.segmento)}</td>
                <td className="px-5 py-3 text-ink">{dash(item.estado)}</td>
                <td className="px-5 py-3 text-ink">{dash(item.detail)}</td>
                {showAmount ? (
                  <td className="px-5 py-3 text-ink">
                    {item.amount_kind
                      ? `${item.amount_kind}: ${formatCopAmount(item.amount)}`
                      : formatCopAmount(item.amount)}
                  </td>
                ) : null}
                <td className="px-5 py-3 text-ink">
                  {showDaysInBandeja
                    ? daysInBandeja(item.occurred_at)
                    : formatOccurredAt(item.occurred_at)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
