import { normalizePhoneToE164 } from './phone-normalize';

describe('Phone normalization', () => {
  it('EARS-DEM-06: normalizes Colombian phone numbers to E.164', () => {
    expect(normalizePhoneToE164('3001234567')).toBe('+573001234567');
    expect(normalizePhoneToE164('+573001234567')).toBe('+573001234567');
    expect(normalizePhoneToE164('(300) 123-4567')).toBe('+573001234567');
  });

  it('returns null for invalid phone numbers', () => {
    expect(normalizePhoneToE164('abc')).toBeNull();
    expect(normalizePhoneToE164('')).toBeNull();
  });
});
