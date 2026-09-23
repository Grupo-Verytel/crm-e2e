import type { SqlCitaPlanificada } from '../api/sqls-api';
import { formatSqlDateTime, hasPlannedCita } from '../lib/sql-appointments';

type Props = {
  citaPlanificada: SqlCitaPlanificada | null;
  comercialName: string | null;
};

export function SqlRoutingPlannedCitaCell({
  citaPlanificada,
  comercialName,
}: Props) {
  if (!hasPlannedCita(citaPlanificada)) {
    return <span className="text-muted">—</span>;
  }

  return (
    <div className="space-y-0.5">
      <p className="text-sm text-ink">
        {formatSqlDateTime(citaPlanificada?.fecha_cita)}
      </p>
      {comercialName ? (
        <p className="text-xs text-muted">{comercialName}</p>
      ) : null}
    </div>
  );
}
