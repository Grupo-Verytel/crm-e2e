import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type {
  OuvDashboard,
  OuvDashboardDetailOpen,
} from '../api/ouv-dashboard-api';
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

function CloseBySegmentChart({
  rows,
}: {
  rows: OuvDashboard['by_segment'];
}) {
  const active = rows.filter((row) => row.won_count > 0 || row.lost_count > 0);

  return (
    <div className="mt-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-muted">Por segmento</p>
        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-semaphore-verde" />
            Ganadas
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-danger" />
            Perdidas
          </span>
        </div>
      </div>
      {active.length === 0 ? (
        <EmptyLine>Aún no hay OUVs ganadas ni perdidas en el periodo.</EmptyLine>
      ) : (
        <ul className="space-y-3">
          {active.map((row) => (
            <li key={row.segmento}>
              <p className="mb-1 truncate text-xs text-ink" title={row.segmento}>
                {row.segmento}
              </p>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-bg">
                {row.won_count > 0 ? (
                  <div
                    className="h-full bg-semaphore-verde"
                    style={{ flexGrow: row.won_count, flexBasis: 0 }}
                  />
                ) : null}
                {row.lost_count > 0 ? (
                  <div
                    className="h-full bg-danger"
                    style={{ flexGrow: row.lost_count, flexBasis: 0 }}
                  />
                ) : null}
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-xs tabular-nums">
                <p className="whitespace-nowrap text-semaphore-verde">
                  <span className="font-bold">{row.won_count}</span>
                  {' · '}
                  {formatCompactMoney(row.won_amount)}
                </p>
                <p className="whitespace-nowrap text-danger">
                  <span className="font-bold">{row.lost_count}</span>
                  {' · '}
                  {formatCompactMoney(row.lost_amount)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FigureButton({
  count,
  amount,
  onClick,
}: {
  count: number;
  amount: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-count={count}
      data-amount={amount}
      className="text-left text-accent hover:underline"
    >
      <span className="block font-bold">{count}</span>
      <span className="block text-xs">{formatCompactMoney(amount)}</span>
    </button>
  );
}

const segmentFigureGrid = 'grid w-full grid-cols-[2.75rem_minmax(4.5rem,1fr)] gap-x-3';

function SegmentMetricHeader({
  title,
  barClass,
}: {
  title: string;
  barClass: string;
}) {
  return (
    <th className="border-l border-border px-3 pb-2 align-bottom font-bold">
      <span className={`mb-1.5 block h-0.5 w-8 rounded-full ${barClass}`} />
      <span className="block whitespace-nowrap text-ink">{title}</span>
      <span
        className={`${segmentFigureGrid} mt-1 text-[10px] font-normal tracking-wide text-muted`}
      >
        <span className="text-right">#</span>
        <span className="text-right">$</span>
      </span>
    </th>
  );
}

function SegmentFigure({
  count,
  amount,
  tone,
  onClick,
}: {
  count: number;
  amount: number;
  tone: 'open' | 'won' | 'lost';
  onClick: () => void;
}) {
  const quiet = count === 0 && amount === 0;
  const toneClass = quiet
    ? 'text-muted'
    : tone === 'won'
      ? 'text-semaphore-verde'
      : tone === 'lost'
        ? 'text-danger'
        : 'text-accent';
  return (
    <button
      type="button"
      onClick={onClick}
      data-count={count}
      data-amount={amount}
      className={`${segmentFigureGrid} items-baseline rounded text-right underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${toneClass}`}
    >
      <span className="font-bold tabular-nums">{count}</span>
      <span className="text-xs tabular-nums">{formatCompactMoney(amount)}</span>
    </button>
  );
}

export function OuvDashboardPanels({
  data,
  onOpenDetail,
}: {
  data: OuvDashboard;
  onOpenDetail: (request: OuvDashboardDetailOpen) => void;
}) {
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
        <article className={`${cardClass} flex min-h-28 flex-col justify-between p-4`}>
          <p className="text-xs text-muted">Tasa de cierre</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-ink">
                {formatRate(data.close_rate.rate)}
              </p>
              <p className="mt-1 text-xs text-muted">Por cantidad</p>
              <div className="mt-2">
                <Meter
                  width={(data.close_rate.rate ?? 0) * 100}
                  className="bg-brand"
                />
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-2xl font-bold leading-none text-ink">
                {formatRate(data.close_rate.rate_amount)}
              </p>
              <p className="mt-1 text-xs text-muted">Por monto</p>
              <div className="mt-2">
                <Meter
                  width={(data.close_rate.rate_amount ?? 0) * 100}
                  className="bg-brand"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-border pt-2">
            <p className="text-xs text-muted">
              <span className="font-bold text-semaphore-verde">
                {data.close_rate.won_count}
              </span>{' '}
              ganadas
              <span className="mx-1">·</span>
              <span className="font-bold text-danger">
                {data.close_rate.lost_count}
              </span>{' '}
              perdidas
            </p>
            <DeltaPoints points={data.close_rate.delta_points} />
          </div>
        </article>
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

      <section className={`${cardClass} p-4`}>
        <h2 className="mb-1 text-sm font-bold text-ink">Resultado por segmento</h2>
        <p className="mb-3 text-xs text-muted">
          Abiertas de hoy. Ganadas y perdidas del periodo.
        </p>
        {data.by_segment.length === 0 ? (
          <EmptyLine>No hay segmentos con OUVs en este corte.</EmptyLine>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[46rem] border-separate border-spacing-0 text-left text-sm">
              <colgroup>
                <col className="w-[18%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
              </colgroup>
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2 pr-3 align-bottom font-bold text-ink">
                    Segmento
                  </th>
                  <SegmentMetricHeader title="Abiertas hoy" barClass="bg-brand" />
                  <SegmentMetricHeader
                    title="Ganadas periodo"
                    barClass="bg-semaphore-verde"
                  />
                  <SegmentMetricHeader
                    title="Perdidas periodo"
                    barClass="bg-danger"
                  />
                  <th className="border-l border-border px-3 pb-2 align-bottom font-bold">
                    <span className="mb-1.5 block h-0.5 w-8 rounded-full bg-muted" />
                    <span className="block whitespace-nowrap text-ink">Win rate</span>
                    <span className="mt-1 grid grid-cols-2 gap-x-3 text-[10px] font-normal tracking-wide text-muted">
                      <span className="text-right">#</span>
                      <span className="text-right">$</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.by_segment.map((row) => (
                  <tr key={row.segmento} className="group">
                    <td className="border-t border-border py-2.5 pr-3 text-ink group-hover:bg-bg">
                      {row.segmento}
                    </td>
                    <td className="border-l border-t border-border px-3 py-2.5 group-hover:bg-bg">
                      <SegmentFigure
                        count={row.open_count}
                        amount={row.open_amount}
                        tone="open"
                        onClick={() =>
                          onOpenDetail({
                            kind: 'open_by_segment',
                            title: `Abiertas hoy · ${row.segmento}`,
                            segmento: row.segmento,
                          })
                        }
                      />
                    </td>
                    <td className="border-l border-t border-border px-3 py-2.5 group-hover:bg-bg">
                      <SegmentFigure
                        count={row.won_count}
                        amount={row.won_amount}
                        tone="won"
                        onClick={() =>
                          onOpenDetail({
                            kind: 'won_by_segment',
                            title: `Ganadas del periodo · ${row.segmento}`,
                            segmento: row.segmento,
                          })
                        }
                      />
                    </td>
                    <td className="border-l border-t border-border px-3 py-2.5 group-hover:bg-bg">
                      <SegmentFigure
                        count={row.lost_count}
                        amount={row.lost_amount}
                        tone="lost"
                        onClick={() =>
                          onOpenDetail({
                            kind: 'lost_by_segment',
                            title: `Perdidas del periodo · ${row.segmento}`,
                            segmento: row.segmento,
                          })
                        }
                      />
                    </td>
                    <td className="border-l border-t border-border px-3 py-2.5 group-hover:bg-bg">
                      <div className="grid grid-cols-2 gap-x-3 text-right tabular-nums text-ink">
                        <span>{formatRate(row.win_rate)}</span>
                        <span>{formatRate(row.win_rate_amount)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={`${cardClass} p-4`}>
        <h2 className="mb-3 text-sm font-bold text-ink">
          Mayor probabilidad por segmento
        </h2>
        {data.mayor_probabilidad_by_segment.length === 0 ? (
          <EmptyLine>No hay OUVs abiertas en Mayor probabilidad.</EmptyLine>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2 font-bold">Segmento</th>
                  <th className="pb-2 font-bold">Abiertas (#, $)</th>
                </tr>
              </thead>
              <tbody>
                {data.mayor_probabilidad_by_segment.map((row) => (
                  <tr key={row.segmento} className="border-t border-border">
                    <td className="py-2 pr-2 text-ink">{row.segmento}</td>
                    <td className="py-2">
                      <FigureButton
                        count={row.count}
                        amount={row.amount}
                        onClick={() =>
                          onOpenDetail({
                            kind: 'mayor_probabilidad',
                            title: `Mayor probabilidad · ${row.segmento}`,
                            segmento: row.segmento,
                          })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          <CloseBySegmentChart rows={data.by_segment} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={`${cardClass} p-4`}>
          <h2 className="mb-3 text-sm font-bold text-ink">Pipeline por segmento</h2>
          {data.pipeline_by_sector.length === 0 ? (
            <EmptyLine>No hay pipeline abierto en este corte.</EmptyLine>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="pb-2 font-bold">Segmento</th>
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
              <table className="w-full min-w-[44rem] text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th className="pb-2 font-bold">Ejecutivo</th>
                    <th className="pb-2 font-bold">OUVs</th>
                    <th className="pb-2 font-bold">Pipeline</th>
                    <th className="pb-2 font-bold">Abiertas hoy</th>
                    <th className="pb-2 font-bold">Win rate</th>
                    <th className="pb-2 font-bold">Win rate $</th>
                    <th className="pb-2 font-bold">Valor ganado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.executives.map((row) => (
                    <tr key={row.user_id} className="border-t border-border">
                      <td className="py-2 pr-2 text-ink">{row.full_name}</td>
                      <td className="py-2 pr-2 text-ink">{row.open_count}</td>
                      <td className="py-2 pr-2 text-ink">
                        {formatCompactMoney(row.pipeline_amount)}
                      </td>
                      <td className="py-2 pr-2">
                        <FigureButton
                          count={row.open_count_now}
                          amount={row.open_amount_now}
                          onClick={() =>
                            onOpenDetail({
                              kind: 'open_by_executive',
                              title: `Abiertas hoy · ${row.full_name}`,
                              comercialId: row.user_id,
                            })
                          }
                        />
                      </td>
                      <td className="py-2 pr-2 text-ink">{formatRate(row.win_rate)}</td>
                      <td className="py-2 pr-2 text-ink">
                        {formatRate(row.win_rate_amount)}
                      </td>
                      <td className="py-2">
                        <button
                          type="button"
                          data-amount={row.won_amount}
                          onClick={() =>
                            onOpenDetail({
                              kind: 'won_by_executive',
                              title: `Ganadas del periodo · ${row.full_name}`,
                              comercialId: row.user_id,
                            })
                          }
                          className="text-left text-accent hover:underline"
                        >
                          <span className="block font-bold">
                            {formatCompactMoney(row.won_amount)}
                          </span>
                        </button>
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
