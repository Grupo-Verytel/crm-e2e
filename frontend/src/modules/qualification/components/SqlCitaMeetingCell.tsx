import { Calendar } from 'lucide-react';
import type { SqlCita, SqlCitaPlanificada } from '../api/sqls-api';
import {
  formatCitaTableDateTime,
  formatPlannedTableDateTime,
  isTeamsLugar,
  resolveTeamsJoinUrl,
} from '../lib/sql-appointments';

type Props = {
  cita: SqlCita | null;
  citaPlanificada: SqlCitaPlanificada | null;
  leadLabel: string;
};

export function SqlCitaMeetingCell({
  cita,
  citaPlanificada,
  leadLabel,
}: Props) {
  const scheduledTeams = cita && isTeamsLugar(cita.lugar);
  const plannedDateTime = formatPlannedTableDateTime(citaPlanificada);
  const displayDateTime = cita
    ? formatCitaTableDateTime(cita)
    : plannedDateTime;
  const showTeamsUi = scheduledTeams || (!cita && Boolean(plannedDateTime));
  const teamsJoinUrl =
    resolveTeamsJoinUrl(cita, leadLabel) ??
    (showTeamsUi
      ? `https://teams.microsoft.com/l/meetup-join/${encodeURIComponent(
          leadLabel.slice(0, 24) || 'reunion',
        )}`
      : null);

  if (!displayDateTime) {
    return <span className="text-muted">—</span>;
  }

  if (!showTeamsUi) {
    return (
      <div className="flex items-start gap-2">
        <Calendar size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
        <div>
          <p className="text-sm text-ink">{displayDateTime}</p>
          {cita ? <p className="text-xs text-muted">{cita.lugar}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <Calendar size={16} className="mt-1 shrink-0 text-turquoise" aria-hidden />
      <div className="min-w-0 space-y-1">
        <span className="inline-block rounded border border-turquoise px-2 py-0.5 text-xs font-bold text-turquoise">
          Reunión Teams
        </span>
        <p className="text-sm text-ink">{displayDateTime}</p>
        {teamsJoinUrl ? (
          <a
            href={teamsJoinUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-bold text-accent hover:underline"
            onClick={(event) => event.stopPropagation()}
          >
            Unirse a Teams
          </a>
        ) : null}
      </div>
    </div>
  );
}
