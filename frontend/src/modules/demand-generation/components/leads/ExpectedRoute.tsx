import {
  CHANNEL_ROUTES,
  LEAD_ESTADO_RIBBON_LABEL,
  type KanbanEstado,
} from '../../lib/lead-vocab';
import type { CanalOrigen, LeadEstado } from '../../types';

type Props = {
  canalOrigen: CanalOrigen;
  currentState: LeadEstado;
  /** Anchor date for "días" on the current stage (capture or last interaction). */
  stageSince?: string | null;
};

const CHEVRON_PX = 12;

function daysSince(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 0;
  return Math.floor(ms / 86_400_000);
}

function segmentClipPath(isFirst: boolean, isLast: boolean): string {
  const c = CHEVRON_PX;
  if (isFirst && isLast) {
    return 'none';
  }
  if (isFirst) {
    return `polygon(0 0, calc(100% - ${c}px) 0, 100% 50%, calc(100% - ${c}px) 100%, 0 100%)`;
  }
  if (isLast) {
    return `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${c}px 50%)`;
  }
  return `polygon(0 0, calc(100% - ${c}px) 0, 100% 50%, calc(100% - ${c}px) 100%, 0 100%, ${c}px 50%)`;
}

function segmentTone(isPast: boolean, isCurrent: boolean): string {
  if (isCurrent) {
    return 'bg-accent/22 text-accent';
  }
  if (isPast) {
    return 'bg-accent/12 text-muted';
  }
  return 'bg-accent/[0.05] text-muted/45';
}

/** Lead funnel ribbon — same chevron traceability pattern as OUV. */
export function ExpectedRoute({
  canalOrigen,
  currentState,
  stageSince,
}: Props) {
  const route = CHANNEL_ROUTES[canalOrigen];

  if (!route || route.length === 0) {
    return (
      <div
        className="mb-4 rounded border border-accent/25 bg-accent/[0.06] px-3 py-2.5"
        role="status"
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
          Ruta esperada
        </p>
        <p className="mt-1 text-sm text-muted">
          Pendiente de definición para este canal de origen.
        </p>
      </div>
    );
  }

  const currentIdx = route.indexOf(currentState as KanbanEstado);
  const currentDays = daysSince(stageSince);

  return (
    <div
      className="mb-4 overflow-x-auto rounded border border-accent/25 bg-accent/[0.06]"
      role="navigation"
      aria-label="Ruta esperada del lead en el embudo"
    >
      <ol className="flex min-w-full">
        {route.map((estado, idx) => {
          const isPast = currentIdx >= 0 && idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFirst = idx === 0;
          const isLast = idx === route.length - 1;
          const days = isCurrent ? currentDays : 0;

          return (
            <li
              key={estado}
              className={[
                'relative flex min-w-0 flex-1 items-center justify-center py-2.5 text-center text-[11px] font-bold uppercase leading-tight tracking-wide',
                segmentTone(isPast, isCurrent),
                isFirst ? 'pl-3 pr-4' : isLast ? 'pl-5 pr-3' : 'px-5',
                idx > 0 ? '-ml-3' : '',
              ].join(' ')}
              style={{
                clipPath: segmentClipPath(isFirst, isLast),
                zIndex: route.length - idx,
              }}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="whitespace-nowrap">
                {days} días · {LEAD_ESTADO_RIBBON_LABEL[estado]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
