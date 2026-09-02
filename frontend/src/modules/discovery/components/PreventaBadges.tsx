import { badgeClass } from './ui';
import {
  MILESTONE_LABEL,
  MILESTONE_TONE,
  OUTCOME_TONE,
  PROCESSING_STATUS_LABEL,
  PROCESSING_STATUS_TONE,
  SERVICE_OUTCOME_LABEL,
  SERVICE_STATUS_LABEL,
  SERVICE_STATUS_TONE,
  type BusinessMilestone,
  type ProcessingStatus,
  type ServiceOutcome,
  type ServiceResultStatus,
  type Tone,
} from '../lib/preventa-vocab';

/** Único lugar donde un tono se convierte en clases de Tailwind. */
const TONE_CLASS: Record<Tone, string> = {
  brand: 'bg-brand text-white',
  positive: 'bg-positive text-white',
  danger: 'bg-danger text-white',
  warning: 'bg-warning text-ink',
  neutral: 'bg-border text-muted',
};

function Badge({ tone, children }: { tone: Tone; children: string }) {
  return <span className={`${badgeClass} ${TONE_CLASS[tone]}`}>{children}</span>;
}

/** Hito comercial. Mientras MEP no responde, la solicitud está «Enviada». */
export function MilestoneBadge({ hito }: { hito: BusinessMilestone | null }) {
  if (!hito) {
    return <Badge tone="neutral">Enviada, sin respuesta de Preventa</Badge>;
  }
  return <Badge tone={MILESTONE_TONE[hito]}>{MILESTONE_LABEL[hito]}</Badge>;
}

export function ServiceStatusBadge({
  status,
}: {
  status: ServiceResultStatus;
}) {
  return (
    <Badge tone={SERVICE_STATUS_TONE[status]}>
      {SERVICE_STATUS_LABEL[status]}
    </Badge>
  );
}

export function OutcomeBadge({ outcome }: { outcome: ServiceOutcome }) {
  return (
    <Badge tone={OUTCOME_TONE[outcome]}>{SERVICE_OUTCOME_LABEL[outcome]}</Badge>
  );
}

/**
 * Acuse técnico de MEP. Va siempre dentro de la pista técnica, nunca junto al
 * hito comercial: son dos hechos distintos (INV-12).
 */
export function ProcessingStatusBadge({
  status,
}: {
  status: ProcessingStatus;
}) {
  return (
    <Badge tone={PROCESSING_STATUS_TONE[status]}>
      {PROCESSING_STATUS_LABEL[status]}
    </Badge>
  );
}
