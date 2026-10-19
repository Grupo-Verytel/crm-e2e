import { useCallback, useEffect, useState } from 'react';
import { ReminderTrayList } from '../../../components/reminders/ReminderTrayList';
import {
  cancelReminder,
  completeReminder,
} from '../../../components/reminders/reminders-api';
import type { ReminderTrayItem } from '../../../components/reminders/types';
import { reminderErrorMessage } from '../../../components/reminders/reminder-errors';
import { useAuth } from '../../auth/hooks/useAuth';
import type { Ouv } from '../api/ouvs-api';
import { fetchOuvRecordatorios } from '../api/ouv-recordatorios-api';
import type { OuvReminderItem } from '../types/ouv-reminder.types';
import { cardClass } from './ui';

type Props = {
  ouv: Ouv;
  refreshKey: number;
};

function toTrayItem(item: OuvReminderItem): ReminderTrayItem {
  return {
    reminder_id: item.reminder_id,
    event_at: item.event_at,
    note: item.note,
    status: item.status,
    completed_at: item.completed_at,
    source_label: item.interaccion_titulo,
    user_id: item.user_id,
    responsable_nombre: item.responsable_nombre,
  };
}

export function OuvRecordatoriosPanel({ ouv, refreshKey }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<OuvReminderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchOuvRecordatorios(ouv.ouv_id);
      setItems(rows);
    } catch (loadError) {
      setItems([]);
      setError(reminderErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [ouv.ouv_id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when the tab opens
    void load();
  }, [load, refreshKey]);

  async function handleComplete(id: string) {
    setActionError(null);
    try {
      await completeReminder(id);
      await load();
    } catch (action) {
      setActionError(reminderErrorMessage(action));
    }
  }

  async function handleCancel(id: string) {
    setActionError(null);
    try {
      await cancelReminder(id);
      await load();
    } catch (action) {
      setActionError(reminderErrorMessage(action));
    }
  }

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-ink">Recordatorios</h2>
        <p className="text-xs text-muted">
          Seguimientos programados y el historial de chulo o descarte.
        </p>
      </div>
      {actionError ? (
        <p className="mb-3 text-sm text-danger" role="alert">
          {actionError}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : (
        <ReminderTrayList
          items={items.map(toTrayItem)}
          loading={loading}
          emptyLabel="Esta OUV no tiene recordatorios"
          onComplete={(id) => void handleComplete(id)}
          onCancel={(id) => void handleCancel(id)}
          canAct={(item) =>
            !!item.user_id && item.user_id === user?.user_id
          }
        />
      )}
    </section>
  );
}
