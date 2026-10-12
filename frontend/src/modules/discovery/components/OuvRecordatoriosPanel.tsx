import { useEffect, useState } from 'react';
import { ReminderTrayList } from '../../shared/reminders/ReminderTrayList';
import { listRemindersForOuv } from '../../shared/reminders/store';
import { OUV_REMINDERS_CHANGED_EVENT } from '../../shared/reminders/types';
import type { OuvReminder } from '../../shared/reminders/types';
import type { Ouv } from '../api/ouvs-api';
import { syncOuvRemindersFromInteracciones } from '../lib/sync-ouv-reminders';
import { cardClass } from './ui';

type Props = {
  ouv: Ouv;
};

export function OuvRecordatoriosPanel({ ouv }: Props) {
  const [items, setItems] = useState<OuvReminder[]>([]);

  useEffect(() => {
    function refresh() {
      setItems(listRemindersForOuv(ouv.ouv_id));
    }
    syncOuvRemindersFromInteracciones(ouv);
    refresh();
    window.addEventListener(OUV_REMINDERS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(OUV_REMINDERS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [ouv]);

  return (
    <section className={`${cardClass} mb-4 p-4`}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-ink">Recordatorios</h2>
        <p className="text-xs text-muted">
          Seguimientos programados y el historial de chulo o descarte.
        </p>
      </div>
      <ReminderTrayList
        items={items}
        emptyLabel="Aún no hay recordatorios para esta OUV."
      />
    </section>
  );
}
