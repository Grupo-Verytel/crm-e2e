import { Link } from 'react-router-dom';
import type { OuvDashboardDetailItem } from '../api/ouv-dashboard-api';
import { formatCompactMoney } from '../lib/ouv-dashboard-format';
import { OUV_ZONA_LABEL, type OuvZona } from '../lib/ouv-vocab';

function dash(value: string | null | undefined): string {
  return value?.trim() || '—';
}

function formatFecha(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.slice(0, 10);
  return parsed.toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function zonaLabel(zona: string): string {
  if (zona in OUV_ZONA_LABEL) return OUV_ZONA_LABEL[zona as OuvZona];
  return zona;
}

export function OuvDashboardDetailTable({
  items,
}: {
  items: OuvDashboardDetailItem[];
}) {
  const fechaTipo = items[0]?.fecha_tipo;
  const fechaLabel =
    fechaTipo === 'cierre'
      ? 'Fecha de cierre'
      : fechaTipo === 'creacion'
        ? 'Fecha de creación'
        : 'Fecha';

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b border-border bg-bg text-xs uppercase text-muted">
          <tr>
            <th className="px-5 py-3 font-bold">Consecutivo</th>
            <th className="px-5 py-3 font-bold">Título</th>
            <th className="px-5 py-3 font-bold">Empresa</th>
            <th className="px-5 py-3 font-bold">Comercial</th>
            <th className="px-5 py-3 font-bold">Segmento</th>
            <th className="px-5 py-3 font-bold">Zona</th>
            <th className="px-5 py-3 font-bold">Monto</th>
            <th className="px-5 py-3 font-bold">{fechaLabel}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.ouv_id} className="border-t border-border">
              <td className="px-5 py-3">
                <Link
                  to={`/opportunities/${item.ouv_id}`}
                  className="font-bold text-accent hover:underline"
                >
                  {item.consecutivo}
                </Link>
              </td>
              <td className="max-w-48 px-5 py-3 text-ink">{dash(item.titulo)}</td>
              <td className="px-5 py-3 text-ink">{dash(item.empresa)}</td>
              <td className="px-5 py-3 text-ink">{dash(item.comercial)}</td>
              <td className="px-5 py-3 text-ink">{item.segmento}</td>
              <td className="px-5 py-3 text-ink">{zonaLabel(item.zona)}</td>
              <td className="px-5 py-3 text-ink">
                {formatCompactMoney(item.monto)}
              </td>
              <td className="px-5 py-3 text-ink">{formatFecha(item.fecha)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
