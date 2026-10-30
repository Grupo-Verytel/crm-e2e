import { List } from 'lucide-react';
import {
  resolveKpiTone,
  type KpiDirection,
  type KpiTone,
  type PeriodPhase,
} from '../lib/kpi-card';
import { cardClass } from './ui';

const TEXT_CLASS: Record<Exclude<KpiTone, 'none'>, string> = {
  accent: 'text-accent',
  danger: 'text-danger',
  warning: 'text-warning',
  met: 'text-semaphore-verde',
};

type Common = {
  label: string;
  title: string;
  selected: boolean;
  onClick: () => void;
};

type SnapshotCard = Common & {
  kind: 'snapshot';
  direction: Extract<KpiDirection, 'lower_is_better'>;
  value: number;
  maximum: number;
};

type RateCard = Common & {
  kind: 'rate';
  direction: null;
  dependsOnPeriod: boolean;
  phase: PeriodPhase;
  percent: number | null;
  numerator: number;
  denominator: number;
  emptyMessage: string;
};

type CompareSide = {
  label: string;
  title: string;
  value: number;
  selected: boolean;
  onClick: () => void;
};

type CompareCard = {
  kind: 'compare';
  phase: PeriodPhase;
  left: CompareSide;
  right: CompareSide;
};

export type KpiCardProps = SnapshotCard | RateCard | CompareCard;

function toneText(tone: KpiTone): string {
  return tone === 'none' ? 'text-ink' : TEXT_CLASS[tone];
}

export function KpiCard(props: KpiCardProps) {
  if (props.kind === 'compare') return <CompareKpi {...props} />;

  const className = [
    cardClass,
    'relative h-full w-full p-5 pr-12 text-left',
    'group cursor-pointer',
    props.selected ? 'ring-1 ring-accent' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={className}
      title={props.title}
      aria-label={`${props.label}. Ver detalle`}
      onClick={props.onClick}
    >
      <span
        className={[
          'pointer-events-none absolute right-3 top-3 transition-colors duration-150',
          props.selected ? 'text-accent' : 'text-muted group-hover:text-accent',
        ].join(' ')}
      >
        <List size={18} strokeWidth={1.75} aria-hidden />
      </span>
      <h3 className="font-bold text-ink">{props.label}</h3>
      <CardBody {...props} />
    </button>
  );
}

function CardBody(props: Exclude<KpiCardProps, CompareCard>) {
  if (props.kind === 'snapshot') return <SnapshotBody {...props} />;
  return <RateBody {...props} />;
}

function SnapshotBody({
  kind,
  direction,
  value,
  maximum,
}: SnapshotCard) {
  const tone = resolveKpiTone({
    kind,
    direction,
    phase: 'open',
    percent: null,
    value,
    maximum,
  });
  return (
    <>
      <p className={`mt-1 text-3xl font-bold ${toneText(tone)}`}>{value}</p>
      <p className="text-xs text-muted">Real</p>
      <p className="mt-3 text-xs text-muted">Máximo: {maximum}</p>
      <p className="mt-1 text-sm text-muted">
        Foto actual, no depende del período
      </p>
    </>
  );
}

function CompareKpi({ phase, left, right }: CompareCard) {
  const selected = left.selected || right.selected;
  return (
    <div
      className={[
        cardClass,
        'grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] p-5',
        selected ? 'ring-1 ring-accent' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <CompareHalf side={left} phase={phase} />
      <span className="self-start px-2 pt-0.5 text-xs font-bold text-muted" aria-hidden>
        vs
      </span>
      <CompareHalf side={right} phase={phase} />
      {phase === 'none' ? (
        <p className="col-span-3 mt-3 text-sm text-muted">
          Selecciona un período
        </p>
      ) : null}
    </div>
  );
}

function CompareHalf({
  side,
  phase,
}: {
  side: CompareSide;
  phase: PeriodPhase;
}) {
  return (
    <button
      type="button"
      title={side.title}
      aria-label={`Citas ${side.label.toLowerCase()}. Ver detalle`}
      onClick={side.onClick}
      className="group min-w-0 w-full text-left"
    >
      <h3 className="flex items-center gap-1 text-sm font-bold leading-5 text-ink">
        {side.label}
        <List
          size={14}
          strokeWidth={1.75}
          aria-hidden
          className={
            side.selected
              ? 'text-accent'
              : 'text-muted group-hover:text-accent'
          }
        />
      </h3>
      {phase === 'none' ? null : (
        <>
          <p className="mt-1 text-3xl font-bold text-ink">{side.value}</p>
          <p className="text-xs text-muted">Real</p>
        </>
      )}
    </button>
  );
}

function RateBody({
  dependsOnPeriod,
  phase,
  percent,
  numerator,
  denominator,
  emptyMessage,
}: RateCard) {
  if (dependsOnPeriod && phase === 'none') {
    return <p className="mt-3 text-sm text-muted">Selecciona un período</p>;
  }
  if (percent == null) {
    return <p className="mt-3 text-sm text-muted">{emptyMessage}</p>;
  }
  return (
    <>
      <p className="mt-1 text-3xl font-bold text-accent">{percent}%</p>
      <p className="mt-1 text-sm text-muted">
        {numerator} de {denominator}
      </p>
    </>
  );
}
