import { List } from 'lucide-react';
import type { QualificationDashboardDetailKind } from '../api/qualification-dashboard-api';
import { kpiPercent, ratePercent, type PeriodPhase } from '../lib/kpi-card';
import { QUALIFICATION_DASHBOARD_TARGETS } from '../lib/qualification-dashboard-targets';
import {
  formatCompactCop,
  ouvCountCaption,
} from '../lib/qualification-dashboard-money';
import { KpiCard } from './KpiCard';
import { cardClass } from './ui';

type OpenDetail = (kind: QualificationDashboardDetailKind, title: string) => void;

type MoneyMetric = { amount: number; count: number };

function DonutMetric({
  label,
  value,
  target,
  valueFormat = 'count',
  metaCaption,
  titleAbove = false,
  selected = false,
  onClick,
}: {
  label: string;
  value: number;
  target: number;
  valueFormat?: 'count' | 'money';
  metaCaption?: string;
  titleAbove?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const ratio = target > 0 ? value / target : 0;
  const percentage = Math.round(ratio * 100);
  const progress = Math.min(100, percentage);
  const toneClass =
    ratio >= 0.9
      ? 'bg-semaphore-verde/15 text-semaphore-verde'
      : ratio >= 0.5
        ? 'bg-warning/15 text-warning'
        : 'bg-danger/10 text-danger';
  const progressClass =
    ratio >= 0.9
      ? 'text-semaphore-verde'
      : ratio >= 0.5
        ? 'text-warning'
        : 'text-danger';
  const displayValue =
    valueFormat === 'money' ? formatCompactCop(value) : String(value);
  const targetCaption =
    valueFormat === 'money'
      ? `Meta: ${formatCompactCop(target)}`
      : `Meta: ${target}`;

  const className = [
    cardClass,
    'relative flex items-center gap-4 p-5 pr-12 text-left',
    titleAbove ? 'h-full w-full' : '',
    onClick ? 'group cursor-pointer' : 'cursor-default',
    selected ? 'ring-1 ring-accent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const detailHint = onClick ? (
    <span
      className={[
        'pointer-events-none absolute right-3 top-3 transition-colors duration-150',
        selected ? 'text-accent' : 'text-muted group-hover:text-accent',
      ].join(' ')}
      title="Ver detalle"
    >
      <List size={18} strokeWidth={1.75} aria-hidden />
    </span>
  ) : null;

  const inner = (
    <>
      {detailHint}
      <div className="relative h-28 w-28 shrink-0" aria-hidden>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            className="text-border"
          />
          <circle
            cx="60"
            cy="60"
            r="48"
            pathLength="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${100 - progress}`}
            className={progressClass}
          />
        </svg>
        <span
          className={`absolute inset-0 grid place-items-center px-2 text-center font-bold leading-tight ${progressClass} ${
            valueFormat === 'money' ? 'text-sm' : 'text-3xl'
          }`}
        >
          {displayValue}
        </span>
      </div>
      <div className="min-w-0">
        {!titleAbove ? <h3 className="font-bold text-ink">{label}</h3> : null}
        <p className={`text-xs text-muted ${titleAbove ? '' : 'mt-1'}`}>
          {metaCaption ?? targetCaption}
        </p>
        <span
          className={`mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold ${toneClass}`}
        >
          {percentage}%
        </span>
      </div>
    </>
  );

  const card = onClick ? (
    <button
      type="button"
      className={className}
      aria-label={`${label}. Ver detalle`}
      onClick={onClick}
    >
      {inner}
    </button>
  ) : (
    <article className={className}>{inner}</article>
  );

  if (!titleAbove) {
    return card;
  }

  return (
    <div className="flex h-full flex-col">
      <h3 className="mb-3 flex min-h-10 items-end justify-center text-center text-sm font-bold leading-5 text-ink">
        {label}
      </h3>
      <div className="min-h-0 flex-1">{card}</div>
    </div>
  );
}

export function QualificationKpiMeters({
  pendingTotal,
  withCita,
  periodPhase,
  scheduled,
  executed,
  sqlAssignedInPeriod,
  sqlConvertedToOuv,
  conversionRate,
  activeKind,
  onOpenDetail,
}: {
  pendingTotal: number;
  withCita: number;
  periodPhase: PeriodPhase;
  scheduled: number;
  executed: number;
  sqlAssignedInPeriod: number;
  sqlConvertedToOuv: number;
  conversionRate: number | null;
  activeKind: QualificationDashboardDetailKind | null;
  onOpenDetail: OpenDetail;
}) {
  const t = QUALIFICATION_DASHBOARD_TARGETS;

  return (
    <section aria-label="Indicadores de calificación">
      <div className="grid items-stretch gap-4 lg:grid-cols-4">
        <KpiCard
          kind="snapshot"
          direction="lower_is_better"
          label="MQL en bandeja (sin aprobar)"
          title="MQL activos pendientes de aprobación. No depende del período."
          value={pendingTotal}
          maximum={t.mql_bandeja_total}
          selected={activeKind === 'mql_bandeja'}
          onClick={() =>
            onOpenDetail('mql_bandeja', 'MQL en bandeja (sin aprobar)')
          }
        />
        <KpiCard
          kind="rate"
          direction={null}
          dependsOnPeriod={false}
          phase="open"
          label="Con cita agendada"
          title="MQL activos con fecha de cita, sobre los MQL en bandeja."
          percent={kpiPercent(withCita, pendingTotal)}
          numerator={withCita}
          denominator={pendingTotal}
          emptyMessage="Sin MQL en bandeja"
          selected={activeKind === 'mql_with_cita'}
          onClick={() =>
            onOpenDetail('mql_with_cita', 'MQL con cita agendada')
          }
        />
        <KpiCard
          kind="compare"
          phase={periodPhase}
          left={{
            label: 'Programadas',
            title:
              'Todas las citas del período, incluidas las que ya se ejecutaron.',
            value: scheduled,
            selected: activeKind === 'citas_scheduled',
            onClick: () => onOpenDetail('citas_scheduled', 'Citas programadas'),
          }}
          right={{
            label: 'Ejecutadas',
            title: 'Incluye citas realizadas, canceladas y no asistidas.',
            value: executed,
            selected: activeKind === 'citas_executed',
            onClick: () => onOpenDetail('citas_executed', 'Citas ejecutadas'),
          }}
        />
        <KpiCard
          kind="rate"
          direction={null}
          dependsOnPeriod
          phase={periodPhase}
          label="SQL convertidos a OUV"
          title="SQL asignados en el período que ya originaron una OUV, sobre los asignados."
          percent={ratePercent(conversionRate)}
          numerator={sqlConvertedToOuv}
          denominator={sqlAssignedInPeriod}
          emptyMessage="Sin asignados en el período"
          selected={activeKind === 'sql_converted_ouv'}
          onClick={() =>
            onOpenDetail('sql_converted_ouv', 'SQL convertidos a OUV')
          }
        />
      </div>
    </section>
  );
}

function moneyMeta(periodActive: boolean, metric: MoneyMetric, target: number) {
  if (!periodActive) {
    return `Meta: ${formatCompactCop(target)}`;
  }
  return `${ouvCountCaption(metric.count)} · Meta: ${formatCompactCop(target)}`;
}

export function PipelineEmbudoMeters({
  periodActive,
  openZonas,
  won,
  lost,
  discarded,
  activeKind,
  onOpenDetail,
  leadOriginCaption,
}: {
  periodActive: boolean;
  openZonas?: {
    universo: MoneyMetric;
    encima_funnel: MoneyMetric;
    en_funnel: MoneyMetric;
    mayor_probabilidad: MoneyMetric;
  } | null;
  won: MoneyMetric;
  lost: MoneyMetric;
  discarded: MoneyMetric;
  activeKind: QualificationDashboardDetailKind | null;
  onOpenDetail: OpenDetail;
  leadOriginCaption: string;
}) {
  const t = QUALIFICATION_DASHBOARD_TARGETS;
  const empty: MoneyMetric = { amount: 0, count: 0 };
  const zonas = {
    universo: openZonas?.universo ?? empty,
    encima_funnel: openZonas?.encima_funnel ?? empty,
    en_funnel: openZonas?.en_funnel ?? empty,
    mayor_probabilidad: openZonas?.mayor_probabilidad ?? empty,
  };
  const wonShown = periodActive ? (won ?? empty) : empty;
  const lostShown = periodActive ? (lost ?? empty) : empty;
  const discardedShown = periodActive ? (discarded ?? empty) : empty;

  const openCards: Array<{
    kind: QualificationDashboardDetailKind;
    label: string;
    metric: MoneyMetric;
    target: number;
  }> = [
    {
      kind: 'ouvs_universo',
      label: 'Universo',
      metric: zonas.universo,
      target: t.valor_universo,
    },
    {
      kind: 'ouvs_encima_funnel',
      label: 'Encima Funnel',
      metric: zonas.encima_funnel,
      target: t.valor_encima_funnel,
    },
    {
      kind: 'ouvs_en_funnel',
      label: 'En Funnel',
      metric: zonas.en_funnel,
      target: t.valor_en_funnel,
    },
    {
      kind: 'ouvs_mayor_probabilidad',
      label: 'Mayor Probabilidad',
      metric: zonas.mayor_probabilidad,
      target: t.valor_mayor_probabilidad,
    },
  ];

  return (
    <div className="space-y-8">
      <section aria-labelledby="qual-pipeline-open-title">
        <h2
          id="qual-pipeline-open-title"
          className="text-sm font-bold text-ink"
        >
          Pipeline abierto (valor presupuestado)
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">{leadOriginCaption}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {openCards.map((card) => (
            <DonutMetric
              key={card.kind}
              titleAbove
              valueFormat="money"
              label={card.label}
              value={card.metric.amount}
              target={card.target}
              metaCaption={`${ouvCountCaption(card.metric.count)} · Meta: ${formatCompactCop(card.target)}`}
              selected={activeKind === card.kind}
              onClick={() =>
                onOpenDetail(
                  card.kind,
                  `Valor presupuestado — ${card.label}`,
                )
              }
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="qual-pipeline-closed-title">
        <h2
          id="qual-pipeline-closed-title"
          className="text-sm font-bold text-ink"
        >
          Cierre del periodo
        </h2>
        <p className="mb-3 mt-1 text-sm text-muted">{leadOriginCaption}</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DonutMetric
            titleAbove
            valueFormat="money"
            label="Valor ganado"
            value={wonShown.amount}
            target={t.valor_ganado_periodo}
            metaCaption={moneyMeta(periodActive, wonShown, t.valor_ganado_periodo)}
            selected={activeKind === 'ouvs_won'}
            onClick={() => onOpenDetail('ouvs_won', 'Valor ganado (periodo)')}
          />
          <DonutMetric
            titleAbove
            valueFormat="money"
            label="Valor perdido"
            value={lostShown.amount}
            target={t.valor_perdido_periodo}
            metaCaption={moneyMeta(periodActive, lostShown, t.valor_perdido_periodo)}
            selected={activeKind === 'ouvs_lost'}
            onClick={() => onOpenDetail('ouvs_lost', 'Valor perdido (periodo)')}
          />
          <DonutMetric
            titleAbove
            valueFormat="money"
            label="Valor descartado"
            value={discardedShown.amount}
            target={t.valor_descartado_periodo}
            metaCaption={moneyMeta(
              periodActive,
              discardedShown,
              t.valor_descartado_periodo,
            )}
            selected={activeKind === 'ouvs_discarded'}
            onClick={() =>
              onOpenDetail('ouvs_discarded', 'Valor descartado (periodo)')
            }
          />
        </div>
      </section>
    </div>
  );
}
