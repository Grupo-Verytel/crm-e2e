import { useState } from 'react';
import type { SqlDetail } from '../api/sqls-api';
import { updateMeetingStatus } from '../api/sqls-api';
import {
  resolveSqlMeetingStatus,
  SQL_MEETING_STATUS_LABELS,
  SQL_MEETING_STATUS_OPTIONS,
  sqlMeetingStatusToApi,
  type SqlMeetingStatus,
} from '../lib/sql-appointments';
import { inputClass } from './ui';

type Props = {
  sql: SqlDetail;
  disabled?: boolean;
  onUpdated: (sql: SqlDetail) => void;
  onError?: (message: string) => void;
};

export function SqlMeetingStatusSelect({
  sql,
  disabled = false,
  onUpdated,
  onError,
}: Props) {
  const [busy, setBusy] = useState(false);
  const status = resolveSqlMeetingStatus(sql);

  async function handleChange(next: SqlMeetingStatus) {
    if (next === status || busy) return;

    setBusy(true);
    try {
      const updated = await updateMeetingStatus(sql.sql_id, {
        estado: sqlMeetingStatusToApi(next),
      });
      onUpdated(updated);
    } catch (err) {
      onError?.(
        err instanceof Error && err.message
          ? err.message
          : 'No se pudo actualizar el estado.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      className={`${inputClass} min-w-[9.5rem] py-1.5 text-xs`}
      value={status}
      disabled={disabled || busy}
      aria-label="Estado de la cita"
      onChange={(event) =>
        void handleChange(event.target.value as SqlMeetingStatus)
      }
    >
      {SQL_MEETING_STATUS_OPTIONS.map((option) => (
        <option key={option} value={option}>
          {SQL_MEETING_STATUS_LABELS[option]}
        </option>
      ))}
    </select>
  );
}
