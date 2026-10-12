const STORAGE_KEY = 'crm-sql-interaction-titles-v1';

function readAll(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSqlInteractionTitle(
  interactionId: string,
  title: string,
): void {
  const next = readAll();
  next[interactionId] = title;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getSqlInteractionTitle(interactionId: string): string | null {
  const title = readAll()[interactionId]?.trim();
  return title || null;
}

export function removeSqlInteractionTitle(interactionId: string): void {
  const next = readAll();
  delete next[interactionId];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
