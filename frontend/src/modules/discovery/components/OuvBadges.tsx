import { badgeClass } from './ui';
import type { OuvResultado, OuvZona } from '../lib/ouv-vocab';
import { OUV_ZONA_LABEL } from '../lib/ouv-vocab';

const ZONA_TONE: Record<OuvZona, string> = {
  UNIVERSO: 'bg-bg text-ink',
  ENCIMA_FUNNEL: 'bg-sky/30 text-navy',
  EN_FUNNEL: 'bg-accent/10 text-accent',
  MAYOR_PROBABILIDAD: 'bg-turquoise/20 text-ink',
};

const RESULTADO_TONE: Record<OuvResultado, string> = {
  EnCurso: 'bg-bg text-ink',
  Ganada: 'bg-turquoise/25 text-ink',
  Perdida: 'bg-danger/15 text-danger',
  Descartada: 'bg-warning/20 text-ink',
};

export function ZonaBadge({ zona }: { zona: OuvZona }) {
  return (
    <span className={`${badgeClass} ${ZONA_TONE[zona]}`}>
      {OUV_ZONA_LABEL[zona]}
    </span>
  );
}

export function ResultadoBadge({ resultado }: { resultado: OuvResultado }) {
  return (
    <span className={`${badgeClass} ${RESULTADO_TONE[resultado]}`}>
      {resultado}
    </span>
  );
}

export function GapBadge() {
  return (
    <span className={`${badgeClass} bg-warning/25 text-ink`}>Gap</span>
  );
}
