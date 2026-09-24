export const INTERACTION_MAX_BACKDATE_HOURS = 96;

const HOUR_MS = 60 * 60 * 1000;

export function toDatetimeLocalValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Local datetime-local bounds: now − 96 h through now. */
export function interactionFechaBounds(now = new Date()): { min: string; max: string } {
  const min = new Date(now.getTime() - INTERACTION_MAX_BACKDATE_HOURS * HOUR_MS);
  return {
    min: toDatetimeLocalValue(min),
    max: toDatetimeLocalValue(now),
  };
}
