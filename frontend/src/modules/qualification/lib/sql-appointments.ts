import type {
  SqlCita,
  SqlCitaEstado,
  SqlCitaPlanificada,
  SqlDetail,
} from '../api/sqls-api';

export type SqlMeetingStatus =
  | 'sin_agendar'
  | 'agendada'
  | 'reagendada'
  | 'cancelada'
  | 'realizada'
  | 'no_asistio';

export const SQL_MEETING_STATUS_LABELS: Record<SqlMeetingStatus, string> = {
  sin_agendar: 'Sin agendar',
  agendada: 'Agendada',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
  realizada: 'Realizada',
  no_asistio: 'No asistió',
};

export const SQL_MEETING_STATUS_TONE: Record<SqlMeetingStatus, string> = {
  sin_agendar: 'bg-muted/20 text-muted',
  agendada: 'bg-brand/15 text-brand',
  reagendada: 'bg-warning/15 text-ink',
  cancelada: 'bg-border text-muted',
  realizada: 'bg-positive/15 text-positive',
  no_asistio: 'bg-danger/15 text-danger',
};

const MEETING_STATUS_TO_API: Record<
  Exclude<SqlMeetingStatus, 'sin_agendar'>,
  SqlCitaEstado
> = {
  agendada: 'Agendada',
  reagendada: 'Reagendada',
  cancelada: 'Cancelada',
  realizada: 'Realizada',
  no_asistio: 'NoAsistio',
};

export function sqlMeetingStatusToApi(
  status: SqlMeetingStatus,
): SqlCitaEstado | null {
  if (status === 'sin_agendar') return null;
  return MEETING_STATUS_TO_API[status];
}

export function apiEstadoToSqlMeetingStatus(
  estado: SqlCitaEstado | null | undefined,
): SqlMeetingStatus {
  switch (estado) {
    case 'Agendada':
      return 'agendada';
    case 'Reagendada':
      return 'reagendada';
    case 'Cancelada':
      return 'cancelada';
    case 'Realizada':
      return 'realizada';
    case 'NoAsistio':
      return 'no_asistio';
    default:
      return 'sin_agendar';
  }
}

export function resolveSqlMeetingStatus(sql: SqlDetail): SqlMeetingStatus {
  const scheduledEstado = sql.cita?.estado;
  if (scheduledEstado) {
    return apiEstadoToSqlMeetingStatus(scheduledEstado);
  }

  const plannedEstado = sql.cita_planificada?.cita_estado;
  if (plannedEstado) {
    return apiEstadoToSqlMeetingStatus(plannedEstado);
  }

  if (sql.cita_planificada?.fecha_cita) {
    return 'agendada';
  }

  return 'sin_agendar';
}

export const SQL_MEETING_STATUS_OPTIONS: SqlMeetingStatus[] = [
  'sin_agendar',
  'agendada',
  'reagendada',
  'cancelada',
  'realizada',
  'no_asistio',
];

export type SqlAgendaSeguimientoStatus =
  | 'sin_datos'
  | 'solo_planificada'
  | 'solo_agendada'
  | 'pendiente_agendar'
  | 'en_seguimiento';

export function formatSqlDateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatScheduledCita(cita: SqlCita | null | undefined): string {
  if (!cita) return '—';
  return `${cita.fecha} ${cita.hora.slice(0, 5)} · ${cita.lugar}`;
}

export function formatPlannedCita(
  planned: SqlCitaPlanificada | null | undefined,
): string {
  if (!planned?.fecha_cita) return '—';
  return formatSqlDateTime(planned.fecha_cita);
}

export function hasPlannedCita(
  planned: SqlCitaPlanificada | null | undefined,
): boolean {
  return Boolean(planned?.fecha_cita);
}

export function hasScheduledCita(cita: SqlCita | null | undefined): boolean {
  return Boolean(cita);
}

export function resolveAgendaSeguimientoStatus(
  planned: SqlCitaPlanificada | null | undefined,
  scheduled: SqlCita | null | undefined,
): SqlAgendaSeguimientoStatus {
  const hasPlanned = hasPlannedCita(planned);
  const hasScheduled = hasScheduledCita(scheduled);
  if (!hasPlanned && !hasScheduled) return 'sin_datos';
  if (hasPlanned && !hasScheduled) return 'pendiente_agendar';
  if (!hasPlanned && hasScheduled) return 'solo_agendada';
  return 'en_seguimiento';
}

export const AGENDA_SEGUIMIENTO_LABELS: Record<
  SqlAgendaSeguimientoStatus,
  string
> = {
  sin_datos: 'Sin citas registradas',
  solo_planificada: 'Solo cita planificada',
  pendiente_agendar: 'Pendiente agendar en Teams',
  solo_agendada: 'Solo cita agendada',
  en_seguimiento: 'Planificada y agendada',
};

export const AGENDA_SEGUIMIENTO_TONE: Record<
  SqlAgendaSeguimientoStatus,
  string
> = {
  sin_datos: 'bg-muted/20 text-muted',
  solo_planificada: 'bg-warning/15 text-ink',
  pendiente_agendar: 'bg-warning/15 text-ink',
  solo_agendada: 'bg-brand/15 text-brand',
  en_seguimiento: 'bg-positive/15 text-positive',
};

const URL_RE = /https?:\/\/[^\s]+/i;

export function isTeamsLugar(lugar: string | null | undefined): boolean {
  if (!lugar) return false;
  const lower = lugar.toLowerCase();
  return lower.includes('teams') || lower.includes('microsoft');
}

export function extractUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const match = text.match(URL_RE);
  return match?.[0] ?? null;
}

export function formatCitaTableDateTime(cita: SqlCita): string {
  return `${cita.fecha} ${cita.hora.slice(0, 5)}`;
}

export function formatPlannedTableDateTime(
  planned: SqlCitaPlanificada | null | undefined,
): string | null {
  if (!planned?.fecha_cita) return null;
  const date = new Date(planned.fecha_cita);
  if (Number.isNaN(date.getTime())) return null;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function resolveTeamsJoinUrl(
  cita: SqlCita | null | undefined,
  label: string,
): string | null {
  if (!cita || !isTeamsLugar(cita.lugar)) return null;
  const fromDescription = extractUrlFromText(cita.descripcion);
  if (fromDescription) return fromDescription;
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24);
  return `https://teams.microsoft.com/l/meetup-join/${slug || 'reunion'}`;
}

export function resolveSqlOrigenLabel(
  origen: SqlDetail['origen_creacion'] | string,
): string {
  return origen === 'directo_comercial' ? 'Directo' : 'Enrutamiento';
}

export function splitDateTimeLines(value: string | null | undefined): {
  primary: string;
  secondary: string;
} {
  if (!value) {
    return { primary: '—', secondary: '' };
  }
  const formatted = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
  const match = formatted.match(/^(.+?\d{1,2}:\d{2})\s+(.+)$/);
  if (match) {
    return { primary: match[1], secondary: match[2] };
  }
  return { primary: formatted, secondary: '' };
}
