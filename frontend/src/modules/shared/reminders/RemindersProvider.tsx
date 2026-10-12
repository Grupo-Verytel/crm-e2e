import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getReminderResolution,
  isReminderDue,
  listOuvReminders,
  resolveOuvReminder,
} from './store';
import {
  OUV_REMINDERS_CHANGED_EVENT,
  type OuvReminder,
  type OuvReminderResolution,
} from './types';

type RemindersContextValue = {
  reminders: OuvReminder[];
  dueReminders: OuvReminder[];
  upcomingReminders: OuvReminder[];
  dueCount: number;
  resolveReminder: (
    reminderId: string,
    resolution: OuvReminderResolution,
  ) => void;
  refreshReminders: () => void;
};

const RemindersContext = createContext<RemindersContextValue | null>(null);

export function RemindersProvider({ children }: { children: ReactNode }) {
  const [reminders, setReminders] = useState<OuvReminder[]>([]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const refreshReminders = useCallback(() => {
    setReminders(listOuvReminders());
  }, []);

  useEffect(() => {
    refreshReminders();
  }, [refreshReminders]);

  useEffect(() => {
    function onChange() {
      refreshReminders();
    }
    window.addEventListener(OUV_REMINDERS_CHANGED_EVENT, onChange);
    window.addEventListener('storage', onChange);
    return () => {
      window.removeEventListener(OUV_REMINDERS_CHANGED_EVENT, onChange);
      window.removeEventListener('storage', onChange);
    };
  }, [refreshReminders]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  const pendingReminders = useMemo(
    () => reminders.filter((row) => getReminderResolution(row) == null),
    [reminders],
  );
  const dueReminders = useMemo(
    () => pendingReminders.filter((row) => isReminderDue(row, nowMs)),
    [nowMs, pendingReminders],
  );
  const upcomingReminders = useMemo(
    () => pendingReminders.filter((row) => !isReminderDue(row, nowMs)),
    [nowMs, pendingReminders],
  );

  const resolveReminder = useCallback(
    (reminderId: string, resolution: OuvReminderResolution) => {
      resolveOuvReminder(reminderId, resolution);
    },
    [],
  );

  const value = useMemo(
    () => ({
      reminders,
      dueReminders,
      upcomingReminders,
      dueCount: dueReminders.length,
      resolveReminder,
      refreshReminders,
    }),
    [
      dueReminders,
      reminders,
      refreshReminders,
      resolveReminder,
      upcomingReminders,
    ],
  );

  return (
    <RemindersContext.Provider value={value}>
      {children}
    </RemindersContext.Provider>
  );
}

export function useReminders(): RemindersContextValue {
  const ctx = useContext(RemindersContext);
  if (!ctx) {
    throw new Error('useReminders must be used within RemindersProvider');
  }
  return ctx;
}
