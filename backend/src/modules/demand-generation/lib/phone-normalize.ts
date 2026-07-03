const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export function normalizePhoneToE164(
  phone: string | null | undefined,
  defaultCountryCode = '57',
): string | null {
  if (!phone?.trim()) {
    return null;
  }

  let normalized = phone.replace(/[\s\-().]/g, '');

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (!normalized.startsWith('+')) {
    normalized = normalized.replace(/^0+/, '');
    normalized = `+${defaultCountryCode}${normalized}`;
  }

  return E164_PATTERN.test(normalized) ? normalized : null;
}
