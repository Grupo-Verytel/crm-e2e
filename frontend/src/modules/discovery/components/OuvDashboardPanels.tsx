import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { OuvDashboard } from '../api/ouv-dashboard-api';
import {
  formatCompactMoney,
  formatRate,
} from '../lib/ouv-dashboard-format';
import { cardClass } from './ui';

function DeltaRatio({ ratio }: { ratio: number | null }) {
  if (ratio == null) return null;
  const up = ratio >= 0;
  return (
    <p className={`text-xs ${up ? 'text-semaphore-verde' : 'text-danger'}`}>
      {up ? '▲' : '▼'} {Math.round(Math.abs(ratio) * 100)}% vs periodo anterior
    </p>
  );
}

function DeltaPoints({ points }: { points: number | null }) {
  if (points == null) return null;
  const up = points >= 0;
  const abs = Math.abs(points);
  const text = Number.isInteger(abs)
    ? String(abs)
    : abs.toLocaleString('es-CO', { maximumFractionDigits: 1 });
  return (
    <p className={`text-xs ${up ? 'text-semaphore-verde' : 'text-danger'}`}>
      {up ? '▲' : '▼'} {text} pts vs periodo anterior
    </p>
  );
}

function KpiCard({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <article className={`${cardClass} flex min-h-28 flex-col justify-between p-4`}>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
      <div className="mt-2 min-h-8 text-xs text-muted">{children}</div>
    </article>
  );
}

function Meter({
  width,
  className,
}: {
  width: number;
  className: string;
}) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-bg">
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${Math.max(0, Math.min(100, width))}%` }}
      />
    </div>
  );
}

function EmptyLine({ children }: { children: string }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export function OuvDashboardPanels({ data }: { data: OuvDashboard }) {
  const maxFunnel = Math.max(...data.funnel.map((step) => step.amount), 0);
  const maxOrigin = Math.max(...data.new_origins.map((item) => item.count), 0);
  const maxWon = Math.max(...data.executives.map((item) => item.won_amount), 0);
  const cycleLine = data.sales_cycle.by_segment
    .slice(0, 2)
    .map((item) => `${item.segmento} ${item.avg_days} d`)
    .join(' · ');

  return (
    <div className="space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Pipeline ponderado en venta"
          value={formatCompactMoney(data.pipeline_weighted.amount)}
        >
          {data.pipeline_weighted.weight_share == null
            ? 'Sin OUVs abiertas para ponderar.'
            : `${formatRate(data.pipeline_weighted.weight_share)} del valor abierto · 10 / 25 / 50 / 75%`}
        </KpiCard>
        <KpiCard
          label="Valor del pipeline"
          value={formatCompactMoney(data.pipeline_value.amount)}
        >
          <p>
            {data.pipeline_value.count}{' '}
            {data.pipeline_value.count === 1 ? 'OUV abierta' : 'OUVs abiertas'}
          </p>
          <DeltaRatio ratio={data.pipeline_value.delta_ratio} />
        </KpiCard>
        <KpiCard
          label="Tasa de cierre"
          value={formatRate(data.close_rate.rate)}
        >
          <p>
            {data.close_rate.won_count} ganadas · {data.close_rate.lost_count}{' '}
            perdidas
          </p>
          <DeltaPoints points={data.close_rate.delta_points} />
        </KpiCard>
        <KpiCard
          label="Ciclo de venta promedio"
          value={
            data.sales_cycle.avg_days == null
              ? '—'
              : `${data.sales_cycle.avg_days} días`
          }
        >
          {cycleLine || 'Aún no hay OUVs ganadas en el periodo.'}
        </KpiCard>
        <KpiCard
          label="OUVs nuevas en el periodo"
          value={String(data.new_ouvs.count)}
        >
          {formatCompactMoney(data.new_ouvs.amount)} en valor potencial
        </KpiCard>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-4`}>
          <h2 className="text-sm font-bold text-ink">Embudo por etapa</h2>
          <p className="mb-4 text-xs text-muted">
            Valor y cantidad de OUVs abiertas. La conversión sale de las OUVs
            creadas en el periodo.
          </p>
          <ul className="space-y-3">
            {data.funnel.map((step) => (
              <li key={step.zona} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3">
                <div>
                  <p className="text-sm text-ink">{step.label}</p>
                  <p className="text-xs text-muted">
                    {formatCompactMoney(step.amount)} · {step.count}
                  </p>
                </div>
                <Meter
                  width={maxFunnel > 0 ? (step.amount / maxFunnel) * 100 : 0}
                  className="bg-brand"
                />
                <p className="text-right text-xs text-muted">
                  {formatRate(step.conversion_to_next)}
                </p>
              </li>
            ))}
          </ul>
          {data.bottleneck ? (
            <p className="mt-4 text-xs text-muted">
              Cuello de botella: {data.bottleneck.from_label} →{' '}
              {data.bottleneck.to_label} tiene la menor conversión del embudo (
              {formatRate(data.bottleneck.rate)}).
            </p>
          ) : null}
        </section>

        <section className={`${cardClass} p-4`}>
          <h2 className="text-sm font-bold text-ink">Ganadas vs. perdidas</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <p className="text-3xl font-bold text-semaphore-verde">
                {data.won_vs_lost.won.count}
              </p>
              <p className="text-xs text-muted">
                Ganadas · {formatCompactMoney(data.won_vs_lost.won.amount)}
              </p>
            </div>
            <div>
              <p className="text-3xl font-bold text-danger">
                {data.won_vs_lost.lost.count}
              </p>
              <p className="text-xs text-muted">
                Perdidas · {formatCompactMoney(data.won_vs_lost.lost.amount)}
              </p>
            </div>
          </div>
          <h3 className="mb-3 mt-6 text-xs font-bold text-muted">
            Motivos de pérdida
          </h3>
          {data.won_vs_lost.loss_reasons.length === 0 ? (
            <EmptyLine>No hay OUVs perdidas en el periodo.</EmptyLine>
          ) : (
            <ul className="space-y-2">
              {data.won_vs_lost.loss_reasons.map((reason) => (
                <li key={reason.label}>
                  <div className="mb-1 flex justify-between text-xs text-ink">
                    <span>{reason.label}</span>
                    <span>{formatRate(reason.share)}</span>
                  </div>
                  <Meter width={reason.share * 100} className="bg-accent" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-4`}>
          <h2 className="mb-3 text-sm font-bold text-ink">Pipeline por sector</h2>
          {data.pipeline_by_sector.length === 0 ? (
            <EmptyLine>No hay pipeline abierto en este corte.</EmptyLine>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2 font-bold">Sector</th>
                  <th className="pb-2 font-bold">Valor</th>
                  <th className="pb-2 font-bold">Part.</th>
                  <th className="pb-2 font-bold">Win rate</th>
                </tr>
              </thead>
              <tbody>
                {data.pipeline_by_sector.map((row) => (
                  <tr key={row.segmento} className="border-t border-border">
                    <td className="py-2 pr-2 text-ink">{row.segmento}</td>
                    <td className="py-2 pr-2">{formatCompactMoney(row.amount)}</td>
                    <td className="py-2 pr-2">{formatRate(row.share)}</td>
                    <td className="py-2">
                      <span>{formatRate(row.win_rate)}</span>
                      <Meter
                        width={(row.win_rate ?? 0) * 100}
                        className="mt-1 bg-brand"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className={`${cardClass} p-4`}>
          <h2 className="text-sm font-bold text-ink">Origen de OUVs nuevas</h2>
          <p className="mb-4 text-xs text-muted">
            Cómo entraron las oportunidades creadas en el periodo.
          </p>
          {data.new_origins.length === 0 ? (
            <EmptyLine>No entraron OUVs nuevas en el periodo.</EmptyLine>
          ) : (
            <ul className="space-y-3">
              {data.new_origins.map((origin) => (
                <li key={origin.label} className="grid grid-cols-[1fr_8rem_2rem] items-center gap-3">
                  <p className="truncate text-sm text-ink">{origin.label}</p>
                  <Meter
                    width={maxOrigin > 0 ? (origin.count / maxOrigin) * 100 : 0}
                    className="bg-brand"
                  />
                  <p className="text-right text-sm text-ink">{origin.count}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-4`}>
          <h2 className="mb-3 text-sm font-bold text-ink">Desempeño por ejecutivo</h2>
          {data.executives.length === 0 ? (
            <EmptyLine>No hay ejecutivos con pipeline o cierres en este corte.</EmptyLine>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-bold">Ejecutivo</th>
                    <th className="pb-2 font-bold">OUVs</th>
                    <th className="pb-2 font-bold">Pipeline</th>
                    <th className="pb-2 font-bold">Win rate</th>
                    <th className="pb-2 font-bold">Valor ganado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.executives.map((row) => (
                    <tr key={row.user_id} className="border-t border-border">
                      <td className="py-2 pr-2 text-ink">{row.full_name}</td>
                      <td className="py-2 pr-2">{row.open_count}</td>
                      <td className="py-2 pr-2">
                        {formatCompactMoney(row.pipeline_amount)}
                      </td>
                      <td className="py-2 pr-2">{formatRate(row.win_rate)}</td>
                      <td className="py-2">
                        <p>{formatCompactMoney(row.won_amount)}</p>
                        <Meter
                          width={maxWon > 0 ? (row.won_amount / maxWon) * 100 : 0}
                          className="mt-1 bg-brand"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className={`${cardClass} p-4`}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 className="text-sm font-bold text-ink">OUVs estancadas</h2>
            <p className="text-xs text-muted">Sin movimiento en más de 30 días</p>
          </div>
          {data.stalled.length === 0 ? (
            <EmptyLine>Ninguna OUV abierta lleva más de 30 días sin movimiento.</EmptyLine>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-bold">OUV</th>
                    <th className="pb-2 font-bold">Etapa</th>
                    <th className="pb-2 font-bold">Valor</th>
                    <th className="pb-2 font-bold">Días</th>
                    <th className="pb-2 font-bold">Responsable</th>
                  </tr>
                </thead>
                <tbody>
                  {data.stalled.map((row) => (
                    <tr key={row.ouv_id} className="border-t border-border">
                      <td className="max-w-40 py-2 pr-2">
                        <Link
                          to={`/opportunities/${row.ouv_id}`}
                          className="font-bold text-ink hover:text-accent"
                        >
                          {row.titulo}
                        </Link>
                        <p className="text-xs text-muted">{row.consecutivo}</p>
                      </td>
                      <td className="py-2 pr-2">{row.zona}</td>
                      <td className="py-2 pr-2">{formatCompactMoney(row.amount)}</td>
                      <td className="py-2 pr-2">{row.days_stale}</td>
                      <td className="py-2">{row.comercial_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
