import { useCallback, useState } from 'react';

export type LeadsViewMode = 'list' | 'kanban';

const STORAGE_KEY = 'demand.leads.view';
const DEFAULT_VIEW: LeadsViewMode = 'list';

function readStored(): LeadsViewMode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === 'kanban' || value === 'list' ? value : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}

/**
 * Remembers the last view (Lista is the default) per browser. The project has
 * no server-side user-preferences store yet, so we persist client-side; swap the
 * read/write here if that pattern ever lands without touching call sites.
 */
export function useLeadsViewPreference(): [
  LeadsViewMode,
  (next: LeadsViewMode) => void,
] {
  const [view, setView] = useState<LeadsViewMode>(readStored);

  const persist = useCallback((next: LeadsViewMode) => {
    setView(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Non-fatal: preference just won't survive a reload.
    }
  }, []);

  return [view, persist];
}
