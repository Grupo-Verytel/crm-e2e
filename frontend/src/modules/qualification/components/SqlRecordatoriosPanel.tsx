import { useEffect, useState } from 'react';
import { ReminderTrayList } from '../../shared/reminders/ReminderTrayList';
import { listRemindersForOuv } from '../../shared/reminders/store';
import { OUV_REMINDERS_CHANGED_EVENT } from '../../shared/reminders/types';
import type { OuvReminder } from '../../shared/reminders/types';
import { cardClass } from './ui';

type Props = {
  sqlId: string;
};

export function SqlRecordatoriosPanel({ sqlId }: Props) {
  const [items, setItems] = useState<OuvReminder[]>([]);

  useEffect(() => {
    function refresh() {
      setItems(listRemindersForOuv(sqlId));
    }
    refresh();
    window.addEventListener(OUV_REMINDERS_CHANGED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(OUV_REMINDERS_CHANGED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [sqlId]);

  return (
    <section className={`${cardClass} p-5`}>
      <div className="mb-4">
        <h2 className="text-sm font-bold text-ink">Recordatorios</h2>
        <p className="text-xs text-muted">
          Seguimientos programados y el historial de chulo o descarte.
        </p>
      </div>
      <ReminderTrayList
        items={items}
        emptyLabel="Aún no hay recordatorios para este Lead."
      />
    </section>
  );
}
