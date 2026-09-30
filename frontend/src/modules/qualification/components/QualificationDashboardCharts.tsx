import type { QualificationDashboardDetailKind } from '../api/qualification-dashboard-api';
import { QUALIFICATION_DASHBOARD_TARGETS } from '../lib/qualification-dashboard-targets';
import { OpenDetailPopoutIcon } from './OpenDetailPopoutIcon';
import { cardClass } from './ui';



type OpenDetail = (kind: QualificationDashboardDetailKind, title: string) => void;



function DonutMetric({

  label,

  value,

  target,

  metaCaption,

  titleAbove = false,

  selected = false,

  onClick,

}: {

  label: string;

  value: number;

  target: number;

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



  const className = [
    cardClass,
    'relative flex items-center gap-4 p-5 text-left',
    titleAbove ? 'w-full' : '',
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
      <OpenDetailPopoutIcon size={17.46} />
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

          className={`absolute inset-0 grid place-items-center text-3xl font-bold ${progressClass}`}

        >

          {value}

        </span>

      </div>

      <div className="min-w-0">

        {!titleAbove ? (

          <h3 className="font-bold text-ink">{label}</h3>

        ) : null}

        <p className={`text-xs text-muted ${titleAbove ? '' : 'mt-1'}`}>

          {metaCaption ?? `Meta: ${target}`}

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

    <div>

      <h3 className="mb-3 text-center text-sm font-bold text-ink">{label}</h3>

      {card}

    </div>

  );

}



export function MqlBandejaMeters({

  pendingTotal,

  withCita,

  activeKind,

  onOpenDetail,

}: {

  pendingTotal: number;

  withCita: number;

  activeKind: QualificationDashboardDetailKind | null;

  onOpenDetail: OpenDetail;

}) {

  const t = QUALIFICATION_DASHBOARD_TARGETS;

  const bandejaDenominator = Math.max(pendingTotal, 1);



  return (

    <section aria-labelledby="qual-mql-bandeja-title">

      <h2

        id="qual-mql-bandeja-title"

        className="mb-3 text-sm font-bold text-ink"

      >

        Bandeja MQL (aprobación)

      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        <DonutMetric

          label="MQL en bandeja (sin aprobar)"

          value={pendingTotal}

          target={t.mql_bandeja_total}

          selected={activeKind === 'mql_bandeja'}

          onClick={() =>

            onOpenDetail('mql_bandeja', 'MQL en bandeja (sin aprobar)')

          }

        />

        <DonutMetric

          label="Con cita agendada"

          value={withCita}

          target={bandejaDenominator}

          metaCaption={`En bandeja: ${pendingTotal}`}

          selected={activeKind === 'mql_with_cita'}

          onClick={() =>

            onOpenDetail('mql_with_cita', 'MQL con cita agendada')

          }

        />

        <div aria-hidden className="hidden min-h-[9.5rem] lg:block" />

      </div>

    </section>

  );

}



export function CitasCalificacionMeters({

  periodActive,

  scheduled,

  executed,

  sqlAssignedInPeriod,

  sqlConvertedToOuv,

  activeKind,

  onOpenDetail,

}: {

  periodActive: boolean;

  scheduled: number;

  executed: number;

  sqlAssignedInPeriod: number;

  sqlConvertedToOuv: number;

  activeKind: QualificationDashboardDetailKind | null;

  onOpenDetail: OpenDetail;

}) {

  const t = QUALIFICATION_DASHBOARD_TARGETS;

  const sqlAssignedDenominator = Math.max(

    periodActive ? sqlAssignedInPeriod : 0,

    1,

  );



  return (

    <section aria-labelledby="qual-citas-calificacion-title">

      <h2

        id="qual-citas-calificacion-title"

        className="mb-3 text-sm font-bold text-ink"

      >

        Calificacion

      </h2>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

        <DonutMetric

          label="Citas programadas"

          value={periodActive ? scheduled : 0}

          target={t.citas_programadas}

          selected={activeKind === 'citas_scheduled'}

          onClick={() =>

            onOpenDetail('citas_scheduled', 'Citas programadas')

          }

        />

        <DonutMetric

          label="Citas ejecutadas"

          value={periodActive ? executed : 0}

          target={t.citas_ejecutadas}

          selected={activeKind === 'citas_executed'}

          onClick={() => onOpenDetail('citas_executed', 'Citas ejecutadas')}

        />

        <DonutMetric

          label="SQL convertidos a OUV"

          value={periodActive ? sqlConvertedToOuv : 0}

          target={sqlAssignedDenominator}

          metaCaption={

            periodActive

              ? `Asignados en periodo: ${sqlAssignedInPeriod}`

              : 'Asignados en periodo: —'

          }

          selected={activeKind === 'sql_converted_ouv'}

          onClick={() =>

            onOpenDetail('sql_converted_ouv', 'SQL convertidos a OUV')

          }

        />

      </div>

    </section>

  );

}



export function PipelineEmbudoMeters({

  periodActive,

  ouvsReady,

  ouvsWon,

  offerToImplementation,

  implementationToPostSales,

  activeKind,

  onOpenDetail,

}: {

  periodActive: boolean;

  ouvsReady: number;

  ouvsWon: number;

  offerToImplementation: number;

  implementationToPostSales: number;

  activeKind: QualificationDashboardDetailKind | null;

  onOpenDetail: OpenDetail;

}) {

  const t = QUALIFICATION_DASHBOARD_TARGETS;



  return (

    <section aria-label="Embudo comercial posterior a calificación">

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

        <DonutMetric

          titleAbove

          label="OUV ganadas (periodo)"

          value={periodActive ? ouvsWon : 0}

          target={t.ouvs_ganadas_periodo}

          selected={activeKind === 'ouvs_won'}

          onClick={() => onOpenDetail('ouvs_won', 'OUV ganadas (periodo)')}

        />

        <DonutMetric

          titleAbove

          label="OUV listas para Oferta y Cierre"

          value={ouvsReady}

          target={t.ouvs_listas_oferta}

          selected={activeKind === 'ouvs_ready_offer'}

          onClick={() =>

            onOpenDetail(

              'ouvs_ready_offer',

              'OUV listas para Oferta y Cierre',

            )

          }

        />

        <DonutMetric

          titleAbove

          label="Paso a Implementación"

          value={periodActive ? offerToImplementation : 0}

          target={t.paso_implementacion}

          selected={activeKind === 'ventas_implementation'}

          onClick={() =>

            onOpenDetail('ventas_implementation', 'Paso a Implementación')

          }

        />

        <DonutMetric

          titleAbove

          label="Paso a Posventa"

          value={periodActive ? implementationToPostSales : 0}

          target={t.paso_posventa}

          selected={activeKind === 'ventas_post_sales'}

          onClick={() => onOpenDetail('ventas_post_sales', 'Paso a Posventa')}

        />

      </div>

    </section>

  );

}

