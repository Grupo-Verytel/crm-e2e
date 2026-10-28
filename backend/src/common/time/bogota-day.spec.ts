import {
  addBogotaCalendarDays,
  bogotaCalendarDaysBetween,
  bogotaDayEnd,
  bogotaDayEndPlus,
  bogotaDayStart,
  bogotaDayStartFromYmd,
  bogotaYmd,
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

  it('builds a Bogota midnight from a calendar date and shifts whole days', () => {
    expect(bogotaYmd(new Date('2026-10-18T01:00:00.000Z'))).toBe('2026-10-17');
    expect(bogotaDayStartFromYmd('2026-10-21').toISOString()).toBe(
      '2026-10-21T05:00:00.000Z',
    );
    expect(addBogotaCalendarDays('2026-10-21', -7)).toBe('2026-10-14');
    expect(addBogotaCalendarDays('2026-10-28', 1)).toBe('2026-10-29');
    expect(
      bogotaCalendarDaysBetween(
        new Date('2026-10-21T03:58:08.297Z'),
        new Date('2026-10-28T22:00:00.000Z'),
      ),
    ).toBe(8);
  });
});
