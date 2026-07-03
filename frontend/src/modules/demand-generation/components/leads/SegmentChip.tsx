import { segmentoDot } from '../../lib/lead-vocab';

/** Categorical segment chip: a small token-colored dot + label, no large fills. */
export function SegmentChip({ segmento }: { segmento: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-ink">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${segmentoDot(segmento)}`}
        aria-hidden="true"
      />
      {segmento}
    </span>
  );
}
