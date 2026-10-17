import type { FollowUpStatus } from '../types/assigned-ouvs.types';

const TONE_CLASS: Record<FollowUpStatus, string> = {
  RED: 'bg-danger',
  YELLOW: 'bg-semaphore-amarillo',
  GREEN: 'bg-semaphore-verde',
  NONE: 'bg-muted',
};

const LABELS: Record<FollowUpStatus, string> = {
  RED: 'Vencido',
  YELLOW: 'Próximo',
  GREEN: 'Al día',
  NONE: 'Sin seguimiento',
};

const bogotaDateTime = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function formatBogota(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  const parts = bogotaDateTime.formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${read('day')}/${read('month')}/${read('year')} ${read('hour')}:${read('minute')}`;
}

function caption(status: FollowUpStatus, nextReminderAt: string | null): string {
  if (status === 'NONE') {
    return LABELS.NONE;
  }
  const label = LABELS[status];
  if (!nextReminderAt) {
    return label;
  }
  return `${label} — ${formatBogota(nextReminderAt)}`;
}

type Props = {
  status: FollowUpStatus;
  nextReminderAt: string | null;
};

export function FollowUpDot({ status, nextReminderAt }: Props) {
  const text = caption(status, nextReminderAt);
  return (
    <span
      className={`inline-block h-3.5 w-3.5 rounded-full ${TONE_CLASS[status]}`}
      title={text}
      aria-label={text}
    />
  );
}
