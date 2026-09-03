import type { Ouv } from '../api/ouvs-api';
import { daysInOuvZona } from '../lib/ouv-zona-days';
import { OUV_ZONAS, OUV_ZONA_RIBBON_LABEL } from '../lib/ouv-vocab';

type Props = {
  ouv: Ouv;
};

const CHEVRON_PX = 12;

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

export function OuvFunnelRibbon({ ouv }: Props) {
  const currentIdx = OUV_ZONAS.indexOf(ouv.zona_actual);

  return (
    <div
      className="mb-4 overflow-x-auto rounded border border-accent/25 bg-accent/[0.06]"
      role="navigation"
      aria-label="Trazabilidad de la OUV en el embudo"
    >
      <ol className="flex min-w-full">
        {OUV_ZONAS.map((zona, idx) => {
          const isPast = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFirst = idx === 0;
          const isLast = idx === OUV_ZONAS.length - 1;

          return (
            <li
              key={zona}
              className={[
                'relative flex min-w-0 flex-1 items-center justify-center py-2.5 text-center text-[11px] font-bold uppercase leading-tight tracking-wide',
                segmentTone(isPast, isCurrent),
                isFirst ? 'pl-3 pr-4' : isLast ? 'pl-5 pr-3' : 'px-5',
                idx > 0 ? '-ml-3' : '',
              ].join(' ')}
              style={{
                clipPath: segmentClipPath(isFirst, isLast),
                zIndex: OUV_ZONAS.length - idx,
              }}
              aria-current={isCurrent ? 'step' : undefined}
            >
              <span className="whitespace-nowrap">
                {daysInOuvZona(ouv, zona)} días · {OUV_ZONA_RIBBON_LABEL[zona]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
