import {
  bogotaDayEnd,
  bogotaDayEndPlus,
  bogotaDayStart,
} from './bogota-day';

describe('bogota day bounds', () => {
  it('treats 20:00 Bogota as 01:00 UTC of the next calendar day', () => {
    const now = new Date('2026-10-18T01:00:00.000Z');
    expect(bogotaDayStart(now).toISOString()).toBe('2026-10-17T05:00:00.000Z');
    expect(bogotaDayEnd(now).toISOString()).toBe('2026-10-18T04:59:59.999Z');
    expect(bogotaDayEndPlus(now, 2).toISOString()).toBe(
      '2026-10-20T04:59:59.999Z',
    );
  });
});
