/** Strip a DECIMAL/COUNT value down to a non-negative integer of digits. */
export function integerDigits(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) {
      return '0';
    }
    return String(Math.trunc(value));
  }
  if (typeof value !== 'string') {
    return '0';
  }
  const raw = value.trim();
  const match = raw.match(/^(\d+)(?:\.0+)?$/);
  if (match) {
    return match[1].replace(/^0+(?=\d)/, '');
  }
  const numeric = Number(raw);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return '0';
  }
  return String(Math.trunc(numeric));
}
