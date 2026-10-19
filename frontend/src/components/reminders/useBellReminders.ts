import { useCallback, useEffect, useState } from 'react';
import { fetchMyReminders } from './reminders-api';
import { reminderErrorMessage } from './reminder-errors';
import type { BellReminderItem, ReminderGroup, RemindersCounts } from './types';

const PAGE_SIZE = 20;

const EMPTY_COUNTS: RemindersCounts = {
  OVERDUE: 0,
  TODAY: 0,
  UPCOMING: 0,
};

type Options = {
  open: boolean;
  reminderSignal: number;
};

export function useBellReminders({ open, reminderSignal }: Options) {
  const [items, setItems] = useState<BellReminderItem[]>([]);
  const [counts, setCounts] = useState<RemindersCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [active, setActive] = useState<ReminderGroup[]>(['OVERDUE', 'TODAY']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (open) {
        setLoading(true);
      }
      setError(null);
      try {
        if (!open || active.length === 0) {
          const data = await fetchMyReminders({ page: 1, limit: 1 });
          if (cancelled) return;
          setCounts(data.counts);
          if (open) {
            setItems([]);
            setTotal(0);
            setPage(1);
          }
          return;
        }
        const data = await fetchMyReminders({
          page: 1,
          limit: PAGE_SIZE,
          group: active,
        });
        if (cancelled) return;
        setItems(data.items);
        setCounts(data.counts);
        setTotal(data.total);
        setPage(data.page);
      } catch (loadError) {
        if (!cancelled) {
          setError(reminderErrorMessage(loadError));
        }
      } finally {
        if (!cancelled && open) {
          setLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, active, reminderSignal, reloadTick]);

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState !== 'visible') return;
      setReloadTick((current) => current + 1);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const loadMore = useCallback(async () => {
    if (active.length === 0) return;
    setError(null);
    try {
      const data = await fetchMyReminders({
        page: page + 1,
        limit: PAGE_SIZE,
        group: active,
      });
      setItems((current) => [...current, ...data.items]);
      setCounts(data.counts);
      setTotal(data.total);
      setPage(data.page);
    } catch (loadError) {
      setError(reminderErrorMessage(loadError));
    }
  }, [active, page]);

  function toggleGroup(group: ReminderGroup) {
    setActive((current) =>
      current.includes(group)
        ? current.filter((item) => item !== group)
        : [...current, group],
    );
  }

  function refresh() {
    setReloadTick((current) => current + 1);
  }

  return {
    items,
    counts,
    total,
    page,
    active,
    loading,
    error,
    toggleGroup,
    loadMore,
    refresh,
  };
}
